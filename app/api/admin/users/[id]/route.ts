import type { User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, type AdminRole } from "@/lib/admin/access";
import { createServiceClient } from "@/lib/supabase/admin";
import type { AdminAuditRow } from "@/lib/admin/snapshot";
import {
  isSameOriginRequest,
  noStoreHeaders,
} from "@/lib/security/request";

type Action =
  | "suspend"
  | "restore"
  | "promote_admin"
  | "demote_admin";

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

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: noStoreHeaders() },
  );
}

function isAction(value: unknown): value is Action {
  return ["suspend", "restore", "promote_admin", "demote_admin"].includes(
    String(value),
  );
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
  details: Record<string, unknown>,
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
  details: Record<string, unknown>,
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
  targetRole: AdminRole | null,
  action: Action,
): string | null {
  if (targetRole === "super_admin") {
    return "Protected super-admin accounts cannot be changed from this panel.";
  }

  if (
    actorRole !== "super_admin" &&
    targetRole !== null
  ) {
    return "Administrators cannot change another administrator account.";
  }

  if (
    (action === "promote_admin" || action === "demote_admin") &&
    actorRole !== "super_admin"
  ) {
    return "Only a super admin can change admin roles.";
  }

  if (action === "promote_admin" && targetRole !== null) {
    return "This account already has an administrative role.";
  }

  if (action === "demote_admin" && targetRole !== "admin") {
    return "This account is not an administrator.";
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
    const permissionError = mutationPermissionError(
      auth.admin.role,
      target.role,
      body.action,
    );

    if (permissionError) return jsonError(permissionError, 403);

    const auditDetails = {
      ...target.identity,
      ...actorDetails(auth.user),
      previous_role: target.role,
    };

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
    const permissionError = mutationPermissionError(
      auth.admin.role,
      target.role,
      "suspend",
    );

    if (permissionError) return jsonError(permissionError, 403);

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
