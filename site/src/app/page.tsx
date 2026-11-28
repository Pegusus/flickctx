import { Hero } from "@/components/Hero";
import {
  ArchitectureSection,
  DesktopSection,
  HowSection,
  InstallSection,
  SessionsSection,
  SiteFooter,
  UseCasesSection,
} from "@/components/Sections";
import { SiteHeader } from "@/components/SiteHeader";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <HowSection />
        <UseCasesSection />
        <ArchitectureSection />
        <SessionsSection />
        <InstallSection />
        <DesktopSection />
      </main>
      <SiteFooter />
    </>
  );
}