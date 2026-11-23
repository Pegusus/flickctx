import { Hero } from "@/components/Hero";
import {
  ArchitectureSection,
  DesktopSection,
  HowSection,
  InstallSection,
  SessionsSection,
  SiteFooter,
} from "@/components/Sections";
import { SiteHeader } from "@/components/SiteHeader";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <HowSection />
        <ArchitectureSection />
        <SessionsSection />
        <DesktopSection />
        <InstallSection />
      </main>
      <SiteFooter />
    </>
  );
}
