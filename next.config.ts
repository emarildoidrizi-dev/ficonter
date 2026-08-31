import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' *.paypal.com *.paypalobjects.com *.venmo.com",
      "style-src 'self' 'unsafe-inline' *.paypal.com *.paypalobjects.com *.venmo.com",
      "img-src 'self' data: blob: https: *.paypal.com *.paypalobjects.com *.venmo.com",
      "media-src 'self' blob: https://*.supabase.co",
      "font-src 'self' data: *.paypalobjects.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.frankfurter.dev *.paypal.com *.paypalobjects.com *.venmo.com",
      "child-src 'self' *.paypal.com *.paypalobjects.com *.venmo.com",
      "frame-src 'self' *.paypal.com *.paypalobjects.com *.venmo.com",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
