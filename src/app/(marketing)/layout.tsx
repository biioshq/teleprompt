import { SiteFooter } from "~/components/marketing/site-footer";
import { SiteHeader } from "~/components/marketing/site-header";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grain flex min-h-[100dvh] flex-col">
      <span aria-hidden className="grain-layer" />
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
