import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STAGING_PROJECT_REF = "zlegwxjplrxojeosgphq";
const TEST_EMAIL = "customer-recovery-test@ficonter.test";
const TEST_NAME = "Recovery Test Customer";

function assertStagingOnly() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase() ?? "";

  if (!supabaseUrl.includes(STAGING_PROJECT_REF) || vercelEnv === "production") {
    throw new Error("Test customer utility is disabled outside FICONTER staging.");
  }
}

async function requireRecoveryAuthority() {
  const { user, admin } = await requireAdmin();
  if (!user || !admin) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (admin.role !== "super_admin") {
    return {
      error: NextResponse.json(
        { error: "Only the Owner or a Super Admin can manage the staging test customer." },
        { status: 403 },
      ),
    };
  }
  return { user, admin };
}

async function findTestUserId() {
  const service = createServiceClient();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const match = data.users.find(
      (candidate) => candidate.email?.trim().toLowerCase() === TEST_EMAIL,
    );
    if (match) return match.id;
    if (data.users.length < 100) break;
  }
  return null;
}

export async function GET() {
  try {
    assertStagingOnly();
    const authority = await requireRecoveryAuthority();
    if ("error" in authority) return authority.error;

    const userId = await findTestUserId();
    return NextResponse.json({
      ok: true,
      exists: Boolean(userId),
      userId,
      email: TEST_EMAIL,
      name: TEST_NAME,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read the staging test customer." },
      { status: 400 },
    );
  }
}

export async function POST() {
  try {
    assertStagingOnly();
    const authority = await requireRecoveryAuthority();
    if ("error" in authority) return authority.error;

    const existingUserId = await findTestUserId();
    if (existingUserId) {
      return NextResponse.json(
        {
          error: "The staging recovery test customer already exists. Delete it before creating another one.",
          userId: existingUserId,
          email: TEST_EMAIL,
        },
        { status: 409 },
      );
    }

    const service = createServiceClient();
    const password = `Ficonter-Test-${randomBytes(12).toString("base64url")}`;
    const { data, error } = await service.auth.admin.createUser({
      email: TEST_EMAIL,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: TEST_NAME,
        ficonter_test_account: true,
        ficonter_test_purpose: "vault-assisted-recovery",
        ficonter_base_currency: "EUR",
        ficonter_preferences: {
          currency: "EUR",
          language: "en",
        },
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error("Supabase did not return the created test user.");

    await service.from("admin_users").delete().eq("user_id", data.user.id);

    return NextResponse.json(
      {
        ok: true,
        userId: data.user.id,
        email: TEST_EMAIL,
        password,
        name: TEST_NAME,
        disposable: true,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Staging test customer creation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create the staging test customer." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  try {
    assertStagingOnly();
    const authority = await requireRecoveryAuthority();
    if ("error" in authority) return authority.error;

    const userId = await findTestUserId();
    if (!userId) {
      return NextResponse.json({ ok: true, deleted: false, email: TEST_EMAIL });
    }

    const service = createServiceClient();
    await service.from("admin_users").delete().eq("user_id", userId);
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) throw error;

    return NextResponse.json({ ok: true, deleted: true, userId, email: TEST_EMAIL });
  } catch (error) {
    console.error("Staging test customer deletion failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete the staging test customer." },
      { status: 400 },
    );
  }
}
