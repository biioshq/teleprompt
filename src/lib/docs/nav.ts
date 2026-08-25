export type DocLink = {
  slug: string;
  title: string;
  summary: string;
};

export type DocSection = {
  title: string;
  pages: DocLink[];
};

/**
 * The single source of truth for the documentation: the sidebar, the index
 * page, the previous/next links and the sitemap all read this list, so a new
 * page appears everywhere the moment it is added here.
 */
export const DOC_SECTIONS: DocSection[] = [
  {
    title: "Getting started",
    pages: [
      {
        slug: "quickstart",
        title: "Quickstart",
        summary:
          "Write a script, open a room and drive it from your phone, in about three minutes.",
      },
      {
        slug: "connecting-devices",
        title: "Connecting devices",
        summary:
          "Rooms, join codes, roles, and what happens when more than two devices show up.",
      },
      {
        slug: "install",
        title: "Install as an app",
        summary:
          "Add Teleprompt to the home screen or dock on iOS, Android, macOS and Windows.",
      },
    ],
  },
  {
    title: "Using Teleprompt",
    pages: [
      {
        slug: "writing-scripts",
        title: "Writing scripts",
        summary:
          "The Markdown you can use, how a script is broken into blocks, and cues.",
      },
      {
        slug: "remote-control",
        title: "The remote",
        summary:
          "Play, pace, stepping, tap-to-jump and scrubbing — everything the phone can do.",
      },
      {
        slug: "display-settings",
        title: "Display settings",
        summary:
          "Type size, column width, the reading line, mirroring, and the three surfaces.",
      },
      {
        slug: "shortcuts",
        title: "Keyboard shortcuts",
        summary: "Every key the display responds to.",
      },
    ],
  },
  {
    title: "Under the hood",
    pages: [
      {
        slug: "architecture",
        title: "Architecture",
        summary:
          "How two devices stay on the same line: anchors, transports and the wire protocol.",
      },
      {
        slug: "privacy-and-data",
        title: "Privacy and data",
        summary:
          "Exactly what Teleprompt stores, where it stores it, and what it never sees.",
      },
    ],
  },
  {
    title: "Running it yourself",
    pages: [
      {
        slug: "self-hosting",
        title: "Self-hosting",
        summary:
          "Supabase, Google OAuth and environment variables, end to end.",
      },
      {
        slug: "troubleshooting",
        title: "Troubleshooting",
        summary:
          "Relay instead of direct, a code that will not resolve, a display that will not wake.",
      },
      {
        slug: "contributing",
        title: "Contributing",
        summary: "How the repository is laid out and how to send a change.",
      },
    ],
  },
];

export const DOC_PAGES: DocLink[] = DOC_SECTIONS.flatMap(
  (section) => section.pages,
);

export function docNeighbours(slug: string) {
  const index = DOC_PAGES.findIndex((page) => page.slug === slug);
  return {
    previous: index > 0 ? DOC_PAGES[index - 1] : undefined,
    next: index >= 0 ? DOC_PAGES[index + 1] : undefined,
  };
}

export function docBySlug(slug: string) {
  return DOC_PAGES.find((page) => page.slug === slug);
}
