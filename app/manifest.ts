import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ficonter",
    short_name: "Ficonter",
    description: "Your private financial command center.",
    start_url: "/login?entry=app",
    scope: "/",
    display: "standalone",
    background_color: "#0d1512",
    theme_color: "#13231b",
    orientation: "any",
    icons: [
      {
        src: "/icons/ficonter-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/ficonter-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/ficonter-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
