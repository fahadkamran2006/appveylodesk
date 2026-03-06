import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Command, Play, Shield, MessageCircle, Headphones, Crown,
  Lock, Sparkles, ArrowRight, Star, Users, CheckCircle2,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const TOTAL_SPOTS = 50;
const SPOTS_CLAIMED = 0; // update manually as members join

const benefits = [
  {
    icon: Crown,
    title: "Grandfathered Pricing",
    description:
      "Lock in today's rate forever. As we scale and prices increase, your rate stays the same — guaranteed.",
    accent: "from-amber-500/20 to-yellow-500/10",
    iconColor: "text-amber-400",
  },
  {
    icon: MessageCircle,
    title: "Direct Founder Access",
    description:
      "A private line to the founder. Your feedback shapes the product roadmap directly.",
    accent: "from-primary/20 to-indigo-500/10",
    iconColor: "text-primary",
  },
  {
    icon: Headphones,
    title: "Priority Support",
    description:
      "Skip the queue. Founding members get first-response priority on every support request.",
    accent: "from-emerald-500/20 to-green-500/10",
    iconColor: "text-emerald-400",
  },
];

export default function FoundingMembers() {
  const spotsLeft = TOTAL_SPOTS - SPOTS_CLAIMED;
  const progressPercent = (SPOTS_CLAIMED / TOTAL_SPOTS) * 100;

  return (
    <>
      <Helmet>
        <title>Founding Members — Veylodesk</title>
        <meta
          name="description"
          content="Join an exclusive group of 50 agency owners shaping the future of Veylodesk. Grandfathered pricing, founder access, and priority support."
        />
        <link rel="canonical" href="https://veylodesk.com/founding-members" />
      </Helmet>

      <div className="min-h-screen bg-[hsl(var(--midnight-deep))] text-foreground overflow-x-hidden">
        {/* ─── Navbar (minimal) ─── */}
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
            <Button variant="hero" size="sm" asChild>
              <Link to="/pricing">Claim Your Spot</Link>
            </Button>
          </div>
        </nav>

        {/* ─── HERO ─── */}
        <section className="relative pt-32 pb-24 md:pt-44 md:pb-32">
          {/* ambient glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-primary/8 rounded-full blur-[180px] pointer-events-none" />
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

          <div className="container relative z-10 mx-auto px-6 text-center">
            {/* Exclusive badge */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/25 mb-8"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-sm font-semibold text-amber-300 tracking-wide uppercase">
                Invite Only · {spotsLeft} spots left
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={1}
              className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight max-w-4xl mx-auto mb-6"
            >
              Become a Veylodesk{" "}
              <span className="text-gradient">Founding Member.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={2}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              Join an exclusive group of 50 agency owners shaping the future of
              video editing workflows. Secure grandfathered pricing and direct
              access to the founder.
            </motion.p>

            {/* Scarcity progress bar */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={3}
              className="max-w-md mx-auto mb-10"
            >
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{SPOTS_CLAIMED} claimed</span>
                </span>
                <span className="text-amber-400 font-semibold">
                  {spotsLeft} of {TOTAL_SPOTS} remaining
                </span>
              </div>
              <div className="relative h-3 w-full rounded-full bg-muted/40 overflow-hidden border border-border/30">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(progressPercent, 4)}%` }}
                  transition={{ duration: 1.2, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-primary"
                />
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500/20 to-primary/20 animate-pulse" />
              </div>
            </motion.div>

            {/* CTA */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={4}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button variant="hero" size="xl" asChild className="min-w-[220px]">
                <Link to="/pricing">
                  Claim Your Spot <ArrowRight className="w-5 h-5 ml-1" />
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
          </div>
        </section>

        {/* ─── DEMO VIDEO ─── */}
        <section className="relative py-24">
          <div className="absolute inset-0 bg-gradient-section pointer-events-none" />
          <div className="container relative z-10 mx-auto px-6">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={0}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Play className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">See It In Action</span>
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                Watch How <span className="text-gradient">Veylodesk Works</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                A quick tour of the command center built for video agencies.
              </p>
            </motion.div>

            <motion.div
              variants={scaleIn}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="max-w-4xl mx-auto"
            >
              {/* Browser mockup frame */}
              <div className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/15 via-indigo-500/10 to-primary/15 rounded-3xl blur-2xl opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                <div className="relative rounded-2xl overflow-hidden border border-border/30 bg-[hsl(var(--surface-elevated))]">
                  {/* Browser chrome */}
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
                  {/* Video placeholder */}
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
            </motion.div>
          </div>
        </section>

        {/* ─── BENEFITS ─── */}
        <section className="relative py-24">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/5 rounded-full blur-[160px] pointer-events-none" />
          <div className="container relative z-10 mx-auto px-6">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={0}
              className="text-center mb-16"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Why Join Early?</span>
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                Built for <span className="text-gradient">Visionaries</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Founding Members get perks that will never be available again.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {benefits.map((b, i) => (
                <motion.div
                  key={b.title}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={i + 1}
                >
                  <div className="group relative h-full rounded-2xl border border-border/30 bg-[hsl(var(--surface-elevated))] p-8 hover:border-primary/30 transition-all duration-500 overflow-hidden">
                    {/* Subtle gradient accent */}
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${b.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${b.accent} flex items-center justify-center mb-5`}>
                      <b.icon className={`w-6 h-6 ${b.iconColor}`} />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{b.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{b.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── SOCIAL PROOF STRIP ─── */}
        <section className="py-16 border-y border-border/20">
          <div className="container mx-auto px-6">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={0}
              className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-center"
            >
              <div>
                <p className="text-3xl font-bold text-foreground">50</p>
                <p className="text-sm text-muted-foreground">Total Spots</p>
              </div>
              <div className="hidden md:block w-px h-10 bg-border/30" />
              <div>
                <p className="text-3xl font-bold text-amber-400">VEYLO50</p>
                <p className="text-sm text-muted-foreground">Your Discount Code</p>
              </div>
              <div className="hidden md:block w-px h-10 bg-border/30" />
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                ))}
                <p className="text-sm text-muted-foreground ml-2">Built for Agency CEOs</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section className="relative py-24 md:py-32">
          <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[200px] pointer-events-none" />

          <div className="container relative z-10 mx-auto px-6 text-center">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={0}
            >
              <h2 className="text-3xl md:text-5xl font-extrabold mb-6 max-w-3xl mx-auto leading-tight">
                Don't miss your chance to{" "}
                <span className="text-gradient">shape the future</span> of
                agency management.
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
                Only {spotsLeft} founding member spots remain. Once they're gone,
                they're gone forever.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button variant="hero" size="xl" asChild className="min-w-[220px]">
                  <Link to="/pricing">
                    Claim Your Spot <ArrowRight className="w-5 h-5 ml-1" />
                  </Link>
                </Button>
              </div>

              <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> No risk
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Cancel anytime
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Locked-in pricing
                </span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
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
      </div>
    </>
  );
}
