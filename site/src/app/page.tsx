import { Hero } from "@/components/Hero";
import {
  ConfigSection,
  CrossSection,
  DesktopSection,
  HowSection,
  InstallSection,
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
      <main>
        <Hero />
        <HowSection />
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
