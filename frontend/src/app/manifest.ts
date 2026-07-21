import type { MetadataRoute } from "next";

// PWA manifest. Android Chrome (modern) accepts SVG icons via `sizes: "any"`,
// and PNG fallbacks cover maskable + legacy support.

const BRAND = "#F54927";
const NAME = "mongodb.help";
const DESCRIPTION =
  "Paste your error, question, or slow query. Get a grounded MongoDB answer.";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: NAME,
    short_name: NAME,
    description: DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: BRAND,
    categories: ["developer", "education", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
