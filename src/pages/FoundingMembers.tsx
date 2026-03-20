import { useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Command, Play, Shield, MessageCircle, Headphones, Crown,
  Lock, Sparkles, ArrowRight, Star, Users, CheckCircle2,
  CreditCard, X, AlertTriangle, DollarSign, FolderOpen,
} from "lucide-react";
import { TextReveal, CharReveal, ScrollFade, TiltCard, Float3D, AnimatedCounter, LineReveal } from "@/components/landing/ScrollAnimations";

const TOTAL_SPOTS = 50;
const SPOTS_CLAIMED = 0;

const benefits = [
  {
    icon: Crown,
    title: "Grandfathered Pricing — Forever",
    description:
      "Lock in today's rate. When the price doubles (and it will), your rate stays exactly the same. Guaranteed for life.",
    accent: "from-amber-500/20 to-yellow-500/10",
    iconColor: "text-amber-400",
  },
  {
    icon: MessageCircle,
    title: "Direct Founder Access",
    description:
      "A private line to the founder. Your feedback doesn't go to a support queue — it shapes the product roadmap.",
    accent: "from-primary/20 to-indigo-500/10",
    iconColor: "text-primary",
  },
  {
    icon: Headphones,
    title: "Priority Support",
    description:
      "Skip the queue. Founding members get first-response priority on every support request, forever.",
    accent: "from-emerald-500/20 to-green-500/10",
    iconColor: "text-emerald-400",
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
  
  const heroY = useTransform(heroScroll, [0, 1], [0, -100]);
  const heroScale = useTransform(heroScroll, [0, 0.5], [1, 0.95]);
  const heroOpacity = useTransform(heroScroll, [0, 0.8], [1, 0]);
  const springY = useSpring(heroY, { stiffness: 100, damping: 30 });

  return (
    <>
      <Helmet>
        <title>Founding Members — Lock In Your Price Before It Doubles | Veylodesk</title>
        <meta
          name="description"
          content="Only 50 spots. Grandfathered pricing forever. Once these founding member spots are gone, the price doubles. Claim yours now."
        />
        <link rel="canonical" href="https://veylodesk.com/founding-members" />
      </Helmet>

      <div className="min-h-screen bg-[hsl(var(--midnight-deep))] text-foreground overflow-x-hidden">
        {/* ─── Minimal Squeeze Navbar — No Navigation Links ─── */}
        <nav className="fixed top-0 inset-x-0 z-50 bg-[hsl(var(--midnight-deep))]/80 backdrop-blur-xl border-b border-border/20">
          <div className="container mx-auto px-6 flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow duration-300">
                <Command className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">
                Veylo<span className="text-gradient">desk</span>
              </span>
            </Link>
            <Button variant="hero" size="sm" className="cta-pulse" asChild>
              <Link to="/pricing">Claim 1 of {spotsLeft} Spots</Link>
            </Button>
          </div>
        </nav>

        {/* ─── HERO — PAS Framework ─── */}
        <section ref={heroRef} className="relative pt-32 pb-24 md:pt-44 md:pb-32 overflow-hidden">
          {/* ambient glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-primary/8 rounded-full blur-[180px] pointer-events-none" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

          <Float3D className="absolute top-32 right-[12%] opacity-15" amplitude={20} duration={8}>
            <div className="w-20 h-20 rounded-2xl border border-amber-500/20 rotate-45" />
          </Float3D>
          <Float3D className="absolute top-[55%] left-[8%] opacity-10" amplitude={15} duration={10}>
            <div className="w-14 h-14 rounded-full border border-primary/25" />
          </Float3D>

          <motion.div 
            style={{ y: springY, scale: heroScale, opacity: heroOpacity }}
            className="container relative z-10 mx-auto px-6 text-center"
          >
            {/* Urgency badge */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/25 mb-8"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-sm font-semibold text-destructive tracking-wide uppercase">
                Only {spotsLeft} spots · Price doubles after this
              </span>
            </motion.div>

            {/* PAS Headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight max-w-5xl mx-auto mb-6">
              <TextReveal staggerDelay={0.04}>Stop Chasing Clients for Payments.</TextReveal>{" "}
              <span className="text-gradient">
                <CharReveal staggerDelay={0.03}>Start Scaling Your Agency.</CharReveal>
              </span>
            </h1>

            {/* Agitation */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.6, ease: "easeOut" }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              End the nightmare of messy Google Drive feedback, scattered WhatsApp threads, 
              and unbilled revisions eating your profit.{" "}
              <span className="text-foreground font-semibold">
                Lock in founding member pricing before it's gone forever.
              </span>
            </motion.p>

            {/* Scarcity progress bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="max-w-md mx-auto mb-10"
            >
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{SPOTS_CLAIMED} claimed</span>
                </span>
                <span className="text-destructive font-semibold">
                  {spotsLeft} of {TOTAL_SPOTS} remaining
                </span>
              </div>
              <div className="relative h-3 w-full rounded-full bg-muted/40 overflow-hidden border border-border/30">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(progressPercent, 4)}%` }}
                  transition={{ duration: 1.2, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-destructive to-amber-500"
                />
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-destructive/20 to-amber-500/20 animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Once these 50 spots are gone, the price doubles forever.
              </p>
            </motion.div>

            {/* CTA — Action-Oriented */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="flex flex-col items-center gap-4"
            >
              <Button variant="hero" size="xl" asChild className="min-w-[260px] cta-pulse">
                <Link to="/pricing">
                  Claim 1 of {spotsLeft} Spots <ArrowRight className="w-5 h-5 ml-1" />
                </Link>
              </Button>
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Shield className="w-4 h-4" /> Use code{" "}
                <code className="px-2 py-0.5 rounded bg-primary/15 text-primary font-mono font-bold text-sm border border-primary/20">
                  VEYLO50
                </code>{" "}
                at checkout
              </span>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
              className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-success" /> Secure Checkout via Paddle
              </span>
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-success" /> No setup fees
              </span>
              <span className="flex items-center gap-1.5">
                <X className="w-4 h-4 text-success" /> Cancel anytime
              </span>
            </motion.div>
          </motion.div>
        </section>

        {/* ─── DEMO VIDEO ─── */}
        <section className="relative py-24">
          <div className="absolute inset-0 bg-gradient-section pointer-events-none" />
          <LineReveal className="absolute top-0 left-0 right-0" />
          <div className="container relative z-10 mx-auto px-6">
            <ScrollFade>
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                  <Play className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">See It In Action</span>
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                  <TextReveal staggerDelay={0.04}>Watch Your Future</TextReveal>{" "}
                  <span className="text-gradient">
                    <TextReveal staggerDelay={0.04}>Agency OS</TextReveal>
                  </span>
                </h2>
                <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                  2 minutes. That's all it takes to see why agencies are switching.
                </p>
              </div>
            </ScrollFade>

            <ScrollFade delay={0.2}>
              <TiltCard intensity={5} className="max-w-4xl mx-auto">
                <div className="relative group">
                  <div className="absolute -inset-4 bg-gradient-to-r from-primary/15 via-indigo-500/10 to-primary/15 rounded-3xl blur-2xl opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                  <div className="relative rounded-2xl overflow-hidden border border-border/30 bg-[hsl(var(--surface-elevated))]">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20 bg-[hsl(var(--surface-dark))]">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/60" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                        <div className="w-3 h-3 rounded-full bg-green-500/60" />
                      </div>
                      <div className="flex-1 flex justify-center">
                        <div className="px-4 py-1 rounded-md bg-muted/30 text-xs text-muted-foreground font-mono">
                          veylodesk.com
                        </div>
                      </div>
                    </div>
                    <div className="relative aspect-video bg-[hsl(var(--midnight-deep))] flex items-center justify-center cursor-pointer group/play">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="relative z-10 w-20 h-20 rounded-full bg-primary/20 backdrop-blur-xl border border-primary/30 flex items-center justify-center shadow-glow-sm group-hover/play:shadow-glow transition-all duration-300"
                      >
                        <Play className="w-8 h-8 text-primary fill-primary" />
                      </motion.div>
                      <p className="absolute bottom-6 text-sm text-muted-foreground">
                        Demo video coming soon
                      </p>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </ScrollFade>
          </div>
        </section>

        {/* ─── PAIN POINTS (Agitation) ─── */}
        <section className="relative py-24">
          <LineReveal className="absolute top-0 left-0 right-0" />
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-destructive/5 rounded-full blur-[150px] pointer-events-none" />
          <div className="container relative z-10 mx-auto px-6">
            <ScrollFade>
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                  <TextReveal staggerDelay={0.04}>Sound Familiar?</TextReveal>
                </h2>
                <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                  Every agency owner has been here. The question is: how long will you stay?
                </p>
              </div>
            </ScrollFade>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: DollarSign, title: "Unbilled Revisions", desc: "Clients ask for 'one more tweak' and you eat the cost. Every. Single. Time. That's profit walking out the door.", color: "text-destructive", bg: "bg-destructive/10" },
                { icon: FolderOpen, title: "Google Drive Chaos", desc: "V3_final_FINAL_v2.mp4. Sound familiar? Client feedback scattered across email, Slack, and WhatsApp. Context: lost.", color: "text-warning", bg: "bg-warning/10" },
                { icon: AlertTriangle, title: "14-Hour Days", desc: "You didn't start an agency to play traffic cop with files and messages. Yet here you are, managing chaos instead of scaling.", color: "text-amber-400", bg: "bg-amber-500/10" },
              ].map((item, i) => (
                <ScrollFade key={item.title} delay={i * 0.15}>
                  <TiltCard intensity={8}>
                    <div className="group relative h-full rounded-2xl border border-destructive/10 bg-[hsl(var(--surface-elevated))] p-8 hover:border-destructive/20 transition-all duration-500 overflow-hidden">
                      <motion.div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-5`} whileHover={{ scale: 1.1, rotate: 5 }}>
                        <item.icon className={`w-6 h-6 ${item.color}`} />
                      </motion.div>
                      <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </TiltCard>
                </ScrollFade>
              ))}
            </div>
          </div>
        </section>

        {/* ─── BENEFITS ─── */}
        <section className="relative py-24">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/5 rounded-full blur-[160px] pointer-events-none" />
          <LineReveal className="absolute top-0 left-0 right-0" />
          <div className="container relative z-10 mx-auto px-6">
            <ScrollFade>
              <div className="text-center mb-16">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">Founding Member Perks</span>
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                  <TextReveal staggerDelay={0.04}>Perks That Will</TextReveal>{" "}
                  <span className="text-gradient">
                    <TextReveal staggerDelay={0.04}>Never Exist Again</TextReveal>
                  </span>
                </h2>
                <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                  After 50, these benefits are permanently off the table.
                </p>
              </div>
            </ScrollFade>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {benefits.map((b, i) => (
                <ScrollFade key={b.title} delay={i * 0.15} direction={i === 0 ? "left" : i === 2 ? "right" : "up"}>
                  <TiltCard intensity={8}>
                    <div className="group relative h-full rounded-2xl border border-border/30 bg-[hsl(var(--surface-elevated))] p-8 hover:border-primary/30 transition-all duration-500 overflow-hidden">
                      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${b.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                      <motion.div 
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${b.accent} flex items-center justify-center mb-5`}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                      >
                        <b.icon className={`w-6 h-6 ${b.iconColor}`} />
                      </motion.div>
                      <h3 className="text-xl font-bold mb-3">{b.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{b.description}</p>
                    </div>
                  </TiltCard>
                </ScrollFade>
              ))}
            </div>
          </div>
        </section>

        {/* ─── SOCIAL PROOF STRIP ─── */}
        <section className="py-16 border-y border-border/20">
          <div className="container mx-auto px-6">
            <ScrollFade>
              <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-center">
                <div>
                  <p className="text-3xl font-bold text-destructive">
                    <AnimatedCounter target={spotsLeft} duration={1.5} />
                  </p>
                  <p className="text-sm text-muted-foreground">Spots Remaining</p>
                </div>
                <div className="hidden md:block w-px h-10 bg-border/30" />
                <div>
                  <p className="text-3xl font-bold text-amber-400">VEYLO50</p>
                  <p className="text-sm text-muted-foreground">Your Discount Code</p>
                </div>
                <div className="hidden md:block w-px h-10 bg-border/30" />
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0, rotate: -180 }}
                      whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
                    >
                      <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                    </motion.div>
                  ))}
                  <p className="text-sm text-muted-foreground ml-2">Built for Agency CEOs</p>
                </div>
              </div>
            </ScrollFade>
          </div>
        </section>

        {/* ─── FINAL CTA — Loss Aversion ─── */}
        <section className="relative py-24 md:py-32">
          <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[200px] pointer-events-none" />

          <Float3D className="absolute top-16 right-[18%] opacity-10" amplitude={15} duration={8}>
            <div className="w-14 h-14 rounded-xl border border-primary/25 rotate-12" />
          </Float3D>

          <div className="container relative z-10 mx-auto px-6 text-center">
            <ScrollFade>
              <h2 className="text-3xl md:text-5xl font-extrabold mb-6 max-w-3xl mx-auto leading-tight">
                <TextReveal staggerDelay={0.04}>The price doubles</TextReveal>{" "}
                <span className="text-gradient">
                  <TextReveal staggerDelay={0.04}>after 50 members.</TextReveal>
                </span>{" "}
                <TextReveal staggerDelay={0.04}>Lock in your rate now.</TextReveal>
              </h2>
            </ScrollFade>
            
            <ScrollFade delay={0.2}>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
                This isn't a marketing gimmick. After {spotsLeft} founding members, 
                the price increases permanently. Your future self will thank you — or regret waiting.
              </p>
            </ScrollFade>

            <ScrollFade delay={0.3}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button variant="hero" size="xl" asChild className="min-w-[260px] cta-pulse">
                  <Link to="/pricing">
                    Lock In My Price Forever <ArrowRight className="w-5 h-5 ml-1" />
                  </Link>
                </Button>
              </div>
            </ScrollFade>

            <ScrollFade delay={0.4}>
              <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-success" /> 14-day money-back guarantee
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-success" /> Cancel anytime
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-success" /> Locked-in pricing forever
                </span>
              </div>
            </ScrollFade>
          </div>
        </section>

        {/* ─── FOOTER (minimal) ─── */}
        <footer className="border-t border-border/20 py-8">
          <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-gradient-primary flex items-center justify-center">
                <Command className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold">Veylodesk</span>
            </Link>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link to="/refund" className="hover:text-foreground transition-colors">Refund</Link>
            </div>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Veylodesk. All rights reserved.
            </p>
          </div>
        </footer>

        {/* ─── Sticky Mobile CTA ─── */}
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-[hsl(var(--midnight-deep))]/90 backdrop-blur-xl border-t border-border/20 md:hidden safe-area-bottom">
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
