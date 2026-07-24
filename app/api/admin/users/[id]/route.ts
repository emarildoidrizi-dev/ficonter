import { NextRequest, NextResponse } from "next/server";
import {
  createServiceClient,
  requireAdmin,
  type AdminRole,
} from "@/lib/admin/access";
import {
  isSameOriginRequest,
  noStoreHeaders,
} from "@/lib/security/request";

type Action =
  | "suspend"
  | "restore"
  | "promote_admin"
  | "promote_super_admin"
  | "demote_admin";

async function authorize(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return {
      error: NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403, headers: noStoreHeaders() },
      ),
    };
  }

  const { user, admin } = await requireAdmin();

  if (!user || !admin) {
    return {
      error: NextResponse.json(
        { error: "Admin access required." },
        { status: 403, headers: noStoreHeaders() },
      ),
    };
  }

  return { user, admin };
}

async function writeAuditLog(
  adminUserId: string,
  action: string,
  targetUserId: string | null,
  details: Record<string, unknown> = {},
) {
  const service = createServiceClient();
  await service.from("admin_audit_logs").insert({
    admin_user_id: adminUserId,
    action,
    target_user_id: targetUserId,
    details,
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    action?: Action;
  } | null;

  if (!body?.action) {
    return NextResponse.json(
      { error: "Action is required." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  if (id === auth.user.id && body.action !== "promote_super_admin") {
    return NextResponse.json(
      { error: "You cannot suspend, demote or modify your own admin account." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const service = createServiceClient();

  if (body.action === "suspend" || body.action === "restore") {
    const { error } = await service.auth.admin.updateUserById(id, {
      ban_duration: body.action === "suspend" ? "876000h" : "none",
    });

    if (error) {
      return NextResponse.json(
        { error: "The account could not be updated." },
        { status: 500, headers: noStoreHeaders() },
      );
    }

    await writeAuditLog(auth.user.id, body.action, id);
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  }

  if (auth.admin.role !== "super_admin") {
    return NextResponse.json(
      { error: "Super-admin access is required." },
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
        { error: "The admin role could not be removed." },
        { status: 500, headers: noStoreHeaders() },
      );
    }

    await writeAuditLog(auth.user.id, body.action, id);
    return NextResponse.json(
      { ok: true, role: null },
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
      { error: "The admin role could not be updated." },
      { status: 500, headers: noStoreHeaders() },
    );
  }

  await writeAuditLog(auth.user.id, body.action, id, { role });

  return NextResponse.json(
    { ok: true, role },
    { headers: noStoreHeaders() },
  );
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;

  const { id } = await context.params;

  if (id === auth.user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own admin account." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const service = createServiceClient();

  await writeAuditLog(auth.user.id, "delete_user", id);

  const { error } = await service.auth.admin.deleteUser(id);

  if (error) {
    return NextResponse.json(
      { error: "The account could not be deleted." },
      { status: 500, headers: noStoreHeaders() },
    );
  }

  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
}
