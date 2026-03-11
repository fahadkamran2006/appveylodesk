import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Command } from "lucide-react";
import { motion } from "framer-motion";
import { TextReveal, ScrollFade, Float3D, LineReveal } from "./ScrollAnimations";

const CTASection = () => {
  return (
    <section className="relative py-32 lg:py-44 overflow-hidden">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-gradient-cinematic" />
      <LineReveal className="absolute top-0 left-0 right-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-gradient-glow opacity-50" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-gradient-glow-soft rounded-full blur-[120px]" />

      {/* Floating 3D shapes */}
      <Float3D className="absolute top-20 left-[15%] opacity-15" amplitude={25} duration={9}>
        <div className="w-16 h-16 rounded-2xl border border-primary/30 rotate-12" />
      </Float3D>
      <Float3D className="absolute bottom-20 right-[15%] opacity-10" amplitude={18} duration={7}>
        <div className="w-12 h-12 rounded-full border border-indigo-soft/30" />
      </Float3D>

      <div className="container relative z-10 mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo */}
          <ScrollFade>
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-primary shadow-glow mb-12"
            >
              <Command className="w-12 h-12 text-primary-foreground" />
            </motion.div>
          </ScrollFade>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-8">
            <TextReveal staggerDelay={0.05}>Ready to Take</TextReveal>{" "}
            <span className="text-gradient">
              <TextReveal staggerDelay={0.05}>Command?</TextReveal>
            </span>
          </h2>
          
          <ScrollFade delay={0.2}>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-14 leading-relaxed">
              Stop juggling tools and start scaling your agency. 
              Join the waitlist and be the first to access Veylodesk.
            </p>
          </ScrollFade>

          <ScrollFade delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <Button variant="hero" size="xl" className="btn-glow" asChild>
                <Link to="/pricing">
                  Get Started Today
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="glass" size="xl" asChild>
                <Link to="/auth/login">
                  I Already Have an Account
                </Link>
              </Button>
            </div>
          </ScrollFade>

          <ScrollFade delay={0.4}>
            <p className="mt-12 text-sm text-muted-foreground">
              Unlimited team members • 14-day money-back guarantee • Cancel anytime
            </p>
          </ScrollFade>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
