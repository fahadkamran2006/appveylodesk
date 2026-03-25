import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowUpRight, Command, Globe, Sparkles, Users, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const fadeUp = {
  hidden: { opacity: 0, y: 30 } as const,
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const values = [
  { icon: Zap, title: "Speed over perfection", desc: "Ship fast, iterate faster. Your agency can't wait for perfection." },
  { icon: Shield, title: "Trust is everything", desc: "Your clients trust you with their brand. We built security into our DNA." },
  { icon: Users, title: "Built for teams", desc: "Every feature is designed for collaboration — not solo workflows." },
];

const About = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Helmet>
        <title>About Us — Veylodesk | Built by Agency Owners</title>
        <meta name="description" content="Meet the founder of Veylodesk — Fahad Kamran, a video editing agency owner who built the tool he wished existed." />
      </Helmet>

      <Navbar />

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative pt-32 pb-24 md:pt-44 md:pb-36 overflow-hidden">
        {/* Layered ambient glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-primary/[0.07] blur-[150px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/[0.04] blur-[100px]" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(hsl(var(--primary)/0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.3) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="container mx-auto px-6 relative z-10 text-center max-w-4xl">
          <motion.div
            initial="hidden" animate="visible" variants={fadeUp} custom={0}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-10"
          >
            <Sparkles className="w-3.5 h-3.5" />
            The story behind Veylodesk
          </motion.div>

          <motion.h1
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-7"
          >
            Built by an agency owner,{" "}
            <br className="hidden sm:block" />
            <span className="text-gradient">for agency owners.</span>
          </motion.h1>

          <motion.p
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Veylodesk wasn't built in a boardroom. It was built in the trenches
            of the editing room to solve the exact bottlenecks holding creative
            agencies back.
          </motion.p>
        </motion.div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* ── Founder Story ── */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }}
            className="grid md:grid-cols-5 gap-12 md:gap-16 items-center max-w-6xl mx-auto"
          >
            {/* Image — 2 cols */}
            <motion.div variants={fadeUp} custom={0} className="md:col-span-2 relative group">
              <div className="aspect-[3/4] rounded-3xl overflow-hidden relative">
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-background" />
                {/* Subtle noise texture */}
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 256 256\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"n\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"4\"/%3E%3C/filter%3E%3Crect width=\"256\" height=\"256\" filter=\"url(%23n)\" opacity=\"0.5\"/%3E%3C/svg%3E')" }} />
                {/* Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.div
                    className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-gradient-to-br from-primary/25 to-primary/10 border border-primary/30 flex items-center justify-center mb-5 shadow-[0_0_60px_-15px_hsl(var(--primary)/0.4)]"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <span className="text-5xl md:text-6xl font-bold text-primary">FK</span>
                  </motion.div>
                  <p className="text-xl font-bold text-foreground tracking-tight">Fahad Kamran</p>
                  <p className="text-sm text-primary/80 font-medium mt-1 tracking-wide uppercase">Founder & CEO</p>
                </div>
                {/* Border overlay */}
                <div className="absolute inset-0 rounded-3xl border border-primary/10" />
              </div>
              {/* Glow */}
              <div className="absolute -inset-6 rounded-[2rem] bg-primary/[0.03] blur-3xl -z-10 group-hover:bg-primary/[0.06] transition-colors duration-1000" />
            </motion.div>

            {/* Story — 3 cols */}
            <div className="md:col-span-3 space-y-7">
              <motion.div variants={fadeUp} custom={0.5}>
                <span className="text-xs font-semibold tracking-[0.2em] uppercase text-primary/60">The founder's story</span>
              </motion.div>

              <motion.p variants={fadeUp} custom={1} className="text-xl md:text-2xl text-foreground font-medium leading-relaxed">
                Hi, I'm <span className="text-gradient font-bold">Fahad Kamran</span>.
              </motion.p>

              <motion.p variants={fadeUp} custom={2} className="text-base md:text-lg text-foreground/75 leading-[1.8]">
                I started my journey spending two years straight in the trenches creating documentaries and running my own video editing agency, <span className="text-foreground font-medium">Videoflickz</span>, right here in Pakistan.
              </motion.p>

              <motion.p variants={fadeUp} custom={3} className="text-base md:text-lg text-foreground/75 leading-[1.8]">
                By age 19, I realized the biggest roadblock to scaling wasn't finding clients or editing faster — it was the <span className="text-foreground font-semibold">absolute chaos</span> of managing files, tracking Slack messages, and chasing down invoice payments.
              </motion.p>

              <motion.p variants={fadeUp} custom={4} className="text-base md:text-lg text-foreground/75 leading-[1.8]">
                I built Veylodesk to replace the duct-taped mess of Google Drive, Frame.io, and spreadsheets with <span className="text-gradient font-bold">one single, ruthless system</span>.
              </motion.p>

              {/* Founder link — luxury style */}
              <motion.div variants={fadeUp} custom={5} className="pt-6">
                <a
                  href="https://fahadkamran.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/card inline-flex items-center gap-4 px-6 py-4 rounded-2xl bg-card border border-border/60 hover:border-primary/30 transition-all duration-500 hover:shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.15)]"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover/card:bg-primary/20 transition-colors">
                    <Globe className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">fahadkamran.com</p>
                    <p className="text-xs text-muted-foreground">Learn more about the founder</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover/card:text-primary group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5 transition-all" />
                </a>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="py-20 md:py-28 border-t border-border/20">
        <div className="container mx-auto px-6 max-w-5xl">
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
                variants={fadeUp}
                custom={i}
                className="group relative p-8 rounded-2xl bg-card border border-border/50 hover:border-primary/20 transition-all duration-500 hover:shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.1)]"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                  <v.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Mission CTA ── */}
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="relative max-w-4xl mx-auto text-center rounded-3xl border border-border/30 bg-card p-12 md:p-20 overflow-hidden"
          >
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-primary/[0.06] blur-[100px]" />
            </div>

            <div className="relative z-10">
              <motion.span variants={fadeUp} custom={0} className="text-xs font-semibold tracking-[0.2em] uppercase text-primary/60 block mb-6">Our Mission</motion.span>
              <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
                Give every creative agency the{" "}
                <span className="text-gradient">operational backbone</span> of a billion-dollar company.
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
