import { type MetadataRoute } from "next";

import { SITE } from "~/lib/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?source=pwa",
    name: `${SITE.name}: ${SITE.tagline}`,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/app?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    orientation: "any",
    background_color: "#fff9f4",
    theme_color: "#0b0b0c",
    categories: ["productivity", "utilities", "photo_video"],
    lang: "en",
    dir: "ltr",
    icons: [
      { src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-256.png", sizes: "256x256", type: "image/png" },
      { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Scripts",
        short_name: "Scripts",
        description: "Everything you have written",
        url: "/app?source=shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Join as remote",
        short_name: "Remote",
        description: "Enter a code and drive a session from this device",
        url: "/join?source=shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
