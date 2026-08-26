import { env } from "~/env";

const DEFAULT_DEV_PORT = 3000;

/**
 * The canonical absolute origin for this deployment.
 *
 * On Vercel, `VERCEL_PROJECT_PRODUCTION_URL` is populated automatically at both
 * build and run time, and, importantly, it is the *production* domain even on a
 * preview deployment. That is exactly what canonical links, Open Graph tags and
 * the sitemap want: a preview should not advertise itself as the real site.
 *
 * Two things about the value are easy to get wrong:
 *   - it is a bare hostname, with no `https://` on the front;
 *   - it is the shortest production custom domain, falling back to the
 *     `.vercel.app` one, so it stays stable across deployments.
 *
 * Off Vercel, set the same variable by hand to your own bare domain. It is only
 * an environment variable name; nothing here requires Vercel to be the host.
 * Left unset (a local checkout), this resolves to localhost.
 */
export function getSiteUrl(): string {
  const domain = env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (domain) {
    // Tolerate someone pasting a full URL in, which is the obvious mistake.
    const host = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (host) return `https://${host}`;
  }

  if (typeof window !== "undefined") return window.location.origin;
  return `http://localhost:${process.env.PORT ?? DEFAULT_DEV_PORT}`;
}

export function absoluteUrl(path = "/"): string {
  const base = getSiteUrl();
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}
