import { MessageSquare, Trello, FolderOpen, AlertTriangle, Clock, Brain } from "lucide-react";

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
      description: "Clients in Slack, editors in WhatsApp, feedback in email. Context is lost, mistakes are made.",
    },
    {
      icon: Brain,
      title: "Mental Overload",
      description: "Remembering which project is where, who needs what, and when invoices are due. It's exhausting.",
    },
  ];

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-surface-dark" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      
      <div className="container relative z-10 mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-16">
          {/* The Chaos Visual */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-xl bg-[#4A154B] flex items-center justify-center shadow-lg">
              <MessageSquare className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl text-muted-foreground">+</span>
            <div className="w-14 h-14 rounded-xl bg-[#0079BF] flex items-center justify-center shadow-lg">
              <Trello className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl text-muted-foreground">+</span>
            <div className="w-14 h-14 rounded-xl bg-[#4285F4] flex items-center justify-center shadow-lg">
              <FolderOpen className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl text-muted-foreground">=</span>
            <div className="w-14 h-14 rounded-xl bg-destructive/20 border border-destructive/30 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Drowning in Tabs?{" "}
            <span className="text-destructive">That's Not Scaling.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            You didn't start an agency to play traffic cop with files and messages.
            But here you are, juggling 12 tools just to get one project out the door.
          </p>
        </div>

        {/* Problem Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {problems.map((problem, index) => (
            <div
              key={problem.title}
              className="glass-card rounded-2xl p-6 border-destructive/10 hover:border-destructive/20 transition-colors group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4 group-hover:bg-destructive/20 transition-colors">
                <problem.icon className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">
                {problem.title}
              </h3>
              <p className="text-muted-foreground">
                {problem.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
