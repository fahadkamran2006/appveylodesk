import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowUpRight, Command, Quote } from "lucide-react";
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

const About = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Helmet>
        <title>About Us — Veylodesk | Built by Agency Owners</title>
        <meta
          name="description"
          content="Meet the founder of Veylodesk — Fahad Kamran, a video editing agency owner who built the tool he wished existed."
        />
      </Helmet>

      <Navbar />

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-28">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.06] blur-[120px]" />
        </div>

        <div className="container mx-auto px-6 relative z-10 text-center max-w-3xl">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8"
          >
            <Command className="w-3.5 h-3.5" />
            Our Story
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6"
          >
            Built by an agency owner,{" "}
            <span className="text-gradient">for agency owners.</span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Veylodesk wasn't built in a boardroom. It was built in the trenches
            of the editing room to solve the exact bottlenecks holding creative
            agencies back.
          </motion.p>
        </div>
      </section>

      {/* ── Founder Story ── */}
      <section className="pb-24 md:pb-32">
        <div className="container mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid md:grid-cols-2 gap-12 md:gap-16 items-center max-w-5xl mx-auto"
          >
            {/* Image */}
            <motion.div variants={fadeUp} custom={0} className="relative group">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-muted/30 border border-border/50 relative">
                {/* Placeholder with initials */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5">
                  <div className="w-28 h-28 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center mb-4">
                    <span className="text-4xl font-bold text-primary">FK</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    Fahad Kamran
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Founder & CEO
                  </p>
                </div>
                {/* Decorative corner accents */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />
              </div>
              {/* Floating glow behind image */}
              <div className="absolute -inset-4 rounded-3xl bg-primary/[0.04] blur-2xl -z-10 group-hover:bg-primary/[0.08] transition-colors duration-700" />
            </motion.div>

            {/* Story */}
            <div className="space-y-6">
              <motion.div variants={fadeUp} custom={1}>
                <Quote className="w-10 h-10 text-primary/30 mb-4 -scale-x-100" />
              </motion.div>

              <motion.p
                variants={fadeUp}
                custom={2}
                className="text-lg md:text-xl text-foreground/90 leading-relaxed"
              >
                Hi, I'm{" "}
                <span className="font-semibold text-foreground">
                  Fahad Kamran
                </span>
                . I started my journey spending two years straight in the
                trenches creating documentaries and running my own video editing
                agency,{" "}
                <span className="text-primary font-medium">Videoflickz</span>,
                right here in Pakistan.
              </motion.p>

              <motion.p
                variants={fadeUp}
                custom={3}
                className="text-lg md:text-xl text-foreground/90 leading-relaxed"
              >
                By age 19, I realized the biggest roadblock to scaling wasn't
                finding clients or editing faster — it was the{" "}
                <span className="font-semibold text-foreground">
                  absolute chaos
                </span>{" "}
                of managing files, tracking Slack messages, and chasing down
                invoice payments.
              </motion.p>

              <motion.p
                variants={fadeUp}
                custom={4}
                className="text-lg md:text-xl text-foreground/90 leading-relaxed"
              >
                I built Veylodesk to replace the duct-taped mess of Google
                Drive, Frame.io, and spreadsheets with{" "}
                <span className="text-gradient font-semibold">
                  one single, ruthless system
                </span>
                .
              </motion.p>

              {/* CTA link */}
              <motion.div variants={fadeUp} custom={5} className="pt-4">
                <a
                  href="https://fahadkamran.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 group/link"
                >
                  <span className="text-primary font-medium text-base border-b border-primary/30 group-hover/link:border-primary transition-colors pb-0.5">
                    Visit my personal website
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-primary group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                </a>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Mission Strip ── */}
      <section className="py-20 md:py-28 border-t border-border/30">
        <div className="container mx-auto px-6 text-center max-w-3xl">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-3xl md:text-4xl font-bold mb-6"
          >
            Our mission is simple.
          </motion.h2>
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-lg text-muted-foreground leading-relaxed mb-10"
          >
            Give every creative agency — from a solo editor in Lahore to a
            50-person studio in LA — the same operational backbone that
            billion-dollar companies run on. No bloat. No BS. Just results.
          </motion.p>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={2}
          >
            <Button variant="hero" size="lg" asChild>
              <Link to="/pricing">Start for free →</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
