import { Hero } from "@/components/Hero";
import {
  ArchitectureSection,
  ConfigSection,
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
        <ConfigSection />
        <InstallSection />
      </main>
      <SiteFooter />
    </>
  );
}
