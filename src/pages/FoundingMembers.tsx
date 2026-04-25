import { useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Command, Shield, MessageCircle, Headphones, Crown,
  Sparkles, ArrowRight, Star, Users, CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { TextReveal, ScrollFade, TiltCard, Float3D, AnimatedCounter, LineReveal } from "@/components/landing/ScrollAnimations";

const TOTAL_SPOTS = 50;
const SPOTS_CLAIMED = 0;

const benefits = [
  {
    icon: Crown,
    title: "Lifetime 50% Off — Grandfathered Forever",
    description: "Lock in today's rate forever, no matter how we scale. When the price increases, yours stays the same. Guaranteed.",
    iconColor: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: MessageCircle,
    title: "Direct Access to the Founder",
    description: "Request features and influence the roadmap directly. Your feedback shapes what gets built — not a support queue.",
    iconColor: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Headphones,
    title: "Priority Support — Always First",
    description: "Your issues get handled first, always. Skip the queue. First-response priority on every request, forever.",
    iconColor: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
];

export default function FoundingMembers() {
  const spotsLeft = TOTAL_SPOTS - SPOTS_CLAIMED;
  const progressPercent = (SPOTS_CLAIMED / TOTAL_SPOTS) * 100;

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroY = useTransform(heroScroll, [0, 1], [0, -80]);
  const heroOpacity = useTransform(heroScroll, [0, 0.7], [1, 0]);
  const springY = useSpring(heroY, { stiffness: 100, damping: 30 });

  return (
    <>
      <Helmet>
        <title>Founding Members — Lock In Your Price | Veylodesk</title>
        <meta
          name="description"
          content="Only 50 founding member spots. Grandfathered pricing forever. Claim yours before the price doubles."
        />
        <link rel="canonical" href="https://veylodesk.com/founding-members" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
        {/* Squeeze Navbar */}
        <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/10">
          <div className="container mx-auto px-6 flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow duration-300">
                <Command className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">
                Veylo<span className="text-gradient">desk</span>
              </span>
            </Link>
            <Button variant="hero" size="sm" className="cta-pulse text-xs sm:text-sm" asChild>
              <Link to="/pricing">Claim 1 of {spotsLeft} Spots</Link>
            </Button>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section ref={heroRef} className="relative pt-28 pb-20 md:pt-40 md:pb-28">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-primary/8 rounded-full blur-[180px] pointer-events-none" />

          <Float3D className="absolute top-32 right-[12%] opacity-15 hidden md:block" amplitude={20} duration={8}>
            <div className="w-20 h-20 rounded-2xl border border-amber-500/20 rotate-45" />
          </Float3D>

          <motion.div
            style={{ y: springY, opacity: heroOpacity }}
            className="container relative z-10 mx-auto px-6 text-center"
          >
            {/* Urgency badge */}
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/20 mb-8"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-xs sm:text-sm font-semibold text-destructive tracking-wide">
                Only {spotsLeft} spots · Price doubles after
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-[2.25rem] leading-[1.1] sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl mx-auto mb-6"
            >
              Lock in your rate{" "}
              <span className="text-gradient">before it doubles.</span>
            </motion.h1>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
              className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed"
            >
              50 founding member spots with grandfathered pricing, founder access,
              and priority support — forever.
            </motion.p>

            {/* Scarcity bar */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="max-w-sm mx-auto mb-10"
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Users className="w-3.5 h-3.5" /> {SPOTS_CLAIMED} claimed
                </span>
                <span className="text-destructive font-semibold">{spotsLeft} left</span>
              </div>
              <div className="relative h-2.5 w-full rounded-full bg-muted/40 overflow-hidden border border-border/30">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(progressPercent, 4)}%` }}
                  transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-destructive to-amber-500"
                />
              </div>
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="flex flex-col items-center gap-3"
            >
              <Button variant="hero" size="xl" asChild className="min-w-[240px] cta-pulse">
                <Link to="/pricing">
                  Claim My Spot <ArrowRight className="w-5 h-5 ml-1" />
                </Link>
              </Button>
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Use code{" "}
                <code className="px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono font-bold text-xs border border-primary/20">
                  VEYLO50
                </code>{" "}
                at checkout
              </span>
            </motion.div>
          </motion.div>
        </section>

        {/* ── BENEFITS ── */}
        <section className="relative py-20 md:py-28">
          <LineReveal className="absolute top-0 left-0 right-0" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[160px] pointer-events-none" />

          <div className="container relative z-10 mx-auto px-6">
            <ScrollFade>
              <div className="text-center mb-14">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">Founding Perks</span>
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3">
                  The Founding Member Offer.{" "}
                  <span className="text-gradient">50 spots. No exceptions.</span>
                </h2>
                <p className="text-muted-foreground text-base max-w-md mx-auto">
                  After 50 members, these benefits are permanently off the table.
                </p>
              </div>
            </ScrollFade>

            <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {benefits.map((b, i) => (
                <ScrollFade key={b.title} delay={i * 0.12}>
                  <TiltCard intensity={6}>
                    <div className="group relative h-full rounded-2xl border border-border/30 bg-card p-7 hover:border-primary/25 transition-all duration-500">
                      <motion.div
                        className={`w-11 h-11 rounded-xl ${b.bg} flex items-center justify-center mb-4`}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                      >
                        <b.icon className={`w-5 h-5 ${b.iconColor}`} />
                      </motion.div>
                      <h3 className="text-lg font-bold mb-2">{b.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
                    </div>
                  </TiltCard>
                </ScrollFade>
              ))}
            </div>
          </div>
        </section>

        {/* ── SOCIAL PROOF ── */}
        <section className="py-14 border-y border-border/15">
          <div className="container mx-auto px-6">
            <ScrollFade>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-14 text-center">
                <div>
                  <p className="text-2xl font-bold text-destructive">
                    <AnimatedCounter target={spotsLeft} duration={1.5} />
                  </p>
                  <p className="text-xs text-muted-foreground">Spots Left</p>
                </div>
                <div className="hidden sm:block w-px h-8 bg-border/30" />
                <div>
                  <p className="text-2xl font-bold text-amber-400">VEYLO50</p>
                  <p className="text-xs text-muted-foreground">Your Code</p>
                </div>
                <div className="hidden sm:block w-px h-8 bg-border/30" />
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 + i * 0.06, duration: 0.3 }}
                    >
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    </motion.div>
                  ))}
                  <p className="text-xs text-muted-foreground ml-2">Built for Agency CEOs</p>
                </div>
              </div>
            </ScrollFade>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="relative py-20 md:py-28">
          <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[180px] pointer-events-none" />

          <div className="container relative z-10 mx-auto px-6 text-center">
            <ScrollFade>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-5 max-w-2xl mx-auto leading-tight">
                Only {spotsLeft} founding spots remain.{" "}
                <span className="text-gradient">Lock yours in now.</span>
              </h2>
            </ScrollFade>

            <ScrollFade delay={0.15}>
              <p className="text-base text-muted-foreground max-w-md mx-auto mb-8">
                When the 50th spot is filled, this page closes. The price doubles. No exceptions, no extensions.
                If you've been running your agency on five different tools and a lot of patience — this is the moment to fix that.
              </p>
            </ScrollFade>

            <ScrollFade delay={0.25}>
              <Button variant="hero" size="xl" asChild className="min-w-[240px] cta-pulse">
                <Link to="/pricing">
                  Claim Your Spot <ArrowRight className="w-5 h-5 ml-1" />
                </Link>
              </Button>
            </ScrollFade>

            <ScrollFade delay={0.3}>
              <div className="flex flex-wrap items-center justify-center gap-5 mt-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" /> 14-day money-back
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Cancel anytime
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Locked-in pricing
                </span>
              </div>
            </ScrollFade>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/15 py-6">
          <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-primary flex items-center justify-center">
                <Command className="w-3 h-3 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold">Veylodesk</span>
            </Link>
            <div className="flex gap-5 text-xs text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link to="/refund" className="hover:text-foreground transition-colors">Refund</Link>
            </div>
            <p className="text-[10px] text-muted-foreground">
              © {new Date().getFullYear()} Veylodesk
            </p>
          </div>
        </footer>

        {/* Sticky Mobile CTA */}
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-background/90 backdrop-blur-xl border-t border-border/15 md:hidden safe-area-bottom">
          <Button variant="hero" size="lg" className="w-full cta-pulse" asChild>
            <Link to="/pricing">
              Claim 1 of {spotsLeft} Spots
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
