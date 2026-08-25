/** One place for the strings that appear in metadata, docs and the footer. */
export const SITE = {
  name: "Teleprompt",
  tagline: "Your script on both screens",
  description:
    "A peer-to-peer teleprompter. One device shows the words, another drives them. Write in Markdown, pair any two devices on your account, and present. Free, open source, installable.",
  repo: "https://github.com/biioshq/teleprompt",
  license: "MIT",
} as const;

export const BIIOS = {
  name: "Biios",
  url: "https://biios.in",
  tagline: "Building what's next.",
  mission:
    "We partner with ambitious founders to build, scale and grow businesses that create real impact.",
  city: "Pune, India",
  linkedin: "https://linkedin.com/company/biios",
  instagram: "https://instagram.com/biios.in",
  contact: "https://biios.in/contact",
  disciplines: [
    {
      name: "Strategy",
      detail: "Market research, positioning and go-to-market.",
    },
    { name: "Branding", detail: "Identity, storytelling and visual systems." },
    { name: "Digital", detail: "Websites, web apps and digital experiences." },
    { name: "Growth", detail: "Paid campaigns, SEO and growth marketing." },
  ],
  stats: [
    { value: "120+", label: "Projects delivered" },
    { value: "45+", label: "Industries served" },
    { value: "98%", label: "Client retention" },
    { value: "12+", label: "Countries reached" },
  ],
} as const;
