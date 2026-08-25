import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import {
  Bebas_Neue,
  Familjen_Grotesk,
  JetBrains_Mono,
  Plus_Jakarta_Sans,
} from "next/font/google";

import { SITE } from "~/lib/site";
import { getSiteUrl } from "~/lib/url";
import { ServiceWorker } from "~/components/pwa/service-worker";
import { TRPCReactProvider } from "~/trpc/react";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const familjen = Familjen_Grotesk({
  subsets: ["latin"],
  variable: "--font-familjen",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  manifest: "/manifest.webmanifest",
  keywords: [
    "teleprompter",
    "peer to peer teleprompter",
    "phone teleprompter remote",
    "open source teleprompter",
    "markdown teleprompter",
    "PWA teleprompter",
  ],
  authors: [{ name: "Biios", url: "https://biios.in" }],
  creator: "Biios",
  publisher: "Biios",
  openGraph: {
    type: "website",
    url: getSiteUrl(),
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  appleWebApp: {
    capable: true,
    title: SITE.name,
    /**
     * Not `black-translucent`, which was the original choice and was wrong.
     *
     * That style puts the page *under* the iOS status bar, so the clock and
     * the carrier indicators sit on top of whatever is at the top of the page
     * unless every surface pads itself by `safe-area-inset-top`. It also paints
     * the status bar text white, which is invisible on this app's paper
     * background - and most of the app, the dashboard and the editor included,
     * is on paper.
     *
     * `default` has iOS reserve the bar and start the page below it. The
     * prompter gives up going edge-to-edge under the clock, which the
     * fullscreen button covers properly anyway.
     */
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff9f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
  width: "device-width",
  initialScale: 1,
  /**
   * Still needed with `statusBarStyle: "default"`: the top inset goes to zero
   * because iOS reserves the bar, but the home indicator and, in landscape,
   * the notch are the app's problem either way.
   */
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${familjen.variable} ${jetbrains.variable} ${bebas.variable}`}
    >
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
