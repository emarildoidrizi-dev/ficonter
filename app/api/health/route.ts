import { NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/security/request";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      service: "ficonter-web",
      status: "healthy",
      checkedAt: new Date().toISOString(),
    },
    { headers: noStoreHeaders() },
  );
}
