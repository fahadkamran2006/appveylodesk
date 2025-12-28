import { useState } from "react";
import { Shield, Users, Palette, LayoutDashboard, FileCheck, DollarSign, Upload, Eye, CheckCircle } from "lucide-react";

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
    <section id="features" className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-glow opacity-30" />

      <div className="container relative z-10 mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/20 mb-6">
            <Shield className="w-4 h-4 text-success" />
            <span className="text-sm font-medium text-success">The Solution</span>
          </div>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Three Dashboards.{" "}
            <span className="text-gradient">Zero Confusion.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your clients see progress. Your editors see tasks. You see peace.
            Everyone gets exactly what they need—nothing more, nothing less.
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex p-1.5 rounded-xl bg-muted/50 border border-border/50">
            {(["admin", "client", "editor"] as ViewType[]).map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  activeView === view
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {view === "admin" && "Admin View"}
                {view === "client" && "Client View"}
                {view === "editor" && "Editor View"}
              </button>
            ))}
          </div>
        </div>

        {/* View Content */}
        <div className="max-w-5xl mx-auto">
          <div className="glass-card rounded-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Left - Features */}
              <div>
                <h3 className="text-2xl md:text-3xl font-bold mb-3 text-foreground">
                  {currentView.title}
                </h3>
                <p className="text-muted-foreground mb-8">
                  {currentView.subtitle}
                </p>

                <div className="space-y-4">
                  {currentView.features.map((feature, index) => (
                    <div
                      key={feature.text}
                      className="flex items-center gap-4 p-4 rounded-xl bg-surface-glass/50 border border-border/30 animate-fade-up"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        activeView === "admin" ? "bg-primary/20 text-primary" :
                        activeView === "client" ? "bg-success/20 text-success" :
                        "bg-warning/20 text-warning"
                      }`}>
                        <feature.icon className="w-5 h-5" />
                      </div>
                      <span className="font-medium text-foreground">{feature.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right - Preview */}
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 rounded-2xl blur-xl opacity-50" />
                <div className="relative glass rounded-xl p-6 min-h-[300px]">
                  {activeView === "admin" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="font-semibold text-foreground">Project Pipeline</h4>
                        <span className="text-sm text-muted-foreground">This week</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground">Backlog</p>
                          <p className="text-xl font-bold text-foreground">3</p>
                        </div>
                        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                          <p className="text-xs text-muted-foreground">In Progress</p>
                          <p className="text-xl font-bold text-primary">5</p>
                        </div>
                        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                          <p className="text-xs text-muted-foreground">Review</p>
                          <p className="text-xl font-bold text-warning">2</p>
                        </div>
                        <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                          <p className="text-xs text-muted-foreground">Done</p>
                          <p className="text-xl font-bold text-success">8</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {activeView === "client" && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground mb-4">Your Projects</h4>
                      {[
                        { name: "Brand Video Q4", status: "In Review", progress: 90 },
                        { name: "Social Ads Pack", status: "In Progress", progress: 45 },
                      ].map((project) => (
                        <div key={project.name} className="p-4 rounded-lg bg-muted/30">
                          <div className="flex justify-between mb-2">
                            <span className="font-medium text-foreground">{project.name}</span>
                            <span className="text-sm text-success">{project.status}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
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
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground mb-4">Your Tasks</h4>
                      {[
                        { name: "Edit Intro Sequence", client: "TechCorp", due: "Today" },
                        { name: "Color Grading - Ep3", client: "Startup X", due: "Tomorrow" },
                      ].map((task) => (
                        <div key={task.name} className="p-4 rounded-lg bg-muted/30 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{task.name}</p>
                            <p className="text-sm text-muted-foreground">{task.client}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            task.due === "Today" 
                              ? "bg-warning/10 text-warning border border-warning/20" 
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {task.due}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
