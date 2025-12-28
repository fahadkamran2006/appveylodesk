import { Helmet } from "react-helmet-async";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import ProblemSection from "@/components/landing/ProblemSection";
import SolutionSection from "@/components/landing/SolutionSection";
import PricingSection from "@/components/landing/PricingSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Veylodesk | The Command Center for Video Agencies</title>
        <meta
          name="description"
          content="Run your video agency from one command center. Manage clients, editors, and projects in one tab. Stop managing chaos. Start scaling."
        />
        <meta
          name="keywords"
          content="video agency, project management, client portal, video production, agency OS"
        />
        <link rel="canonical" href="https://veylodesk.com" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />
        <main>
          <HeroSection />
          <ProblemSection />
          <SolutionSection />
          <TestimonialsSection />
          <PricingSection />
          <CTASection />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
