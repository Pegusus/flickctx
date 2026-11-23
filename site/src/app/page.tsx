import { Hero } from "@/components/Hero";
import {
  ConfigSection,
  CrossSection,
  DesktopSection,
  HowSection,
  InstallSection,
  SessionsSection,
  SiteFooter,
  SkillsSection,
  ToolsSection,
  VisionSection,
} from "@/components/Sections";
import { SiteHeader } from "@/components/SiteHeader";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <HowSection />
        <SessionsSection />
        <VisionSection />
        <CrossSection />
        <SkillsSection />
        <ToolsSection />
        <ConfigSection />
        <DesktopSection />
        <InstallSection />
      </main>
      <SiteFooter />
    </>
  );
}
