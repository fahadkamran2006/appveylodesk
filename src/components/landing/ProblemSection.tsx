import { MessageSquare, Trello, FolderOpen, AlertTriangle, Clock, Brain } from "lucide-react";
import { motion } from "framer-motion";
import { TextReveal, ScrollFade, TiltCard, LineReveal, ParallaxSection } from "./ScrollAnimations";

const ProblemSection = () => {
  const problems = [
    {
      icon: Clock,
      title: "14-Hour Days",
      description: "Chasing updates, managing files, coordinating editors. You're working in your business, not on it.",
    },
    {
      icon: MessageSquare,
      title: "Scattered Communication",
      description: "Clients in Slack, editors in WhatsApp, feedback in email. Context is lost.",
    },
    {
      icon: Brain,
      title: "Mental Overload",
      description: "Remembering which project is where, who needs what, and when invoices are due.",
    },
  ];

  return (
    <section className="relative py-32 lg:py-44 overflow-hidden">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-gradient-section" />
      <LineReveal className="absolute top-0 left-0 right-0" />
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-destructive/5 rounded-full blur-[150px]" />
      
      <div className="container relative z-10 mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-24">
          {/* The Chaos Visual */}
          <ScrollFade delay={0}>
            <div className="flex items-center justify-center gap-5 mb-12">
              {[
                { color: "#4A154B", icon: MessageSquare },
                { color: "#0079BF", icon: Trello },
                { color: "#4285F4", icon: FolderOpen },
              ].map((item, i) => (
                <motion.div key={i} className="contents">
                  {i > 0 && <span className="text-3xl text-muted-foreground/50">+</span>}
                  <motion.div
                    whileHover={{ scale: 1.1, rotateZ: 5 }}
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg`}
                    style={{ backgroundColor: item.color, boxShadow: `0 8px 30px ${item.color}33` }}
                  >
                    <item.icon className="w-8 h-8 text-white" />
                  </motion.div>
                </motion.div>
              ))}
              <span className="text-3xl text-muted-foreground/50">=</span>
              <motion.div
                animate={{ rotate: [0, -5, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                className="w-16 h-16 rounded-2xl bg-destructive/20 border border-destructive/30 flex items-center justify-center"
              >
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </motion.div>
            </div>
          </ScrollFade>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-8">
            <TextReveal staggerDelay={0.04}>Drowning in Tabs?</TextReveal>{" "}
            <span className="text-destructive">
              <TextReveal staggerDelay={0.04}>That's Not Scaling.</TextReveal>
            </span>
          </h2>
          
          <ScrollFade delay={0.2}>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              You didn't start an agency to play traffic cop with files and messages.
            </p>
          </ScrollFade>
        </div>

        {/* Problem Cards with 3D tilt */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {problems.map((problem, index) => (
            <ScrollFade key={problem.title} delay={index * 0.15} direction={index === 0 ? "left" : index === 2 ? "right" : "up"}>
              <TiltCard intensity={8}>
                <div className="glass-card-premium rounded-3xl p-8 border-destructive/10 hover:border-destructive/20 transition-all duration-300 group h-full">
                  <motion.div 
                    className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6 group-hover:bg-destructive/20 transition-colors duration-300"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                  >
                    <problem.icon className="w-7 h-7 text-destructive" />
                  </motion.div>
                  <h3 className="text-2xl font-semibold mb-4 text-foreground tracking-tight">
                    {problem.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
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
