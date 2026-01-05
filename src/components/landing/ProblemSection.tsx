import { MessageSquare, Trello, FolderOpen, AlertTriangle, Clock, Brain } from "lucide-react";
import { motion } from "framer-motion";

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
    <section className="relative py-40 lg:py-52 overflow-hidden">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-gradient-section" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-destructive/5 rounded-full blur-[150px]" />
      
      <div className="container relative z-10 mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-24">
          {/* The Chaos Visual */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="flex items-center justify-center gap-5 mb-12"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#4A154B] flex items-center justify-center shadow-lg shadow-[#4A154B]/20">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <span className="text-3xl text-muted-foreground/50">+</span>
            <div className="w-16 h-16 rounded-2xl bg-[#0079BF] flex items-center justify-center shadow-lg shadow-[#0079BF]/20">
              <Trello className="w-8 h-8 text-white" />
            </div>
            <span className="text-3xl text-muted-foreground/50">+</span>
            <div className="w-16 h-16 rounded-2xl bg-[#4285F4] flex items-center justify-center shadow-lg shadow-[#4285F4]/20">
              <FolderOpen className="w-8 h-8 text-white" />
            </div>
            <span className="text-3xl text-muted-foreground/50">=</span>
            <div className="w-16 h-16 rounded-2xl bg-destructive/20 border border-destructive/30 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-8"
          >
            Drowning in Tabs?{" "}
            <span className="text-destructive">That's Not Scaling.</span>
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            You didn't start an agency to play traffic cop with files and messages.
          </motion.p>
        </div>

        {/* Problem Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {problems.map((problem, index) => (
            <motion.div
              key={problem.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className="glass-card-premium rounded-3xl p-8 border-destructive/10 hover:border-destructive/20 transition-all duration-300 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6 group-hover:bg-destructive/20 transition-colors duration-300">
                <problem.icon className="w-7 h-7 text-destructive" />
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-foreground tracking-tight">
                {problem.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {problem.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;