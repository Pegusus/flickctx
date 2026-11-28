import { Hero } from "@/components/Hero";
import {
  ArchitectureSection,
  CompareSection,
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
        <CompareSection />
        <ArchitectureSection />
        <SessionsSection />
        <InstallSection />
        <DesktopSection />
      </main>
      <SiteFooter />
    </>
  );
}