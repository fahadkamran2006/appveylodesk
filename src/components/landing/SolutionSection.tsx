import { useRef } from "react";
import { Shield, Users, LayoutDashboard, FileCheck, DollarSign, Upload, Eye, CheckCircle, BarChart3, MessageSquare, Calendar, Clock } from "lucide-react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { TextReveal, ScrollFade, LineReveal } from "./ScrollAnimations";

const dashboardViews = [
  {
    id: "admin",
    label: "Admin View",
    title: "Total Control at a Glance",
    subtitle: "See everything. Manage everyone. Scale your agency confidently with real-time insights.",
    features: [
      { icon: LayoutDashboard, text: "Kanban board for all projects", desc: "Drag & drop tasks across stages" },
      { icon: DollarSign, text: "Revenue & invoice tracking", desc: "Generate invoices, track payments" },
      { icon: Users, text: "Client & editor management", desc: "One place for all relationships" },
      { icon: BarChart3, text: "Performance analytics", desc: "Revenue trends and team metrics" },
    ],
    color: "primary",
    urlBar: "app.veylodesk.com/admin/dashboard",
    side: "left" as const,
    mockup: "admin",
  },
  {
    id: "client",
    label: "Client View",
    title: "Simple, Clean Approvals",
    subtitle: "Clients see their project progress without the noise. No learning curve, just clarity.",
    features: [
      { icon: Eye, text: "Real-time project status", desc: "Always know where things stand" },
      { icon: FileCheck, text: "Easy file downloads", desc: "One-click access to deliverables" },
      { icon: CheckCircle, text: "One-click approvals", desc: "Approve videos instantly" },
      { icon: MessageSquare, text: "Built-in messaging", desc: "Feedback without email chaos" },
    ],
    color: "success",
    urlBar: "app.veylodesk.com/client/projects",
    side: "right" as const,
    mockup: "client",
  },
  {
    id: "editor",
    label: "Editor View",
    title: "Clear Tasks, Fair Pay",
    subtitle: "Editors know exactly what to do next. Track earnings, upload files, and stay on schedule.",
    features: [
      { icon: Upload, text: "Direct file uploads", desc: "Upload deliverables to projects" },
      { icon: DollarSign, text: "Earnings dashboard", desc: "Track payments and bonuses" },
      { icon: Clock, text: "Attendance tracking", desc: "Check in/out with work logs" },
      { icon: Calendar, text: "Task calendar view", desc: "See deadlines at a glance" },
    ],
    color: "warning",
    urlBar: "app.veylodesk.com/editor/tasks",
    side: "left" as const,
    mockup: "editor",
  },
];

// Individual dashboard mockup content
function AdminMockup() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h4 className="font-semibold text-base text-foreground">Command Center</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Welcome back, Agency Owner</p>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-success/10 border border-success/20 text-success text-xs font-medium">
          5 Active
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Revenue", value: "$47,280", change: "+12%", changeColor: "text-success" },
          { label: "Clients", value: "18", change: "3 pending", changeColor: "text-muted-foreground" },
          { label: "Invoices", value: "$8,450", change: "4 unpaid", changeColor: "text-warning" },
        ].map((s) => (
          <div key={s.label} className="glass-card-premium rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-1">{s.label}</p>
            <p className="text-lg font-bold text-foreground">{s.value}</p>
            <p className={`text-[10px] mt-0.5 ${s.changeColor}`}>{s.change}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {["Backlog", "In Progress", "Review", "Done"].map((status, i) => (
          <div key={status} className="glass rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <div className={`w-1.5 h-1.5 rounded-full ${
                i === 0 ? "bg-muted-foreground" : i === 1 ? "bg-primary" : i === 2 ? "bg-warning" : "bg-success"
              }`} />
              <span className="text-[10px] font-medium text-foreground">{status}</span>
            </div>
            {[...Array(i === 1 ? 2 : 1)].map((_, j) => (
              <div key={j} className="p-2 rounded bg-midnight-deep/60 border border-white/[0.04] mb-1.5">
                <div className="h-1.5 w-3/4 bg-muted/40 rounded mb-1" />
                <div className="h-1.5 w-1/2 bg-muted/20 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientMockup() {
  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-base text-foreground mb-5">Your Projects</h4>
      {[
        { name: "Brand Video Q4", status: "In Review", progress: 90, statusColor: "text-success" },
        { name: "Social Ads Pack", status: "In Progress", progress: 45, statusColor: "text-primary" },
        { name: "Product Launch", status: "Completed", progress: 100, statusColor: "text-success" },
      ].map((project) => (
        <div key={project.name} className="p-4 rounded-xl bg-muted/20 border border-white/[0.04]">
          <div className="flex justify-between mb-2">
            <span className="font-medium text-sm text-foreground">{project.name}</span>
            <span className={`text-xs ${project.statusColor}`}>{project.status}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-indigo-soft rounded-full transition-all duration-1000"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EditorMockup() {
  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-base text-foreground mb-5">Your Tasks</h4>
      {[
        { name: "Edit Intro Sequence", client: "TechCorp", due: "Today", urgent: true },
        { name: "Color Grading - Ep3", client: "Startup X", due: "Tomorrow", urgent: false },
        { name: "Sound Design Pass", client: "Brand Co", due: "Wed", urgent: false },
      ].map((task) => (
        <div key={task.name} className="p-4 rounded-xl bg-muted/20 border border-white/[0.04] flex items-center justify-between">
          <div>
            <p className="font-medium text-sm text-foreground">{task.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{task.client}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-[10px] font-medium ${
            task.urgent
              ? "bg-warning/10 text-warning border border-warning/20"
              : "bg-muted/30 text-muted-foreground border border-white/[0.04]"
          }`}>
            {task.due}
          </span>
        </div>
      ))}
    </div>
  );
}

const mockupComponents: Record<string, React.FC> = {
  admin: AdminMockup,
  client: ClientMockup,
  editor: EditorMockup,
};

// Single dashboard view block with 3D tilt
function DashboardViewBlock({ view, index }: { view: typeof dashboardViews[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });

  const isLeft = view.side === "left";
  
  // 3D entrance animation driven by scroll
  const rotateY = useTransform(scrollYProgress, [0, 0.6, 1], [isLeft ? -25 : 25, isLeft ? -8 : 8, 0]);
  const x = useTransform(scrollYProgress, [0, 0.6, 1], [isLeft ? -120 : 120, isLeft ? -20 : 20, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.6], [0, 0.5, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.6, 1], [0.85, 0.95, 1]);

  const springRotateY = useSpring(rotateY, { stiffness: 80, damping: 25 });
  const springX = useSpring(x, { stiffness: 80, damping: 25 });
  const springScale = useSpring(scale, { stiffness: 80, damping: 25 });

  // Text side animation
  const textX = useTransform(scrollYProgress, [0, 0.5, 1], [isLeft ? 80 : -80, isLeft ? 15 : -15, 0]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.4, 0.7], [0, 0.3, 1]);
  const springTextX = useSpring(textX, { stiffness: 80, damping: 25 });

  const MockupComponent = mockupComponents[view.mockup];

  const colorMap: Record<string, string> = {
    primary: "bg-primary/20 text-primary",
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning",
  };

  const glowColorMap: Record<string, string> = {
    primary: "from-primary/20 via-transparent to-indigo-soft/20",
    success: "from-success/15 via-transparent to-emerald-500/10",
    warning: "from-warning/15 via-transparent to-amber-500/10",
  };

  const dashboardCard = (
    <motion.div
      style={{
        rotateY: springRotateY,
        x: springX,
        opacity,
        scale: springScale,
        perspective: 1200,
        transformStyle: "preserve-3d",
      }}
      className="w-full lg:w-[55%]"
    >
      <div className="relative">
        {/* Glow */}
        <div className={`absolute -inset-6 bg-gradient-to-r ${glowColorMap[view.color]} rounded-3xl blur-2xl opacity-60`} />
        
        <div className="relative glass-card-premium rounded-2xl overflow-hidden border border-white/[0.08]">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-surface-dark/50">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-destructive/60" />
              <div className="w-2 h-2 rounded-full bg-warning/60" />
              <div className="w-2 h-2 rounded-full bg-success/60" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-3 py-1 rounded-md bg-muted/20 text-[10px] text-muted-foreground font-mono">
                {view.urlBar}
              </div>
            </div>
          </div>
          
          <div className="p-5 min-h-[300px] bg-gradient-cinematic">
            <MockupComponent />
          </div>
        </div>
      </div>
    </motion.div>
  );

  const textContent = (
    <motion.div
      style={{ x: springTextX, opacity: textOpacity }}
      className="w-full lg:w-[45%] flex flex-col justify-center"
    >
      {/* View label */}
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full w-fit mb-6 ${
        view.color === "primary" ? "bg-primary/10 border border-primary/20" :
        view.color === "success" ? "bg-success/10 border border-success/20" :
        "bg-warning/10 border border-warning/20"
      }`}>
        <span className={`text-sm font-medium tracking-wide ${
          view.color === "primary" ? "text-primary" :
          view.color === "success" ? "text-success" : "text-warning"
        }`}>
          {view.label}
        </span>
      </div>

      <h3 className="text-3xl md:text-4xl font-bold mb-4 text-foreground tracking-tight leading-tight">
        {view.title}
      </h3>
      <p className="text-base text-muted-foreground mb-8 leading-relaxed">
        {view.subtitle}
      </p>

      <div className="space-y-3">
        {view.features.map((feature, i) => (
          <motion.div
            key={feature.text}
            initial={{ opacity: 0, x: isLeft ? 20 : -20, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-start gap-4 p-3.5 rounded-xl bg-surface-glass/30 border border-white/[0.06] backdrop-blur-sm"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorMap[view.color]}`}>
              <feature.icon className="w-5 h-5" />
            </div>
            <div>
              <span className="font-medium text-sm text-foreground">{feature.text}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{feature.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  return (
    <div ref={ref} className="py-20 lg:py-32">
      <div className={`flex flex-col lg:flex-row items-center gap-10 lg:gap-16 ${
        isLeft ? "" : "lg:flex-row-reverse"
      }`}>
        {dashboardCard}
        {textContent}
      </div>
    </div>
  );
}

const SolutionSection = () => {
  return (
    <section id="features" className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-cinematic" />
      <LineReveal className="absolute top-0 left-0 right-0" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-glow opacity-30" />

      <div className="container relative z-10 mx-auto px-6">
        {/* Header */}
        <div className="max-w-4xl mx-auto text-center pt-24 pb-8">
          <ScrollFade>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-success/10 border border-success/20 mb-6">
              <Shield className="w-4 h-4 text-success" />
              <span className="text-sm font-medium text-success tracking-wide">The Solution</span>
            </div>
          </ScrollFade>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            <TextReveal staggerDelay={0.05}>One tab. Your entire agency.</TextReveal>{" "}
            <span className="text-gradient">
              <TextReveal staggerDelay={0.05}>Your clients impressed from day one.</TextReveal>
            </span>
          </h2>
          <ScrollFade delay={0.2}>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Everyone gets exactly what they need — a dedicated view built for their role.
            </p>
          </ScrollFade>
        </div>

        {/* Dashboard views - alternating left/right with 3D */}
        {dashboardViews.map((view, index) => (
          <DashboardViewBlock key={view.id} view={view} index={index} />
        ))}
      </div>
    </section>
  );
};

export default SolutionSection;
