import { Helmet } from "react-helmet-async";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import DemoVideoSection from "@/components/landing/DemoVideoSection";
import ProblemSection from "@/components/landing/ProblemSection";
import SolutionSection from "@/components/landing/SolutionSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Video Agency Management Software & Production CRM | Veylodesk</title>
        <meta
          name="description"
          content="Veylodesk is the video agency management software and video production CRM that replaces Trello, Frame.io, and invoice chasing — all in one tab."
        />
        <meta
          name="keywords"
          content="video agency management software, video production CRM, agency management software, video production software, client portal"
        />
        <link rel="canonical" href="https://veylodesk.com/" />
        <meta property="og:title" content="Video Agency Management Software & Production CRM | Veylodesk" />
        <meta property="og:description" content="The video agency management software and video production CRM that runs your whole studio in one tab." />
        <meta property="og:url" content="https://veylodesk.com/" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />
        <main>
          <HeroSection />
          <DemoVideoSection />
          <ProblemSection />
          <SolutionSection />
          <FeaturesSection />
          <TestimonialsSection />
          <CTASection />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
