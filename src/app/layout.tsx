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
    statusBarStyle: "black-translucent",
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
  // The prompter puts controls against the bottom edge on phones.
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
