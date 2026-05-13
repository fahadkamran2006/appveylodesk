import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef, Suspense } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowUpRight, Globe, Sparkles, Users, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { HeroScene } from "@/components/about/HeroScene";

const fadeUp = {
  hidden: { opacity: 0, y: 40 } as const,
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.85 } as const,
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.15, duration: 0.9, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const values = [
  { icon: Zap, title: "Speed over perfection", desc: "Ship fast, iterate faster. Your agency can't wait for perfection." },
  { icon: Shield, title: "Trust is everything", desc: "Your clients trust you with their brand. We built security into our DNA." },
  { icon: Users, title: "Built for teams", desc: "Every feature is designed for collaboration — not solo workflows." },
];

const About = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const valuesRef = useRef<HTMLDivElement>(null);

  // Hero parallax
  const { scrollYProgress: heroProgress } = useScroll({ target: containerRef, offset: ["start start", "0.3 start"] });
  const heroY = useSpring(useTransform(heroProgress, [0, 1], [0, 120]), { stiffness: 100, damping: 30 });
  const heroScale = useTransform(heroProgress, [0, 1], [1, 0.9]);
  const heroOpacity = useTransform(heroProgress, [0, 0.8], [1, 0]);

  // Story section parallax
  const { scrollYProgress: storyProgress } = useScroll({ target: storyRef, offset: ["start end", "end start"] });
  const storyImageY = useSpring(useTransform(storyProgress, [0, 1], [60, -60]), { stiffness: 80, damping: 25 });
  const storyTextY = useSpring(useTransform(storyProgress, [0, 1], [40, -40]), { stiffness: 80, damping: 25 });

  // Values parallax
  const { scrollYProgress: valuesProgress } = useScroll({ target: valuesRef, offset: ["start end", "center center"] });
  const valuesScale = useTransform(valuesProgress, [0, 1], [0.92, 1]);

  return (
    <div ref={containerRef} className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Helmet>
        <title>About Us — Veylodesk | Built by Agency Owners</title>
        <meta name="description" content="Meet the founder of Veylodesk — Fahad Kamran, a video editing agency owner who built the tool he wished existed." />
        <link rel="canonical" href="https://veylodesk.com/about" />
        <meta property="og:title" content="About Us — Veylodesk" />
        <meta property="og:description" content="Meet Fahad Kamran, the agency owner who built Veylodesk." />
        <meta property="og:url" content="https://veylodesk.com/about" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Person",
          "name": "Fahad Kamran",
          "jobTitle": "Founder",
          "worksFor": { "@type": "Organization", "name": "Veylodesk", "url": "https://veylodesk.com" },
          "url": "https://veylodesk.com/about"
        })}</script>
      </Helmet>

      <Navbar />

      {/* ── Hero with 3D Scene ── */}
      <section className="relative min-h-[90vh] md:min-h-screen flex items-center justify-center overflow-hidden">
        {/* 3D Background */}
        <Suspense fallback={null}>
          <HeroScene />
        </Suspense>

        {/* Gradient overlays for readability */}
        <div className="absolute inset-0 z-[1] pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/30 via-transparent to-background/30" />
        </div>

        <motion.div
          style={{ y: heroY, scale: heroScale, opacity: heroOpacity }}
          className="relative z-10 container mx-auto px-6 text-center max-w-4xl"
        >
          <motion.div
            initial="hidden" animate="visible" variants={fadeUp} custom={0}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-10 backdrop-blur-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            The story behind Veylodesk
          </motion.div>

          <motion.h1
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-7"
          >
            This wasn't built
            <br className="hidden sm:block" />
            <span className="text-gradient">in a boardroom.</span>
          </motion.h1>

          <motion.p
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Every feature exists because I personally felt that pain. This isn't
            a product built for a market. It's a product built from the trenches.
          </motion.p>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="mt-16 flex flex-col items-center gap-2"
          >
            <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50">Scroll to explore</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="w-5 h-8 rounded-full border-2 border-muted-foreground/20 flex items-start justify-center p-1"
            >
              <motion.div className="w-1 h-2 rounded-full bg-primary/60" />
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Founder Story — Parallax Split ── */}
      <section ref={storyRef} className="py-24 md:py-40 relative">
        {/* Subtle grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{ backgroundImage: "linear-gradient(hsl(var(--primary)/0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.4) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />

        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-12 md:gap-20 items-center max-w-6xl mx-auto">
            {/* Image — parallax layer */}
            <motion.div
              style={{ y: storyImageY }}
              className="md:col-span-2 relative"
            >
              <motion.div
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
                variants={scaleIn} custom={0}
                className="relative group"
              >
                <div className="aspect-[3/4] rounded-3xl overflow-hidden relative bg-card border border-border/30">
                  {/* Gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-primary/5" />
                  {/* Content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.div
                      className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-gradient-to-br from-primary/25 to-primary/10 border border-primary/30 flex items-center justify-center mb-5"
                      style={{ boxShadow: "0 0 80px -20px hsl(var(--primary) / 0.4)" }}
                      whileHover={{ scale: 1.08, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    >
                      <span className="text-5xl md:text-6xl font-bold text-primary select-none">FK</span>
                    </motion.div>
                    <p className="text-xl font-bold text-foreground tracking-tight">Fahad Kamran</p>
                    <p className="text-sm text-primary/70 font-medium mt-1 tracking-wide uppercase">Founder & CEO</p>
                  </div>
                </div>
                {/* Glow */}
                <div className="absolute -inset-8 rounded-[2rem] bg-primary/[0.03] blur-3xl -z-10 group-hover:bg-primary/[0.07] transition-colors duration-1000" />
              </motion.div>
            </motion.div>

            {/* Story text — parallax layer */}
            <motion.div
              style={{ y: storyTextY }}
              className="md:col-span-3"
            >
              <motion.div
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
                className="space-y-7"
              >
                <motion.span variants={fadeUp} custom={0} className="text-xs font-semibold tracking-[0.2em] uppercase text-primary/60 block">
                  The founder's story
                </motion.span>

                <motion.p variants={fadeUp} custom={1} className="text-xl md:text-2xl text-foreground font-medium leading-relaxed">
                  My name is <span className="text-gradient font-bold">Fahad Kamran</span>.
                </motion.p>

                <motion.p variants={fadeUp} custom={2} className="text-base md:text-lg text-foreground/70 leading-[1.85]">
                  I'm 19, I'm from Pakistan, and I spent two years running a video editing agency called <span className="text-foreground font-medium">Videoflickz</span>. The work was great. The operations were a disaster.
                </motion.p>

                <motion.p variants={fadeUp} custom={3} className="text-base md:text-lg text-foreground/70 leading-[1.85]">
                  I was losing money to unpaid invoices, losing time to scattered feedback, and losing clients to a process that felt unprofessional — even when the edits were <span className="text-foreground font-semibold">world-class</span>.
                </motion.p>

                <motion.p variants={fadeUp} custom={4} className="text-base md:text-lg text-foreground/70 leading-[1.85]">
                  I built Veylodesk to solve my own problems. Every feature exists because I personally felt that pain. This isn't a product built for a market. It's a product built <span className="text-gradient font-bold">from the trenches</span>.
                </motion.p>

                {/* Founder link card */}
                <motion.div variants={fadeUp} custom={5} className="pt-6">
                  <motion.a
                    href="https://fahadkamran.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="group/card inline-flex items-center gap-4 px-6 py-4 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-500 shadow-sm hover:shadow-[0_12px_50px_-15px_hsl(var(--primary)/0.2)]"
                  >
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover/card:bg-primary/20 transition-colors">
                      <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">fahadkamran.com</p>
                      <p className="text-xs text-muted-foreground">Explore more from the founder</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover/card:text-primary group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5 transition-all" />
                  </motion.a>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Values — Scale on Scroll ── */}
      <section ref={valuesRef} className="py-24 md:py-32 border-t border-border/15 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-primary/[0.04] blur-[150px] pointer-events-none" />

        <motion.div style={{ scale: valuesScale }} className="container mx-auto px-6 max-w-5xl relative z-10">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="text-center mb-16"
          >
            <motion.span variants={fadeUp} custom={0} className="text-xs font-semibold tracking-[0.2em] uppercase text-primary/60 block mb-4">What drives us</motion.span>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-5xl font-bold tracking-tight">
              Principles, not promises.
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-6"
          >
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                variants={scaleIn}
                custom={i}
                whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 20 } }}
                className="group relative p-8 rounded-2xl bg-card border border-border/40 hover:border-primary/25 transition-all duration-500 hover:shadow-[0_12px_50px_-15px_hsl(var(--primary)/0.12)]"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                  <v.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Mission CTA ── */}
      <section className="py-24 md:py-36">
        <div className="container mx-auto px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="relative max-w-4xl mx-auto text-center rounded-3xl border border-border/20 bg-card p-12 md:p-20 overflow-hidden"
          >
            {/* Glows */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-primary/[0.06] blur-[120px]" />
              <div className="absolute bottom-0 right-0 w-[300px] h-[200px] rounded-full bg-primary/[0.04] blur-[80px]" />
            </div>

            <div className="relative z-10">
              <motion.span variants={fadeUp} custom={0} className="text-xs font-semibold tracking-[0.2em] uppercase text-primary/60 block mb-6">Our Mission</motion.span>
              <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
                Give every creative agency the{" "}
                <span className="text-gradient">operational backbone</span>{" "}
                of a billion-dollar company.
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-muted-foreground text-lg max-w-xl mx-auto mb-10 leading-relaxed">
                From a solo editor in Lahore to a 50-person studio in LA. No bloat. No BS. Just results.
              </motion.p>
              <motion.div variants={fadeUp} custom={3}>
                <Button variant="hero" size="xl" className="cta-pulse" asChild>
                  <Link to="/pricing">Start for free →</Link>
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
