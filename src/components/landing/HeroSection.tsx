import { useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, CheckCircle2, Shield } from "lucide-react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { AnimatedCounter, TiltCard, Float3D } from "./ScrollAnimations";
import HeroDashboardPreview from "./HeroDashboardPreview";

const SPOTS_REMAINING = 50; // ← Update this number as spots are claimed

const HeroSection = () => {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const dashboardY = useTransform(scrollYProgress, [0, 0.5], [0, -80]);
  const dashboardScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.92]);
  const orbY1 = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const orbY2 = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const springY = useSpring(dashboardY, { stiffness: 100, damping: 30 });
  const springScale = useSpring(dashboardScale, { stiffness: 100, damping: 30 });

  return (
    <section ref={sectionRef} className="relative min-h-screen flex items-start justify-center pt-24">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      
      {/* Ambient orbs */}
      <motion.div 
        style={{ y: orbY1 }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-glow animate-pulse-glow" 
      />
      <motion.div 
        style={{ y: orbY2 }}
        className="absolute top-40 left-20 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] animate-float" 
      />

      {/* Floating shapes */}
      <Float3D className="absolute top-32 right-[15%] opacity-20 hidden md:block" amplitude={15} duration={8}>
        <div className="w-16 h-16 rounded-xl border border-primary/30 rotate-45" />
      </Float3D>
      <Float3D className="absolute top-[60%] left-[10%] opacity-15 hidden md:block" amplitude={20} duration={10}>
        <div className="w-12 h-12 rounded-full border border-indigo-soft/30" />
      </Float3D>

      <div className="container relative z-10 mx-auto px-6 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Headline — short, punchy, no clip */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-[2.5rem] leading-[1.1] sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
          >
            Your Clients Deserve Better{" "}
            <span className="text-gradient">Than a Google Drive Link.</span>
          </motion.h1>

          {/* Sub — concise, one breath */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Veylodesk gives your agency a white-labeled client portal, frame-accurate
            video approvals, and a pay-to-download system that makes chasing invoices
            a thing of the past — all in one tab.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
          >
            <Button variant="hero" size="xl" className="btn-glow cta-pulse" asChild>
              <Link to="/founding-members">
                Claim Your Founding Member Spot →
              </Link>
            </Button>
            <Button variant="hero-outline" size="xl" asChild>
              <Link to="#demo">
                <Play className="w-5 h-5" />
                Watch Demo
              </Link>
            </Button>
          </motion.div>

        </div>

        {/* Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
          className="mt-16 md:mt-24 max-w-6xl mx-auto"
          style={{ y: springY, scale: springScale }}
        >
          <HeroDashboardPreview scrollYProgress={scrollYProgress} />
        </motion.div>
      </div>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/90 backdrop-blur-xl border-t border-border/20 md:hidden safe-area-bottom">
        <Button variant="hero" size="lg" className="w-full cta-pulse" asChild>
          <Link to="/founding-members">
            Claim Your Founding Member Spot →
          </Link>
        </Button>
      </div>
    </section>
  );
};

export default HeroSection;
