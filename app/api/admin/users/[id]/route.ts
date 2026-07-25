import { NextRequest, NextResponse } from "next/server";
import {
  createServiceClient,
  requireAdmin,
  type AdminRole,
} from "@/lib/admin/access";
import { noStoreHeaders } from "@/lib/security/request";

type Action =
  | "suspend"
  | "restore"
  | "promote_admin"
  | "promote_super_admin"
  | "demote_admin";

function isTrustedBrowserRequest(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "") ??
    "https";

  if (!host) return false;

  try {
    return new URL(origin).origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}

async function authorize(request: NextRequest) {
  if (!isTrustedBrowserRequest(request)) {
    return {
      error: NextResponse.json(
        { error: "This admin request was rejected by the origin check." },
        { status: 403, headers: noStoreHeaders() },
      ),
    };
  }

  const { user, admin } = await requireAdmin();

  if (!user || !admin) {
    return {
      error: NextResponse.json(
        { error: "Admin access is required." },
        { status: 403, headers: noStoreHeaders() },
      ),
    };
  }

  return { user, admin };
}

async function getTargetIdentity(targetUserId: string) {
  const service = createServiceClient();
  const { data, error } = await service.auth.admin.getUserById(targetUserId);

  if (error || !data.user) {
    throw new Error(error?.message ?? "Target account was not found.");
  }

  return {
    target_email: data.user.email ?? "",
    target_display_name: String(
      data.user.user_metadata?.display_name ??
        data.user.user_metadata?.full_name ??
        "",
    ),
  };
}

async function writeAuditLog(
  adminUserId: string,
  action: string,
  targetUserId: string | null,
  details: Record<string, unknown>,
) {
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

  if (error) throw new Error(error.message);
  return data;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authorize(request);
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      action?: Action;
    } | null;

    if (!body?.action) {
      return NextResponse.json(
        { error: "Choose an admin action." },
        { status: 400, headers: noStoreHeaders() },
      );
    }

    if (id === auth.user.id) {
      return NextResponse.json(
        {
          error:
            "For security, the current super-admin account cannot be suspended, demoted, restored, promoted or deleted from this panel.",
        },
        { status: 400, headers: noStoreHeaders() },
      );
    }

    const service = createServiceClient();
    const targetDetails = await getTargetIdentity(id);

    if (body.action === "suspend" || body.action === "restore") {
      const { error } = await service.auth.admin.updateUserById(id, {
        ban_duration: body.action === "suspend" ? "876000h" : "none",
      });

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500, headers: noStoreHeaders() },
        );
      }

      const audit = await writeAuditLog(
        auth.user.id,
        body.action,
        id,
        targetDetails,
      );

      return NextResponse.json(
        { ok: true, audit },
        { headers: noStoreHeaders() },
      );
    }

    if (auth.admin.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only a super admin can change admin roles." },
        { status: 403, headers: noStoreHeaders() },
      );
    }

    if (body.action === "demote_admin") {
      const { error } = await service
        .from("admin_users")
        .delete()
        .eq("user_id", id);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500, headers: noStoreHeaders() },
        );
      }

      const audit = await writeAuditLog(
        auth.user.id,
        body.action,
        id,
        targetDetails,
      );

      return NextResponse.json(
        { ok: true, role: null, audit },
        { headers: noStoreHeaders() },
      );
    }

    const role: AdminRole =
      body.action === "promote_super_admin" ? "super_admin" : "admin";

    const { error } = await service.from("admin_users").upsert(
      { user_id: id, role },
      { onConflict: "user_id" },
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: noStoreHeaders() },
      );
    }

    const audit = await writeAuditLog(
      auth.user.id,
      body.action,
      id,
      { ...targetDetails, role },
    );

    return NextResponse.json(
      { ok: true, role, audit },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The admin action could not be completed.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authorize(request);
    if ("error" in auth) return auth.error;

    const { id } = await context.params;

    if (id === auth.user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own super-admin account." },
        { status: 400, headers: noStoreHeaders() },
      );
    }

    const service = createServiceClient();
    const targetDetails = await getTargetIdentity(id);

    const { error } = await service.auth.admin.deleteUser(id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: noStoreHeaders() },
      );
    }

    const audit = await writeAuditLog(
      auth.user.id,
      "delete_user",
      null,
      { ...targetDetails, deleted_user_id: id },
    );

    return NextResponse.json(
      { ok: true, audit },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The account could not be deleted.",
      },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
