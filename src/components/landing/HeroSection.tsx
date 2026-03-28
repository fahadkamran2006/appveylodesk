import { useRef, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, CheckCircle2, Shield } from "lucide-react";
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
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
  const springY = useSpring(dashboardY, { stiffness: 100, damping: 30 });
  const springScale = useSpring(dashboardScale, { stiffness: 100, damping: 30 });

  // Mouse parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const { clientX, clientY, currentTarget } = e;
    const target = currentTarget as HTMLElement;
    if (!target) return;
    const { width, height } = target.getBoundingClientRect();
    // Normalize to -1 to 1
    const nx = (clientX / width - 0.5) * 2;
    const ny = (clientY / height - 0.5) * 2;
    mouseX.set(nx);
    mouseY.set(ny);
  }, [mouseX, mouseY]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => handleMouseMove(e);
    el.addEventListener("mousemove", handler, { passive: true });
    return () => el.removeEventListener("mousemove", handler);
  }, [handleMouseMove]);

  // Parallax layers with different intensities
  const orbX1 = useSpring(useTransform(mouseX, [-1, 1], [30, -30]), { stiffness: 50, damping: 20 });
  const orbY1 = useSpring(useTransform(mouseY, [-1, 1], [20, -20]), { stiffness: 50, damping: 20 });
  const orbX2 = useSpring(useTransform(mouseX, [-1, 1], [-20, 20]), { stiffness: 40, damping: 25 });
  const orbY2 = useSpring(useTransform(mouseY, [-1, 1], [-15, 15]), { stiffness: 40, damping: 25 });
  const shapeX1 = useSpring(useTransform(mouseX, [-1, 1], [15, -15]), { stiffness: 60, damping: 20 });
  const shapeY1 = useSpring(useTransform(mouseY, [-1, 1], [10, -10]), { stiffness: 60, damping: 20 });
  const shapeX2 = useSpring(useTransform(mouseX, [-1, 1], [-12, 12]), { stiffness: 45, damping: 22 });
  const shapeY2 = useSpring(useTransform(mouseY, [-1, 1], [-8, 8]), { stiffness: 45, damping: 22 });

  // Scroll-based parallax for orbs
  const scrollOrbY1 = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const scrollOrbY2 = useTransform(scrollYProgress, [0, 1], [0, -150]);

  return (
    <section ref={sectionRef} className="relative min-h-screen flex items-start justify-center pt-24">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      
      {/* Ambient orbs — mouse + scroll parallax */}
      <motion.div 
        style={{ x: orbX1, y: orbY1, translateY: scrollOrbY1 }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-glow animate-pulse-glow" 
      />
      <motion.div 
        style={{ x: orbX2, y: orbY2, translateY: scrollOrbY2 }}
        className="absolute top-40 left-20 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] animate-float" 
      />

      {/* Floating shapes — mouse parallax */}
      <motion.div
        style={{ x: shapeX1, y: shapeY1 }}
        className="absolute top-32 right-[15%] opacity-20 hidden md:block"
      >
        <Float3D amplitude={15} duration={8}>
          <div className="w-16 h-16 rounded-xl border border-primary/30 rotate-45" />
        </Float3D>
      </motion.div>
      <motion.div
        style={{ x: shapeX2, y: shapeY2 }}
        className="absolute top-[60%] left-[10%] opacity-15 hidden md:block"
      >
        <Float3D amplitude={20} duration={10}>
          <div className="w-12 h-12 rounded-full border border-indigo-soft/30" />
        </Float3D>
      </motion.div>

      <div className="container relative z-10 mx-auto px-6 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-[2.5rem] leading-[1.1] sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
          >
            Your Clients Deserve Better{" "}
            <span className="text-gradient">Than a Google Drive Link.</span>
          </motion.h1>

          {/* Sub */}
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

          {/* Trust */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-muted-foreground"
          >
            <span className="flex items-center gap-1.5 text-warning font-semibold">
              ⚠ {SPOTS_REMAINING} of 50 spots remaining. Price doubles when they're gone.
            </span>
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
