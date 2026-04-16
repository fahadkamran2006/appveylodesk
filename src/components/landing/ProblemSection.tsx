import { MessageSquare, Trello, FolderOpen, AlertTriangle, Clock, Brain, DollarSign } from "lucide-react";
import { motion } from "framer-motion";
import { TextReveal, ScrollFade, TiltCard, LineReveal } from "./ScrollAnimations";

const ProblemSection = () => {
  const problems = [
    {
      icon: DollarSign,
      label: "01",
      title: "Five tools. Zero integration.",
      description: "Drive, Frame.io, Slack, Stripe, spreadsheets. Five subscriptions that never talk to each other.",
    },
    {
      icon: MessageSquare,
      label: "02",
      title: "Clients can't see your craft.",
      description: "World-class edits, amateur-hour delivery. The experience hides the work.",
    },
    {
      icon: Clock,
      label: "03",
      title: "Held together by willpower.",
      description: "Manual follow-ups. Forgotten invoices. It works — until the day it doesn't.",
    },
  ];

  return (
    <section className="relative py-32 lg:py-44 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-section" />
      <LineReveal className="absolute top-0 left-0 right-0" />
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-destructive/5 rounded-full blur-[150px]" />
      
      <div className="container relative z-10 mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-20">
          {/* Eyebrow */}
          <ScrollFade delay={0}>
            <span className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.2em] uppercase text-destructive/80 border border-destructive/20 rounded-full px-4 py-1.5 backdrop-blur-sm bg-destructive/5 mb-10">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              The problem
            </span>
          </ScrollFade>

          {/* The Chaos Visual */}
          <ScrollFade delay={0.1}>
            <div className="flex items-center justify-center gap-4 sm:gap-5 mb-12">
              {[
                { color: "#4A154B", icon: MessageSquare },
                { color: "#0079BF", icon: Trello },
                { color: "#4285F4", icon: FolderOpen },
              ].map((item, i) => (
                <motion.div key={i} className="contents">
                  {i > 0 && <span className="text-2xl text-muted-foreground/40 font-light">+</span>}
                  <motion.div
                    whileHover={{ scale: 1.08, rotateZ: 4 }}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-500"
                    style={{ backgroundColor: item.color, boxShadow: `0 8px 30px ${item.color}33` }}
                  >
                    <item.icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                  </motion.div>
                </motion.div>
              ))}
              <span className="text-2xl text-muted-foreground/40 font-light">=</span>
              <motion.div
                animate={{ rotate: [0, -5, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-destructive/15 border border-destructive/30 flex items-center justify-center"
              >
                <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 text-destructive" />
              </motion.div>
            </div>
          </ScrollFade>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
            <TextReveal staggerDelay={0.04}>You're running your agency on</TextReveal>{" "}
            <span className="text-destructive italic">
              <TextReveal staggerDelay={0.04}>duct tape.</TextReveal>
            </span>
          </h2>

          <ScrollFade delay={0.2}>
            <p className="text-lg md:text-xl text-muted-foreground/80 max-w-xl mx-auto leading-relaxed">
              Five subscriptions. Zero integration. One agency held together by willpower.
            </p>
          </ScrollFade>
        </div>

        {/* Problem Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {problems.map((problem, index) => (
            <ScrollFade key={problem.title} delay={index * 0.12} direction={index === 0 ? "left" : index === 2 ? "right" : "up"}>
              <TiltCard intensity={6}>
                <div className="relative glass-card-premium rounded-3xl p-8 border-destructive/10 hover:border-destructive/25 transition-all duration-500 group h-full overflow-hidden">
                  {/* Subtle hover glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-destructive/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  
                  {/* Icon + Number label */}
                  <div className="flex items-center justify-between mb-8">
                    <motion.div 
                      className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center group-hover:bg-destructive/20 transition-colors duration-300"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                    >
                      <problem.icon className="w-5 h-5 text-destructive" />
                    </motion.div>
                    <span className="text-xs font-mono tracking-widest text-muted-foreground/40">
                      {problem.label}
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold mb-3 text-foreground tracking-tight leading-snug">
                    {problem.title}
                  </h3>
                  <p className="text-sm text-muted-foreground/80 leading-relaxed">
                    {problem.description}
                  </p>
                </div>
              </TiltCard>
            </ScrollFade>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
