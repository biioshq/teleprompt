import { ImageResponse } from "next/og";

import { SITE } from "~/lib/site";

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Satori cannot read woff2, which is the only format `next/font` keeps, so the
 * brand face is pulled as a TTF at render time. If that fetch fails the card
 * still renders in the built-in face — an off-brand card beats a broken one.
 */
async function loadFont(family: string, weight: number) {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`;
    const css = await fetch(cssUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(4000),
    }).then((response) => response.text());

    const match = /src:\s*url\((https:\/\/[^)]+\.ttf)\)/.exec(css);
    if (!match?.[1]) return null;

    const data = await fetch(match[1], {
      signal: AbortSignal.timeout(4000),
    }).then((response) => response.arrayBuffer());
    return data;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const [display, mono] = await Promise.all([
    loadFont("Familjen+Grotesk", 600),
    loadFont("JetBrains+Mono", 500),
  ]);

  const fonts = [
    display && {
      name: "Familjen Grotesk",
      data: display,
      weight: 600 as const,
      style: "normal" as const,
    },
    mono && {
      name: "JetBrains Mono",
      data: mono,
      weight: 500 as const,
      style: "normal" as const,
    },
  ].filter(Boolean) as {
    name: string;
    data: ArrayBuffer;
    weight: 600 | 500;
    style: "normal";
  }[];

  const displayFamily = display ? "Familjen Grotesk" : "sans-serif";
  const monoFamily = mono ? "JetBrains Mono" : "monospace";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#1a1a1b",
        padding: "72px 80px",
        fontFamily: displayFamily,
      }}
    >
      {/* Mark ---------------------------------------------------------- */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 16,
            background: "#0b0b0c",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 7,
            padding: "0 12px",
          }}
        >
          <div
            style={{
              width: 26,
              height: 6,
              borderRadius: 3,
              background: "rgba(255,249,244,0.4)",
            }}
          />
          <div
            style={{
              width: 50,
              height: 8,
              borderRadius: 4,
              background: "#ff8800",
            }}
          />
          <div
            style={{
              width: 17,
              height: 6,
              borderRadius: 3,
              background: "rgba(255,249,244,0.4)",
            }}
          />
        </div>
        <div
          style={{
            fontSize: 34,
            color: "#fff9f4",
            letterSpacing: "-0.035em",
          }}
        >
          teleprompt
        </div>
      </div>

      {/* Headline ------------------------------------------------------ */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 92,
            lineHeight: 1.02,
            color: "#fff9f4",
            letterSpacing: "-0.035em",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>Your script,</span>
          {/* Satori lays every element out as flex and drops the whitespace
              between inline children, so the spaces have to be a gap. */}
          <span style={{ display: "flex", gap: "0.26em" }}>
            <span>on</span>
            <span style={{ color: "#ff8800" }}>both</span>
            <span>screens.</span>
          </span>
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 27,
            color: "rgba(255,249,244,0.55)",
            maxWidth: 860,
            lineHeight: 1.4,
          }}
        >
          A peer-to-peer teleprompter. One device shows the words, another
          drives them.
        </div>
      </div>

      {/* Footer -------------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: monoFamily,
          fontSize: 19,
          color: "rgba(255,249,244,0.4)",
          letterSpacing: "0.1em",
        }}
      >
        <span>BUILT WITH {"<3"} BY BIIOS FOR THE COMMUNITY</span>
        <span style={{ color: "#ff8800" }}>MIT · OPEN SOURCE</span>
      </div>
    </div>,
    { ...size, fonts: fonts.length > 0 ? fonts : undefined },
  );
}
