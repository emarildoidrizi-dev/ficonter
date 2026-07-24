import { NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/security/request";

export function GET() {
  return NextResponse.json(
    { status: "ok" },
    { headers: noStoreHeaders() },
  );
}
