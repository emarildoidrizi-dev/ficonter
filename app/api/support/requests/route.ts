import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, noStoreHeaders } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { supportReference, validateSupportRequestInput } from "@/lib/support";

export const dynamic = "force-dynamic";

const MAX_REQUESTS_PER_HOUR = 5;

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "This request could not be verified." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in again before contacting support." },
        { status: 401, headers: noStoreHeaders() },
      );
    }

    const payload = await request.json().catch(() => null);
    const validated = validateSupportRequestInput(payload);

    if (!validated.ok) {
      return NextResponse.json(
        { error: validated.error },
        { status: 400, headers: noStoreHeaders() },
      );
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from("support_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.error("Support request rate-limit check failed", {
        userId: user.id,
        code: countError.code,
      });
      return NextResponse.json(
        { error: "Support is temporarily unavailable. Please try again shortly." },
        { status: 503, headers: noStoreHeaders() },
      );
    }

    if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
      return NextResponse.json(
        {
          error:
            "You have already sent several requests recently. Please wait before submitting another message.",
        },
        {
          status: 429,
          headers: {
            ...noStoreHeaders(),
            "Retry-After": "3600",
          },
        },
      );
    }

    const { data, error } = await supabase
      .from("support_requests")
      .insert({
        user_id: user.id,
        contact_email: validated.data.email,
        category: validated.data.category,
        subject: validated.data.subject,
        message: validated.data.message,
      })
      .select("id,contact_email,created_at")
      .single();

    if (error || !data) {
      console.error("Support request creation failed", {
        userId: user.id,
        code: error?.code,
      });
      return NextResponse.json(
        { error: "Your message could not be submitted. Please try again." },
        { status: 500, headers: noStoreHeaders() },
      );
    }

    return NextResponse.json(
      {
        reference: supportReference(data.id),
        email: data.contact_email,
        submittedAt: data.created_at,
      },
      { status: 201, headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("Support request endpoint failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { error: "Support is temporarily unavailable. Please try again shortly." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
