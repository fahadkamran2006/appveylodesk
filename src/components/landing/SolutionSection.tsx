import { useState } from "react";
import { Shield, Users, LayoutDashboard, FileCheck, DollarSign, Upload, Eye, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ViewType = "admin" | "client" | "editor";

const SolutionSection = () => {
  const [activeView, setActiveView] = useState<ViewType>("admin");

  const views = {
    admin: {
      title: "Total Control",
      subtitle: "See everything. Manage everyone. Scale confidently.",
      features: [
        { icon: LayoutDashboard, text: "Kanban board for all projects" },
        { icon: DollarSign, text: "Revenue & invoice tracking" },
        { icon: Users, text: "Client & editor management" },
      ],
      color: "primary",
    },
    client: {
      title: "Simple Approvals",
      subtitle: "Clients see progress without the noise.",
      features: [
        { icon: Eye, text: "Real-time project status" },
        { icon: FileCheck, text: "Easy file downloads" },
        { icon: CheckCircle, text: "One-click approvals" },
      ],
      color: "success",
    },
    editor: {
      title: "Clear Tasks",
      subtitle: "Editors know exactly what to do next.",
      features: [
        { icon: Upload, text: "Direct file uploads" },
        { icon: DollarSign, text: "Earnings dashboard" },
        { icon: CheckCircle, text: "Task completion tracking" },
      ],
      color: "warning",
    },
  };

  const currentView = views[activeView];

  return (
    <section id="features" className="relative py-40 lg:py-52 overflow-hidden">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-gradient-cinematic" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-glow opacity-40" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-glow-soft rounded-full blur-[100px]" />

      <div className="container relative z-10 mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="max-w-4xl mx-auto text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-success/10 border border-success/20 mb-8">
            <Shield className="w-4 h-4 text-success" />
            <span className="text-sm font-medium text-success tracking-wide">The Solution</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-8">
            Three Dashboards.{" "}
            <span className="text-gradient">Zero Confusion.</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Everyone gets exactly what they need—nothing more, nothing less.
          </p>
        </motion.div>

        {/* View Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex justify-center mb-16"
        >
          <div className="inline-flex p-2 rounded-2xl bg-muted/30 border border-white/[0.06] backdrop-blur-xl">
            {(["admin", "client", "editor"] as ViewType[]).map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`px-8 py-4 rounded-xl font-medium transition-all duration-300 ${
                  activeView === view
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {view === "admin" && "Admin View"}
                {view === "client" && "Client View"}
                {view === "editor" && "Editor View"}
              </button>
            ))}
          </div>
        </motion.div>

        {/* View Content */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="max-w-6xl mx-auto"
        >
          <div className="glass-card-premium rounded-3xl p-10 md:p-14">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              {/* Left - Features */}
              <div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeView}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3 className="text-3xl md:text-4xl font-bold mb-4 text-foreground tracking-tight">
                      {currentView.title}
                    </h3>
                    <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
                      {currentView.subtitle}
                    </p>

                    <div className="space-y-5">
                      {currentView.features.map((feature, index) => (
                        <motion.div
                          key={feature.text}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.1 }}
                          className="flex items-center gap-5 p-5 rounded-2xl bg-surface-glass/30 border border-white/[0.06] backdrop-blur-xl"
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            activeView === "admin" ? "bg-primary/20 text-primary" :
                            activeView === "client" ? "bg-success/20 text-success" :
                            "bg-warning/20 text-warning"
                          }`}>
                            <feature.icon className="w-6 h-6" />
                          </div>
                          <span className="font-medium text-lg text-foreground">{feature.text}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Right - Preview */}
              <div className="relative">
                <div className="absolute -inset-6 bg-gradient-to-r from-primary/15 via-transparent to-indigo-soft/15 rounded-3xl blur-2xl opacity-60" />
                <div className="relative glass rounded-2xl p-8 min-h-[350px] border border-white/[0.08]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeView}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                    >
                      {activeView === "admin" && (
                        <div className="space-y-5">
                          <div className="flex items-center justify-between mb-8">
                            <h4 className="font-semibold text-lg text-foreground">Project Pipeline</h4>
                            <span className="text-sm text-muted-foreground">This week</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-muted/20 border border-white/[0.04]">
                              <p className="text-xs text-muted-foreground mb-1">Backlog</p>
                              <p className="text-2xl font-bold text-foreground">3</p>
                            </div>
                            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                              <p className="text-xs text-muted-foreground mb-1">In Progress</p>
                              <p className="text-2xl font-bold text-primary">5</p>
                            </div>
                            <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
                              <p className="text-xs text-muted-foreground mb-1">Review</p>
                              <p className="text-2xl font-bold text-warning">2</p>
                            </div>
                            <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                              <p className="text-xs text-muted-foreground mb-1">Done</p>
                              <p className="text-2xl font-bold text-success">8</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {activeView === "client" && (
                        <div className="space-y-5">
                          <h4 className="font-semibold text-lg text-foreground mb-6">Your Projects</h4>
                          {[
                            { name: "Brand Video Q4", status: "In Review", progress: 90 },
                            { name: "Social Ads Pack", status: "In Progress", progress: 45 },
                          ].map((project) => (
                            <div key={project.name} className="p-5 rounded-xl bg-muted/20 border border-white/[0.04]">
                              <div className="flex justify-between mb-3">
                                <span className="font-medium text-foreground">{project.name}</span>
                                <span className="text-sm text-success">{project.status}</span>
                              </div>
                              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-primary to-indigo-soft rounded-full transition-all"
                                  style={{ width: `${project.progress}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {activeView === "editor" && (
                        <div className="space-y-5">
                          <h4 className="font-semibold text-lg text-foreground mb-6">Your Tasks</h4>
                          {[
                            { name: "Edit Intro Sequence", client: "TechCorp", due: "Today" },
                            { name: "Color Grading - Ep3", client: "Startup X", due: "Tomorrow" },
                          ].map((task) => (
                            <div key={task.name} className="p-5 rounded-xl bg-muted/20 border border-white/[0.04] flex items-center justify-between">
                              <div>
                                <p className="font-medium text-foreground">{task.name}</p>
                                <p className="text-sm text-muted-foreground mt-1">{task.client}</p>
                              </div>
                              <span className={`px-4 py-1.5 rounded-full text-xs font-medium ${
                                task.due === "Today" 
                                  ? "bg-warning/10 text-warning border border-warning/20" 
                                  : "bg-muted/30 text-muted-foreground border border-white/[0.04]"
                              }`}>
                                {task.due}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default SolutionSection;