import { createHash } from "node:crypto";

import chunk0 from "@/lib/landing-personal-image/chunk0";
import chunk1 from "@/lib/landing-personal-image/chunk1";
import chunk2 from "@/lib/landing-personal-image/chunk2";
import chunk3 from "@/lib/landing-personal-image/chunk3";
import chunk4 from "@/lib/landing-personal-image/chunk4";
import chunk5 from "@/lib/landing-personal-image/chunk5";
import chunk6 from "@/lib/landing-personal-image/chunk6";
import chunk7 from "@/lib/landing-personal-image/chunk7";

const imageBase64 = [
  chunk0,
  chunk1,
  chunk2,
  chunk3,
  chunk4,
  chunk5,
  chunk6,
  chunk7,
].join("");

export async function GET() {
  const imageBuffer = Buffer.from(imageBase64, "base64");
  const bytes = new Uint8Array(imageBuffer);
  const digest = createHash("sha256").update(imageBuffer).digest("hex");

  return new Response(bytes, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=3600, must-revalidate",
      ETag: `"${digest}"`,
    },
  });
}
