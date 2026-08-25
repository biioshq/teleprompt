import { type Metadata } from "next";

import { Faq } from "~/components/marketing/faq";
import {
  BiiosSection,
  Features,
  FinalCta,
  Hero,
  HowItWorks,
  InstallSection,
  OpenSourceSection,
  SyncExplainer,
  VoiceSection,
  WritingSection,
} from "~/components/marketing/sections";
import { SITE } from "~/lib/site";
import { auth } from "~/server/auth";

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  return (
    <>
      <Hero signedIn={signedIn} />
      <HowItWorks />
      <SyncExplainer />
      <VoiceSection />
      <Features />
      <WritingSection />
      <InstallSection />
      <OpenSourceSection />
      <BiiosSection />
      <Faq />
      <FinalCta signedIn={signedIn} />
    </>
  );
}
