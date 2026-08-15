import type { User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  isOwnerEmail,
  requireAdmin,
  type AdminRole,
} from "@/lib/admin/access";
import { createServiceClient } from "@/lib/supabase/admin";
import type { AdminAuditRow } from "@/lib/admin/snapshot";
import type { Json } from "@/lib/supabase/database.types";
import {
  isSameOriginRequest,
  noStoreHeaders,
} from "@/lib/security/request";

type Action =
  | "suspend"
  | "restore"
  | "promote_admin"
  | "demote_admin"
  | "promote_super_admin"
  | "demote_super_admin"
  | "revoke_beta";

type TargetAccount = {
  user: User;
  role: AdminRole | null;
  identity: {
    target_email: string;
    target_display_name: string;
  };
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LONG_SUSPENSION = "876000h";

type AuditDetails = { [key: string]: Json | undefined };

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: noStoreHeaders() },
  );
}

function isAction(value: unknown): value is Action {
  return [
    "suspend",
    "restore",
    "promote_admin",
    "demote_admin",
    "promote_super_admin",
    "demote_super_admin",
    "revoke_beta",
  ].includes(String(value));
}

async function authorize(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return { error: jsonError("This admin request was rejected.", 403) };
  }

  const { user, admin } = await requireAdmin();

  if (!user || !admin) {
    return { error: jsonError("Admin access is required.", 403) };
  }

  return { user, admin };
}

function actorDetails(user: User) {
  return {
    admin_email: user.email ?? "",
    admin_display_name: String(
      user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? "",
    ),
  };
}

async function getTargetAccount(targetUserId: string): Promise<TargetAccount> {
  const service = createServiceClient();
  const [userResult, roleResult] = await Promise.all([
    service.auth.admin.getUserById(targetUserId),
    service
      .from("admin_users")
      .select("role")
      .eq("user_id", targetUserId)
      .maybeSingle(),
  ]);

  if (userResult.error || !userResult.data.user) {
    throw new Error("TARGET_NOT_FOUND");
  }

  if (roleResult.error) {
    throw new Error("TARGET_ROLE_UNAVAILABLE");
  }

  const target = userResult.data.user;

  return {
    user: target,
    role: (roleResult.data?.role as AdminRole | undefined) ?? null,
    identity: {
      target_email: target.email ?? "",
      target_display_name: String(
        target.user_metadata?.display_name ??
          target.user_metadata?.full_name ??
          "",
      ),
    },
  };
}

async function writeAuditLog(
  adminUserId: string,
  action: string,
  targetUserId: string | null,
  details: AuditDetails,
): Promise<AdminAuditRow> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("admin_audit_logs")
    .insert({
      admin_user_id: adminUserId,
      action,
      target_user_id: targetUserId,
      details,
    })
    .select("id,admin_user_id,action,target_user_id,details,created_at")
    .single();

  if (error) throw new Error("AUDIT_WRITE_FAILED");
  return data as AdminAuditRow;
}

async function updateAuditLog(
  auditId: string,
  action: string,
  details: AuditDetails,
): Promise<AdminAuditRow | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("admin_audit_logs")
    .update({ action, details })
    .eq("id", auditId)
    .select("id,admin_user_id,action,target_user_id,details,created_at")
    .single();

  if (error) {
    console.error("Admin audit finalization failed", {
      auditId,
      action,
      code: error.code,
    });
    return null;
  }

  return data as AdminAuditRow;
}

function remainingBanDuration(bannedUntil: string | null | undefined): string {
  if (!bannedUntil) return "none";
  const remainingMs = new Date(bannedUntil).getTime() - Date.now();
  return remainingMs > 0 ? `${Math.max(1, Math.ceil(remainingMs / 1000))}s` : "none";
}

async function rollbackBan(userId: string, bannedUntil: string | null | undefined) {
  const service = createServiceClient();
  const { error } = await service.auth.admin.updateUserById(userId, {
    ban_duration: remainingBanDuration(bannedUntil),
  });

  if (error) {
    console.error("Admin suspension rollback failed", {
      userId,
      code: error.code,
      status: error.status,
    });
  }
}

async function rollbackRole(userId: string, previousRole: AdminRole | null) {
  const service = createServiceClient();
  const result = previousRole
    ? await service
        .from("admin_users")
        .upsert({ user_id: userId, role: previousRole }, { onConflict: "user_id" })
    : await service.from("admin_users").delete().eq("user_id", userId);

  if (result.error) {
    console.error("Admin role rollback failed", {
      userId,
      code: result.error.code,
    });
  }
}

function mutationPermissionError(
  actorRole: AdminRole,
  actorIsOwner: boolean,
  targetRole: AdminRole | null,
  targetIsOwner: boolean,
  action: Action,
): string | null {
  if (targetIsOwner) {
    return "The Owner account is protected and cannot be changed by another account.";
  }

  if (action === "revoke_beta" && !actorIsOwner) {
    return "Only the Owner can revoke Beta access.";
  }

  if (action === "revoke_beta" && targetRole !== null) {
    return "Administrative accounts are subscription-exempt and cannot have Beta revoked.";
  }

  if (
    (action === "promote_super_admin" || action === "demote_super_admin") &&
    !actorIsOwner
  ) {
    return "Only the Owner can assign or remove Super Admin authority.";
  }

  if (targetRole === "super_admin" && !actorIsOwner) {
    return "Only the Owner can change a Super Admin account.";
  }

  if (actorRole !== "super_admin" && targetRole !== null) {
    return "Administrators cannot change another administrator account.";
  }

  if (
    (action === "promote_admin" || action === "demote_admin") &&
    actorRole !== "super_admin"
  ) {
    return "Only the Owner or a Super Admin can change Admin roles.";
  }

  if (action === "promote_admin" && targetRole !== null) {
    return "Only a standard user can be promoted to Admin with this action.";
  }

  if (action === "demote_admin" && targetRole !== "admin") {
    return "This account is not an Admin.";
  }

  if (
    action === "promote_super_admin" &&
    targetRole !== null &&
    targetRole !== "admin"
  ) {
    return "This account already has Super Admin authority.";
  }

  if (action === "demote_super_admin" && targetRole !== "super_admin") {
    return "This account is not a Super Admin.";
  }

  return null;
}

function safeFailureMessage(error: unknown): string {
  if (!(error instanceof Error)) return "The admin action could not be completed.";
  if (error.message === "TARGET_NOT_FOUND") return "The target account was not found.";
  if (error.message === "TARGET_ROLE_UNAVAILABLE") {
    return "The target account role could not be verified.";
  }
  if (error.message === "AUDIT_WRITE_FAILED") {
    return "The action was reversed because its audit record could not be secured.";
  }
  return "The admin action could not be completed.";
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authorize(request);
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) return jsonError("Invalid account identifier.", 400);

    const body = (await request.json().catch(() => null)) as {
      action?: unknown;
    } | null;

    if (!isAction(body?.action)) {
      return jsonError("Choose a valid admin action.", 400);
    }

    if (id === auth.user.id) {
      return jsonError(
        "Your protected administrator account cannot be changed from this panel.",
        403,
      );
    }

    const service = createServiceClient();
    const target = await getTargetAccount(id);
    const actorIsOwner = isOwnerEmail(auth.user.email);
    const permissionError = mutationPermissionError(
      auth.admin.role,
      actorIsOwner,
      target.role,
      isOwnerEmail(target.user.email),
      body.action,
    );

    if (permissionError) return jsonError(permissionError, 403);

    const auditDetails = {
      ...target.identity,
      ...actorDetails(auth.user),
      previous_role: target.role,
    };

    if (body.action === "revoke_beta") {
      const betaService = createServiceClient();
      const { data: subscription, error: subscriptionError } = await betaService
        .from("subscriptions")
        .select("plan_code,status,provider")
        .eq("user_id", id)
        .maybeSingle();

      if (subscriptionError) {
        console.error("Owner Beta revoke subscription lookup failed", {
          actorId: auth.user.id,
          targetId: id,
          code: subscriptionError.code,
        });
        return jsonError("The subscription state could not be verified.", 500);
      }

      if (!subscription || subscription.plan_code !== "beta") {
        return jsonError("This account is not currently a Beta account.", 409);
      }

      const { data: auditId, error: revokeError } = await betaService.rpc(
        "owner_revoke_ficonter_beta_access",
        {
          p_user_id: id,
          p_actor_user_id: auth.user.id,
          p_audit_details: {
            ...auditDetails,
            previous_plan: "beta",
            next_plan: "free",
            previous_status: subscription.status ?? null,
            previous_provider: subscription.provider ?? null,
            owner_approved: true,
          },
        },
      );

      if (revokeError || typeof auditId !== "string") {
        console.error("Owner Beta revoke failed", {
          actorId: auth.user.id,
          targetId: id,
          code: revokeError?.code,
        });
        return jsonError("Beta access could not be revoked.", 500);
      }

      const { data: audit } = await betaService
        .from("admin_audit_logs")
        .select("id,admin_user_id,action,target_user_id,details,created_at")
        .eq("id", auditId)
        .maybeSingle();

      return NextResponse.json(
        {
          ok: true,
          user: {
            id,
            bannedUntil: target.user.banned_until ?? null,
            role: target.role,
            planCode: "free",
            subscriptionStatus: "active",
            provider: "internal",
            billingInterval: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            betaVerified: false,
          },
          audit: audit ?? undefined,
        },
        { headers: noStoreHeaders() },
      );
    }

    if (body.action === "suspend" || body.action === "restore") {
      const isCurrentlySuspended = Boolean(
        target.user.banned_until &&
          new Date(target.user.banned_until).getTime() > Date.now(),
      );

      if (body.action === "suspend" && isCurrentlySuspended) {
        return jsonError("This account is already suspended.", 409);
      }
      if (body.action === "restore" && !isCurrentlySuspended) {
        return jsonError("This account is already active.", 409);
      }

      const { data, error } = await service.auth.admin.updateUserById(id, {
        ban_duration: body.action === "suspend" ? LONG_SUSPENSION : "none",
      });

      if (error || !data.user) {
        console.error("Admin account status change failed", {
          actorId: auth.user.id,
          targetId: id,
          action: body.action,
          code: error?.code,
          status: error?.status,
        });
        return jsonError("The account status could not be changed.", 500);
      }

      let audit: AdminAuditRow;
      try {
        audit = await writeAuditLog(auth.user.id, body.action, id, {
          ...auditDetails,
          next_status: body.action === "suspend" ? "suspended" : "active",
        });
      } catch (auditError) {
        await rollbackBan(id, target.user.banned_until);
        throw auditError;
      }

      return NextResponse.json(
        {
          ok: true,
          user: {
            id,
            bannedUntil: data.user.banned_until ?? null,
            role: target.role,
          },
          audit,
        },
        { headers: noStoreHeaders() },
      );
    }

    if (body.action === "promote_super_admin") {
      const { error } = await service.from("admin_users").upsert(
        { user_id: id, role: "super_admin" },
        { onConflict: "user_id" },
      );

      if (error) {
        console.error("Super Admin promotion failed", {
          actorId: auth.user.id,
          targetId: id,
          code: error.code,
        });
        return jsonError("Super Admin authority could not be assigned.", 500);
      }

      let audit: AdminAuditRow;
      try {
        audit = await writeAuditLog(auth.user.id, body.action, id, {
          ...auditDetails,
          next_role: "super_admin",
          owner_approved: true,
        });
      } catch (auditError) {
        await rollbackRole(id, target.role);
        throw auditError;
      }

      return NextResponse.json(
        {
          ok: true,
          user: {
            id,
            bannedUntil: target.user.banned_until ?? null,
            role: "super_admin" as const,
          },
          audit,
        },
        { headers: noStoreHeaders() },
      );
    }

    if (body.action === "demote_super_admin") {
      const { error } = await service.from("admin_users").upsert(
        { user_id: id, role: "admin" },
        { onConflict: "user_id" },
      );

      if (error) {
        console.error("Super Admin demotion failed", {
          actorId: auth.user.id,
          targetId: id,
          code: error.code,
        });
        return jsonError("Super Admin authority could not be removed.", 500);
      }

      let audit: AdminAuditRow;
      try {
        audit = await writeAuditLog(auth.user.id, body.action, id, {
          ...auditDetails,
          next_role: "admin",
          owner_approved: true,
        });
      } catch (auditError) {
        await rollbackRole(id, target.role);
        throw auditError;
      }

      return NextResponse.json(
        {
          ok: true,
          user: {
            id,
            bannedUntil: target.user.banned_until ?? null,
            role: "admin" as const,
          },
          audit,
        },
        { headers: noStoreHeaders() },
      );
    }

    if (body.action === "demote_admin") {
      const { error } = await service
        .from("admin_users")
        .delete()
        .eq("user_id", id)
        .eq("role", "admin");

      if (error) {
        console.error("Admin demotion failed", {
          actorId: auth.user.id,
          targetId: id,
          code: error.code,
        });
        return jsonError("The administrator role could not be removed.", 500);
      }

      let audit: AdminAuditRow;
      try {
        audit = await writeAuditLog(auth.user.id, body.action, id, {
          ...auditDetails,
          next_role: null,
        });
      } catch (auditError) {
        await rollbackRole(id, target.role);
        throw auditError;
      }

      return NextResponse.json(
        { ok: true, user: { id, bannedUntil: target.user.banned_until ?? null, role: null }, audit },
        { headers: noStoreHeaders() },
      );
    }

    const { error } = await service.from("admin_users").upsert(
      { user_id: id, role: "admin" },
      { onConflict: "user_id" },
    );

    if (error) {
      console.error("Admin promotion failed", {
        actorId: auth.user.id,
        targetId: id,
        code: error.code,
      });
      return jsonError("The administrator role could not be assigned.", 500);
    }

    let audit: AdminAuditRow;
    try {
      audit = await writeAuditLog(auth.user.id, body.action, id, {
        ...auditDetails,
        next_role: "admin",
      });
    } catch (auditError) {
      await rollbackRole(id, target.role);
      throw auditError;
    }

    return NextResponse.json(
      {
        ok: true,
        user: {
          id,
          bannedUntil: target.user.banned_until ?? null,
          role: "admin" as const,
        },
        audit,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("Admin user action failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonError(safeFailureMessage(error), 500);
  }
}

async function removeUserStorageObjects(userId: string, bucketName: string) {
  const service = createServiceClient();
  const bucket = service.storage.from(bucketName);
  const { data, error } = await bucket.list(userId, { limit: 1000 });

  if (error) return { removed: 0, status: "failed" as const };

  const paths = ((data ?? []) as Array<{ name: string }>).map(
    (object) => `${userId}/${object.name}`,
  );
  if (!paths.length) return { removed: 0, status: "not_found" as const };

  const removeResult = await bucket.remove(paths);
  return removeResult.error
    ? { removed: 0, status: "failed" as const }
    : { removed: paths.length, status: "complete" as const };
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authorize(request);
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) return jsonError("Invalid account identifier.", 400);

    if (id === auth.user.id) {
      return jsonError(
        "Your protected administrator account cannot be deleted from this panel.",
        403,
      );
    }

    const target = await getTargetAccount(id);
    const actorIsOwner = isOwnerEmail(auth.user.email);

    if (!actorIsOwner) {
      return jsonError(
        "Permanent account deletion requires Owner authority.",
        403,
      );
    }

    if (isOwnerEmail(target.user.email)) {
      return jsonError("The Owner account cannot be permanently deleted.", 403);
    }

    const baseDetails = {
      ...target.identity,
      ...actorDetails(auth.user),
      deleted_user_id: id,
      previous_role: target.role,
    };

    const pendingAudit = await writeAuditLog(
      auth.user.id,
      "delete_user_requested",
      id,
      { ...baseDetails, completion_status: "pending" },
    );

    const service = createServiceClient();
    const { error } = await service.auth.admin.deleteUser(id);

    if (error) {
      console.error("Admin account deletion failed", {
        actorId: auth.user.id,
        targetId: id,
        code: error.code,
        status: error.status,
      });

      await updateAuditLog(pendingAudit.id, "delete_user_failed", {
        ...baseDetails,
        completion_status: "failed",
      });

      return jsonError("The account could not be permanently deleted.", 500);
    }

    const [profileStorage, documentStorage] = await Promise.all([
      removeUserStorageObjects(id, "profile-photos"),
      removeUserStorageObjects(id, "financial-documents"),
    ]);
    const finalDetails = {
      ...baseDetails,
      completion_status: "complete",
      storage_cleanup: {
        profile_photos: profileStorage.status,
        financial_documents: documentStorage.status,
      },
      storage_objects_removed: profileStorage.removed + documentStorage.removed,
    };
    const finalAudit = await updateAuditLog(
      pendingAudit.id,
      "delete_user",
      finalDetails,
    );

    return NextResponse.json(
      { ok: true, deletedUserId: id, audit: finalAudit ?? pendingAudit },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("Admin user deletion failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonError(safeFailureMessage(error), 500);
  }
}
