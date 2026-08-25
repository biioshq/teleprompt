import { type MetadataRoute } from "next";

import { absoluteUrl } from "~/lib/url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Signed-in surfaces have nothing for a crawler and everything for a
      // confused index. The live rooms are per-account anyway.
      disallow: ["/app", "/app/", "/join", "/prompter/", "/remote/", "/api/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
