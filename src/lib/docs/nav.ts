export type DocAudience = "user" | "developer";

export type DocLink = {
  slug: string;
  title: string;
  summary: string;
};

export type DocSection = {
  title: string;
  audience: DocAudience;
  pages: DocLink[];
};

/**
 * The single source of truth for the documentation: the sidebar, the index
 * page, the previous/next links and the sitemap all read this list, so a new
 * page appears everywhere the moment it is added here.
 *
 * `audience` is the split between the pages someone reads to *use* Teleprompt
 * and the pages someone reads to *run or change* it. The two are kept apart on
 * purpose: a presenter looking up a keyboard shortcut should never have to
 * scroll past a Postgres connection string to find it. The user sections come
 * first, and every developer section follows them.
 */
export const DOC_SECTIONS: DocSection[] = [
  {
    title: "Getting started",
    audience: "user",
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
    audience: "user",
    pages: [
      {
        slug: "writing-scripts",
        title: "Writing scripts",
        summary:
          "The Markdown you can use, how a script is broken into blocks, and cues.",
      },
      {
        slug: "folders-and-sharing",
        title: "Folders and sharing",
        summary:
          "Organise scripts into folders, and give other people view-only or editing access by email.",
      },
      {
        slug: "remote-control",
        title: "The remote",
        summary:
          "Play, pace, stepping, tap-to-jump and scrubbing: everything the phone can do.",
      },
      {
        slug: "display-settings",
        title: "Display settings",
        summary:
          "Type size, column width, the reading line, mirroring, and the three surfaces.",
      },
      {
        slug: "voice-tracking",
        title: "Voice tracking",
        summary:
          "The display listens, marks the words you have said, and scrolls to keep up.",
      },
    ],
  },
  {
    title: "Reference",
    audience: "user",
    pages: [
      {
        slug: "shortcuts",
        title: "Keyboard shortcuts",
        summary: "Every key the display responds to.",
      },
      {
        slug: "troubleshooting",
        title: "Troubleshooting",
        summary:
          "Relay instead of direct, a code that will not resolve, a display that will not wake.",
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
    title: "Self-hosting",
    audience: "developer",
    pages: [
      {
        slug: "self-hosting",
        title: "Running your own",
        summary:
          "Supabase, sign-in providers and environment variables, end to end.",
      },
      {
        slug: "deployment-troubleshooting",
        title: "Deployment troubleshooting",
        summary:
          "The health check, the IPv6 database endpoint, db:push crashes and sign-in that only fails in production.",
      },
    ],
  },
  {
    title: "Working on Teleprompt",
    audience: "developer",
    pages: [
      {
        slug: "architecture",
        title: "Architecture",
        summary:
          "How two devices stay on the same line: anchors, transports and the wire protocol.",
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

/** The sections written for people using Teleprompt, in sidebar order. */
export const USER_SECTIONS = DOC_SECTIONS.filter(
  (section) => section.audience === "user",
);

/** The sections written for people hosting or changing Teleprompt. */
export const DEVELOPER_SECTIONS = DOC_SECTIONS.filter(
  (section) => section.audience === "developer",
);

const AUDIENCE_BY_SLUG = new Map<string, DocAudience>(
  DOC_SECTIONS.flatMap((section) =>
    section.pages.map((page) => [page.slug, section.audience] as const),
  ),
);

/**
 * Previous/next stay inside one audience. Reading the user docs end to end
 * should not tip you into a Supabase setup guide, and the developer run ends
 * at the last developer page rather than looping back into presenter material.
 */
export function docNeighbours(slug: string) {
  const index = DOC_PAGES.findIndex((page) => page.slug === slug);
  if (index < 0) return { previous: undefined, next: undefined };

  const audience = AUDIENCE_BY_SLUG.get(slug);
  const sameAudience = (page: DocLink | undefined) =>
    page && AUDIENCE_BY_SLUG.get(page.slug) === audience ? page : undefined;

  return {
    previous: sameAudience(DOC_PAGES[index - 1]),
    next: sameAudience(DOC_PAGES[index + 1]),
  };
}

export function docBySlug(slug: string) {
  return DOC_PAGES.find((page) => page.slug === slug);
}
