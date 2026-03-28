import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Command, Shield, CheckCircle2, CreditCard } from "lucide-react";
import { motion } from "framer-motion";
import { TextReveal, ScrollFade, Float3D, LineReveal } from "./ScrollAnimations";

const SPOTS_REMAINING = 50; // ← Update this number as spots are claimed

const CTASection = () => {
  return (
    <section className="relative py-32 lg:py-44 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-cinematic" />
      <LineReveal className="absolute top-0 left-0 right-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-gradient-glow opacity-50" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-gradient-glow-soft rounded-full blur-[120px]" />

      <Float3D className="absolute top-20 left-[15%] opacity-15" amplitude={25} duration={9}>
        <div className="w-16 h-16 rounded-2xl border border-primary/30 rotate-12" />
      </Float3D>
      <Float3D className="absolute bottom-20 right-[15%] opacity-10" amplitude={18} duration={7}>
        <div className="w-12 h-12 rounded-full border border-indigo-soft/30" />
      </Float3D>

      <div className="container relative z-10 mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollFade>
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-primary shadow-glow mb-12"
            >
              <Command className="w-12 h-12 text-primary-foreground" />
            </motion.div>
          </ScrollFade>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-8">
            <TextReveal staggerDelay={0.05}>{`${SPOTS_REMAINING} agency owners have`}</TextReveal>{" "}
            <span className="text-gradient">
              <TextReveal staggerDelay={0.05}>already claimed their spot.</TextReveal>
            </span>
          </h2>
          
          <ScrollFade delay={0.2}>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-14 leading-relaxed">
              When the 50th spot is filled, this page closes. The price doubles. No exceptions, no extensions. 
              If you've been running your agency on five different tools and a lot of patience — this is the moment to fix that.
            </p>
          </ScrollFade>

          <ScrollFade delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <Button variant="hero" size="xl" className="btn-glow cta-pulse" asChild>
                <Link to="/founding-members">
                  Claim Spot #{SPOTS_REMAINING} →
                </Link>
              </Button>
              <Button variant="glass" size="xl" asChild>
                <Link to="/auth/login">
                  I Already Have an Account
                </Link>
              </Button>
            </div>
          </ScrollFade>

          {/* Trust Badges */}
          <ScrollFade delay={0.4}>
            <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-success" /> Secure checkout via Paddle
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-success" /> Cancel anytime
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-success" /> Your price never increases
              </span>
            </div>
          </ScrollFade>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
