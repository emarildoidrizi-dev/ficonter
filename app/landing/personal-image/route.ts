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
  const bytes = new Uint8Array(Buffer.from(imageBase64, "base64"));

  return new Response(bytes, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
