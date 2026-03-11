import { useRef } from "react";
import { Shield, Users, LayoutDashboard, FileCheck, DollarSign, Upload, Eye, CheckCircle } from "lucide-react";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { TextReveal, ScrollFade, TiltCard, LineReveal } from "./ScrollAnimations";

type ViewType = "admin" | "client" | "editor";

const SolutionSection = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeView, setActiveView] = useState<ViewType>("admin");

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Map scroll progress to view transitions
  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (progress < 0.33) {
      setActiveView("admin");
    } else if (progress < 0.66) {
      setActiveView("client");
    } else {
      setActiveView("editor");
    }
  });

  // Progress bar for current section
  const adminProgress = useTransform(scrollYProgress, [0, 0.33], [0, 100]);
  const clientProgress = useTransform(scrollYProgress, [0.33, 0.66], [0, 100]);
  const editorProgress = useTransform(scrollYProgress, [0.66, 1], [0, 100]);

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
      urlBar: "app.veylodesk.com/admin/dashboard",
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
      urlBar: "app.veylodesk.com/client/projects",
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
      urlBar: "app.veylodesk.com/editor/tasks",
    },
  };

  const currentView = views[activeView];

  return (
    <section 
      ref={sectionRef} 
      id="features" 
      className="relative overflow-hidden"
      style={{ height: "300vh" }} // 3x viewport for scroll-controlled sections
    >
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-gradient-cinematic" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-glow opacity-40" />

      {/* Sticky container */}
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        <div className="container relative z-10 mx-auto px-6">
          {/* Header */}
          <div className="max-w-4xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-success/10 border border-success/20 mb-6">
              <Shield className="w-4 h-4 text-success" />
              <span className="text-sm font-medium text-success tracking-wide">The Solution</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Three Dashboards.{" "}
              <span className="text-gradient">Zero Confusion.</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Everyone gets exactly what they need—scroll to explore each view.
            </p>
          </div>

          {/* Scroll Progress Indicators */}
          <div className="flex justify-center gap-3 mb-10">
            {(["admin", "client", "editor"] as ViewType[]).map((view) => (
              <div
                key={view}
                className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-500 ${
                  activeView === view
                    ? "bg-primary/15 border border-primary/30 shadow-lg shadow-primary/10"
                    : "bg-muted/20 border border-white/[0.04]"
                }`}
              >
                <span className={`text-sm font-medium transition-colors duration-300 ${
                  activeView === view ? "text-primary" : "text-muted-foreground"
                }`}>
                  {view === "admin" && "Admin View"}
                  {view === "client" && "Client View"}
                  {view === "editor" && "Editor View"}
                </span>
                {/* Mini progress bar */}
                <div className="w-12 h-1 rounded-full bg-muted/30 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: view === "admin" ? adminProgress.get() + "%" :
                             view === "client" ? clientProgress.get() + "%" :
                             editorProgress.get() + "%",
                    }}
                    animate={{
                      width: activeView === view ? "100%" : 
                             (view === "admin" && (activeView === "client" || activeView === "editor")) ? "100%" :
                             (view === "client" && activeView === "editor") ? "100%" : "0%",
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* View Content with 3D transitions */}
          <div className="max-w-6xl mx-auto">
            <TiltCard intensity={4}>
              <div className="glass-card-premium rounded-3xl p-8 md:p-12 overflow-hidden">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                  {/* Left - Features */}
                  <div>
                    <motion.div
                      key={activeView}
                      initial={{ opacity: 0, x: -40, rotateY: -10 }}
                      animate={{ opacity: 1, x: 0, rotateY: 0 }}
                      exit={{ opacity: 0, x: 40, rotateY: 10 }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      style={{ perspective: 1000 }}
                    >
                      <h3 className="text-3xl md:text-4xl font-bold mb-4 text-foreground tracking-tight">
                        {currentView.title}
                      </h3>
                      <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                        {currentView.subtitle}
                      </p>

                      <div className="space-y-4">
                        {currentView.features.map((feature, index) => (
                          <motion.div
                            key={feature.text}
                            initial={{ opacity: 0, x: -30, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            transition={{ 
                              duration: 0.4, 
                              delay: index * 0.12,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="flex items-center gap-5 p-4 rounded-2xl bg-surface-glass/30 border border-white/[0.06] backdrop-blur-xl"
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
                  </div>

                  {/* Right - Preview with 3D flip */}
                  <div className="relative" style={{ perspective: 1200 }}>
                    <div className="absolute -inset-6 bg-gradient-to-r from-primary/15 via-transparent to-indigo-soft/15 rounded-3xl blur-2xl opacity-60" />
                    <div className="relative glass rounded-2xl overflow-hidden border border-white/[0.08]">
                      {/* Browser chrome */}
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-surface-dark/50">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                          <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                          <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
                        </div>
                        <motion.div 
                          key={currentView.urlBar}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex-1 flex justify-center"
                        >
                          <div className="px-4 py-1 rounded-md bg-muted/20 text-xs text-muted-foreground font-mono">
                            {currentView.urlBar}
                          </div>
                        </motion.div>
                      </div>
                      
                      <motion.div
                        key={activeView}
                        initial={{ opacity: 0, rotateY: 15, scale: 0.95 }}
                        animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="p-6 min-h-[350px]"
                      >
                        {activeView === "admin" && (
                          <div className="space-y-5">
                            <div className="flex items-center justify-between mb-6">
                              <h4 className="font-semibold text-lg text-foreground">Project Pipeline</h4>
                              <span className="text-sm text-muted-foreground">This week</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              {[
                                { label: "Backlog", value: "3", style: "bg-muted/20 border border-white/[0.04]" },
                                { label: "In Progress", value: "5", style: "bg-primary/10 border border-primary/20" },
                                { label: "Review", value: "2", style: "bg-warning/10 border border-warning/20" },
                                { label: "Done", value: "8", style: "bg-success/10 border border-success/20" },
                              ].map((item, i) => (
                                <motion.div 
                                  key={item.label}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: i * 0.1, duration: 0.4 }}
                                  className={`p-4 rounded-xl ${item.style}`}
                                >
                                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                                  <p className={`text-2xl font-bold ${
                                    i === 1 ? "text-primary" : i === 2 ? "text-warning" : i === 3 ? "text-success" : "text-foreground"
                                  }`}>{item.value}</p>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}
                        {activeView === "client" && (
                          <div className="space-y-5">
                            <h4 className="font-semibold text-lg text-foreground mb-6">Your Projects</h4>
                            {[
                              { name: "Brand Video Q4", status: "In Review", progress: 90 },
                              { name: "Social Ads Pack", status: "In Progress", progress: 45 },
                            ].map((project, i) => (
                              <motion.div 
                                key={project.name} 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.15, duration: 0.4 }}
                                className="p-5 rounded-xl bg-muted/20 border border-white/[0.04]"
                              >
                                <div className="flex justify-between mb-3">
                                  <span className="font-medium text-foreground">{project.name}</span>
                                  <span className="text-sm text-success">{project.status}</span>
                                </div>
                                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                                  <motion.div 
                                    className="h-full bg-gradient-to-r from-primary to-indigo-soft rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${project.progress}%` }}
                                    transition={{ duration: 1, delay: 0.3 + i * 0.2, ease: "easeOut" }}
                                  />
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                        {activeView === "editor" && (
                          <div className="space-y-5">
                            <h4 className="font-semibold text-lg text-foreground mb-6">Your Tasks</h4>
                            {[
                              { name: "Edit Intro Sequence", client: "TechCorp", due: "Today" },
                              { name: "Color Grading - Ep3", client: "Startup X", due: "Tomorrow" },
                            ].map((task, i) => (
                              <motion.div 
                                key={task.name} 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.15, duration: 0.4 }}
                                className="p-5 rounded-xl bg-muted/20 border border-white/[0.04] flex items-center justify-between"
                              >
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
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            </TiltCard>
          </div>

          {/* Scroll hint */}
          <motion.div 
            className="flex justify-center mt-8"
            animate={{ opacity: [0.3, 0.7, 0.3], y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <p className="text-sm text-muted-foreground">↓ Scroll to explore views</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
