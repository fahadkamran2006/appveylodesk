import { useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, CheckCircle2 } from "lucide-react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { AnimatedCounter, TextReveal, CharReveal, TiltCard, Float3D } from "./ScrollAnimations";

const HeroSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Dashboard transforms on scroll
  const dashboardY = useTransform(scrollYProgress, [0, 0.5], [0, -80]);
  const dashboardScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.92]);
  const dashboardRotateX = useTransform(scrollYProgress, [0, 0.3], [0, 5]);
  const perspective = useTransform(scrollYProgress, [0, 0.5], [1200, 800]);
  
  // Light mode transition on scroll — starts later, transitions over a comfortable range
  const lightOpacity = useTransform(scrollYProgress, [0.15, 0.45], [0, 1]);
  const darkOpacity = useTransform(scrollYProgress, [0.15, 0.45], [1, 0]);
  
  // Parallax for glow orbs
  const orbY1 = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const orbY2 = useTransform(scrollYProgress, [0, 1], [0, -150]);
  
  // Spring for smooth motion
  const springY = useSpring(dashboardY, { stiffness: 100, damping: 30 });
  const springScale = useSpring(dashboardScale, { stiffness: 100, damping: 30 });

  return (
    <section ref={sectionRef} className="relative min-h-[140vh] flex items-start justify-center overflow-hidden pt-24">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      
      {/* Animated glow orbs with parallax */}
      <motion.div 
        style={{ y: orbY1 }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-gradient-glow animate-pulse-glow" 
      />
      <motion.div 
        style={{ y: orbY2 }}
        className="absolute top-40 left-20 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] animate-float" 
      />
      <div className="absolute bottom-40 right-20 w-[600px] h-[600px] bg-indigo-soft/5 rounded-full blur-[150px] animate-float" style={{ animationDelay: "2s" }} />
      
      {/* 3D floating geometric shapes */}
      <Float3D className="absolute top-32 right-[15%] opacity-20" amplitude={15} duration={8}>
        <div className="w-16 h-16 rounded-xl border border-primary/30 rotate-45" />
      </Float3D>
      <Float3D className="absolute top-[60%] left-[10%] opacity-15" amplitude={20} duration={10}>
        <div className="w-12 h-12 rounded-full border border-indigo-soft/30" />
      </Float3D>
      <Float3D className="absolute top-[45%] right-[8%] opacity-10" amplitude={12} duration={7}>
        <div className="w-20 h-20 rounded-2xl border border-primary/20 rotate-12" />
      </Float3D>

      <div className="container relative z-10 mx-auto px-6 py-32">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20 mb-10"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium text-primary tracking-wide">
              Built for Video Agencies
            </span>
          </motion.div>

          {/* Headline with character reveal */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[0.95] tracking-tighter mb-8"
          >
            <TextReveal staggerDelay={0.04}>Run Your Agency From</TextReveal>{" "}
            <span className="text-gradient">
              <CharReveal staggerDelay={0.03}>One Command Center</CharReveal>
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6, ease: "easeOut" }}
            className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-14 leading-relaxed"
          >
            Stop managing chaos. Start scaling. Manage{" "}
            <span className="text-foreground font-medium">Clients</span>,{" "}
            <span className="text-foreground font-medium">Editors</span>, and{" "}
            <span className="text-foreground font-medium">Projects</span> in one tab.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-16"
          >
            <Button variant="hero" size="xl" className="btn-glow" asChild>
              <Link to="/pricing">
                Start Scaling Today
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="hero-outline" size="xl" asChild>
              <Link to="/auth/login">
                <Play className="w-5 h-5" />
                Watch Demo
              </Link>
            </Button>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
            className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Unlimited team members</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>14-day money-back guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Cancel anytime</span>
            </div>
          </motion.div>
        </div>

        {/* Dashboard Preview with 3D scroll transform */}
        <motion.div
          ref={dashboardRef}
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.9, ease: "easeOut" }}
          className="mt-24 max-w-6xl mx-auto"
          style={{ 
            y: springY, 
            scale: springScale,
          }}
        >
          <TiltCard intensity={5} className="relative">
            {/* Massive Glow Effect */}
            <div className="absolute -inset-8 bg-gradient-to-r from-primary/30 via-indigo-soft/20 to-primary/30 rounded-3xl blur-3xl opacity-50" />
            <div className="absolute -inset-4 bg-gradient-glow rounded-3xl opacity-60" />
            
            {/* Dashboard Card */}
            <div className="relative glass-card-premium rounded-3xl p-3 overflow-hidden" style={{ perspective: "1200px" }}>
              <motion.div 
                className="rounded-2xl overflow-hidden relative"
                style={{ rotateX: dashboardRotateX }}
              >
                {/* DARK MODE Dashboard */}
                <motion.div style={{ opacity: darkOpacity }} className="bg-midnight-deep">
                  {/* Browser Chrome */}
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-destructive/60" />
                      <div className="w-3 h-3 rounded-full bg-warning/60" />
                      <div className="w-3 h-3 rounded-full bg-success/60" />
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="px-5 py-1.5 rounded-lg bg-muted/30 text-xs text-muted-foreground border border-white/[0.04]">
                        app.veylodesk.com/admin/dashboard
                      </div>
                    </div>
                  </div>
                  
                  {/* Dashboard Content - Dark */}
                  <div className="p-8 min-h-[450px] bg-gradient-cinematic">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-semibold text-foreground">Command Center</h3>
                        <p className="text-sm text-muted-foreground mt-1">Welcome back, Agency Owner</p>
                      </div>
                      <div className="flex gap-3">
                        <div className="px-4 py-2 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium">
                          <AnimatedCounter target={5} /> Active Projects
                        </div>
                      </div>
                    </div>

                    {/* Stats Cards with animated numbers */}
                    <div className="grid grid-cols-3 gap-5 mb-8">
                      <div className="glass-card-premium rounded-2xl p-5">
                        <p className="text-sm text-muted-foreground mb-2">Total Revenue</p>
                        <p className="text-3xl font-bold text-foreground">
                          <AnimatedCounter target={47280} prefix="$" duration={2.5} />
                        </p>
                        <p className="text-xs text-success mt-1">+12% this month</p>
                      </div>
                      <div className="glass-card-premium rounded-2xl p-5">
                        <p className="text-sm text-muted-foreground mb-2">Active Clients</p>
                        <p className="text-3xl font-bold text-foreground">
                          <AnimatedCounter target={18} duration={1.5} />
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">3 pending invites</p>
                      </div>
                      <div className="glass-card-premium rounded-2xl p-5">
                        <p className="text-sm text-muted-foreground mb-2">Pending Invoices</p>
                        <p className="text-3xl font-bold text-foreground">
                          <AnimatedCounter target={8450} prefix="$" duration={2} />
                        </p>
                        <p className="text-xs text-warning mt-1">4 awaiting payment</p>
                      </div>
                    </div>

                    {/* Kanban Preview */}
                    <div className="grid grid-cols-4 gap-4">
                      {["Backlog", "In Progress", "Review", "Done"].map((status, i) => (
                        <div key={status} className="glass rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-4">
                            <div className={`w-2 h-2 rounded-full ${
                              i === 0 ? "bg-muted-foreground" :
                              i === 1 ? "bg-primary" :
                              i === 2 ? "bg-warning" : "bg-success"
                            }`} />
                            <span className="text-sm font-medium text-foreground">{status}</span>
                          </div>
                          <div className="space-y-3">
                            {[...Array(i === 1 ? 2 : 1)].map((_, j) => (
                              <div key={j} className="p-3 rounded-lg bg-midnight-deep/60 border border-white/[0.04]">
                                <div className="h-2 w-3/4 bg-muted/40 rounded mb-2" />
                                <div className="h-2 w-1/2 bg-muted/20 rounded" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* LIGHT MODE Dashboard (overlaid, fades in on scroll) */}
                <motion.div 
                  style={{ opacity: lightOpacity }} 
                  className="absolute inset-0 bg-[hsl(220,20%,97%)]"
                >
                  {/* Browser Chrome - Light */}
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-[hsl(220,13%,90%)]">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="px-5 py-1.5 rounded-lg bg-[hsl(220,14%,94%)] text-xs text-[hsl(220,8%,46%)] border border-[hsl(220,13%,90%)]">
                        app.veylodesk.com/admin/dashboard
                      </div>
                    </div>
                  </div>
                  
                  {/* Dashboard Content - Light */}
                  <div className="p-8 min-h-[450px] bg-[hsl(220,20%,97%)]">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-semibold text-[hsl(220,15%,12%)]">Command Center</h3>
                        <p className="text-sm text-[hsl(220,8%,46%)] mt-1">Welcome back, Agency Owner</p>
                      </div>
                      <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-medium">
                        5 Active Projects
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-5 mb-8">
                      <div className="bg-white rounded-2xl p-5 border border-[hsl(220,13%,90%)] shadow-sm">
                        <p className="text-sm text-[hsl(220,8%,46%)] mb-2">Total Revenue</p>
                        <p className="text-3xl font-bold text-[hsl(220,15%,12%)]">$47,280</p>
                        <p className="text-xs text-emerald-600 mt-1">+12% this month</p>
                      </div>
                      <div className="bg-white rounded-2xl p-5 border border-[hsl(220,13%,90%)] shadow-sm">
                        <p className="text-sm text-[hsl(220,8%,46%)] mb-2">Active Clients</p>
                        <p className="text-3xl font-bold text-[hsl(220,15%,12%)]">18</p>
                        <p className="text-xs text-[hsl(220,8%,46%)] mt-1">3 pending invites</p>
                      </div>
                      <div className="bg-white rounded-2xl p-5 border border-[hsl(220,13%,90%)] shadow-sm">
                        <p className="text-sm text-[hsl(220,8%,46%)] mb-2">Pending Invoices</p>
                        <p className="text-3xl font-bold text-[hsl(220,15%,12%)]">$8,450</p>
                        <p className="text-xs text-amber-600 mt-1">4 awaiting payment</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      {["Backlog", "In Progress", "Review", "Done"].map((status, i) => (
                        <div key={status} className="bg-[hsl(220,14%,96%)] rounded-xl p-4 border border-[hsl(220,13%,90%)]">
                          <div className="flex items-center gap-2 mb-4">
                            <div className={`w-2 h-2 rounded-full ${
                              i === 0 ? "bg-gray-400" :
                              i === 1 ? "bg-indigo-500" :
                              i === 2 ? "bg-amber-500" : "bg-emerald-500"
                            }`} />
                            <span className="text-sm font-medium text-[hsl(220,15%,12%)]">{status}</span>
                          </div>
                          <div className="space-y-3">
                            {[...Array(i === 1 ? 2 : 1)].map((_, j) => (
                              <div key={j} className="p-3 rounded-lg bg-white border border-[hsl(220,13%,90%)]">
                                <div className="h-2 w-3/4 bg-[hsl(220,14%,92%)] rounded mb-2" />
                                <div className="h-2 w-1/2 bg-[hsl(220,14%,95%)] rounded" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </TiltCard>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
