import { AppHeader } from "~/components/app/app-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grain min-h-[100dvh]">
      <span aria-hidden className="grain-layer" />
      <AppHeader />
      {children}
    </div>
  );
}
