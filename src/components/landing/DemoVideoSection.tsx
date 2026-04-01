import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { TextReveal, ScrollFade, TiltCard, LineReveal } from "./ScrollAnimations";

const DemoVideoSection = () => {
  return (
    <section id="demo" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <LineReveal className="absolute top-0 left-0 right-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px]" />
      
      <div className="container relative z-10 mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <ScrollFade>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Play className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">See It In Action</span>
            </div>
          </ScrollFade>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            <TextReveal staggerDelay={0.04}>Watch How</TextReveal>{" "}
            <TextReveal staggerDelay={0.04} gradient>Veylodesk Works</TextReveal>
          </h2>
          <ScrollFade delay={0.2}>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Take a quick tour of the command center built for video agencies. 
              See how you can manage clients, editors, and projects—all in one place.
            </p>
          </ScrollFade>
        </div>

        {/* Video Container with 3D tilt */}
        <ScrollFade delay={0.3}>
          <div className="max-w-5xl mx-auto">
            <TiltCard intensity={5}>
              <div className="relative">
                {/* Glow Effect */}
                <div className="absolute -inset-6 bg-gradient-to-r from-primary/20 via-indigo-soft/15 to-primary/20 rounded-3xl blur-2xl opacity-60" />
                <div className="absolute -inset-3 bg-gradient-glow rounded-3xl opacity-40" />
                
                {/* Video Frame */}
                <div className="relative glass-card-premium rounded-2xl p-2 overflow-hidden shadow-2xl">
                  <div className="relative rounded-xl overflow-hidden bg-midnight-deep aspect-video">
                    <iframe
                      src="https://www.youtube.com/embed/GdBbO1Svbxk"
                      title="Veylodesk Demo Video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                </div>
              </div>
            </TiltCard>
          </div>
        </ScrollFade>
      </div>
    </section>
  );
};

export default DemoVideoSection;
