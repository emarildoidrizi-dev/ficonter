import { ImageResponse } from "next/og";

export const alt = "FICONTER — Financial Control Center";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "linear-gradient(135deg, #f7f4ed 0%, #eef3ef 58%, #e4ece7 100%)",
          color: "#18303a",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "22px" }}>
          <div
            style={{
              width: "88px",
              height: "88px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid rgba(47, 119, 119, 0.24)",
              borderRadius: "24px",
              background: "rgba(255,255,255,0.64)",
              color: "#2f7777",
              fontSize: "34px",
              fontWeight: 900,
              letterSpacing: "-0.08em",
            }}
          >
            FC
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: "40px",
                fontWeight: 800,
                letterSpacing: "0.08em",
              }}
            >
              FICONTER
            </span>
            <span
              style={{
                marginTop: "5px",
                color: "#607078",
                fontSize: "20px",
                letterSpacing: "0.08em",
              }}
            >
              FINANCIAL CONTROL CENTER
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: "900px" }}>
          <span
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "68px",
              lineHeight: 1.04,
              letterSpacing: "-0.035em",
            }}
          >
            Your financial world,
            <br />
            structured with purpose.
          </span>
          <span
            style={{
              marginTop: "26px",
              color: "#53666d",
              fontSize: "24px",
              lineHeight: 1.45,
            }}
          >
            Personal and business finances in one private, considered workspace.
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#607078",
            fontSize: "18px",
          }}
        >
          <span>Private by design · No advertising</span>
          <span style={{ color: "#2f7777", fontWeight: 700 }}>ficonter.com</span>
        </div>
      </div>
    ),
    size,
  );
}
