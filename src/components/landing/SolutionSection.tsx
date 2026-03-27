import { useRef } from "react";
import { Shield, Users, LayoutDashboard, FileCheck, DollarSign, Upload, Eye, CheckCircle, BarChart3, MessageSquare, Calendar, Clock } from "lucide-react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { TextReveal, ScrollFade, LineReveal } from "./ScrollAnimations";
import dashboardPreview from "@/assets/dashboard-preview.png";
import clientViewPreview from "@/assets/client-view-preview.png";

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
    side: "left" as const,
    image: dashboardPreview,
    imageAlt: "Admin Command Center Dashboard",
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
    side: "right" as const,
    image: clientViewPreview,
    imageAlt: "Client Projects View",
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
    side: "left" as const,
    image: null,
    imageAlt: "Editor Tasks View",
  },
];

// Fallback mockup for editor (no screenshot yet)
function EditorMockup() {
  return (
    <div className="p-5 min-h-[300px] bg-gradient-cinematic">
      <h4 className="font-semibold text-base text-foreground mb-5">Your Tasks</h4>
      {[
        { name: "Edit Intro Sequence", client: "TechCorp", due: "Today", urgent: true },
        { name: "Color Grading - Ep3", client: "Startup X", due: "Tomorrow", urgent: false },
        { name: "Sound Design Pass", client: "Brand Co", due: "Wed", urgent: false },
      ].map((task) => (
        <div key={task.name} className="p-4 rounded-xl bg-muted/20 border border-white/[0.04] flex items-center justify-between mb-3">
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

function DashboardViewBlock({ view, index }: { view: typeof dashboardViews[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });

  const isLeft = view.side === "left";
  
  const rotateY = useTransform(scrollYProgress, [0, 0.6, 1], [isLeft ? -25 : 25, isLeft ? -8 : 8, 0]);
  const x = useTransform(scrollYProgress, [0, 0.6, 1], [isLeft ? -120 : 120, isLeft ? -20 : 20, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.6], [0, 0.5, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.6, 1], [0.85, 0.95, 1]);

  const springRotateY = useSpring(rotateY, { stiffness: 80, damping: 25 });
  const springX = useSpring(x, { stiffness: 80, damping: 25 });
  const springScale = useSpring(scale, { stiffness: 80, damping: 25 });

  const textX = useTransform(scrollYProgress, [0, 0.5, 1], [isLeft ? 80 : -80, isLeft ? 15 : -15, 0]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.4, 0.7], [0, 0.3, 1]);
  const springTextX = useSpring(textX, { stiffness: 80, damping: 25 });

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
        <div className={`absolute -inset-6 bg-gradient-to-r ${glowColorMap[view.color]} rounded-3xl blur-2xl opacity-60`} />
        
        <div className="relative glass-card-premium rounded-2xl overflow-hidden border border-white/[0.08]">
          {view.image ? (
            <img
              src={view.image}
              alt={view.imageAlt}
              className="w-full h-auto block"
              loading="lazy"
            />
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-surface-dark/50">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-destructive/60" />
                  <div className="w-2 h-2 rounded-full bg-warning/60" />
                  <div className="w-2 h-2 rounded-full bg-success/60" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-3 py-1 rounded-md bg-muted/20 text-[10px] text-muted-foreground font-mono">
                    app.veylodesk.com/editor/tasks
                  </div>
                </div>
              </div>
              <EditorMockup />
            </>
          )}
        </div>
      </div>
    </motion.div>
  );

  const textContent = (
    <motion.div
      style={{ x: springTextX, opacity: textOpacity }}
      className="w-full lg:w-[45%] flex flex-col justify-center"
    >
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
            initial={{ opacity: 0, x: isLeft ? 30 : -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
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
      <div className="absolute inset-0 bg-gradient-cinematic" />
      <LineReveal className="absolute top-0 left-0 right-0" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-glow opacity-30" />

      <div className="container relative z-10 mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center pt-24 pb-8">
          <ScrollFade>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-success/10 border border-success/20 mb-6">
              <Shield className="w-4 h-4 text-success" />
              <span className="text-sm font-medium text-success tracking-wide">The Solution</span>
            </div>
          </ScrollFade>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            <TextReveal staggerDelay={0.05}>Three Dashboards.</TextReveal>{" "}
            <span className="text-gradient">
              <TextReveal staggerDelay={0.05}>Zero Confusion.</TextReveal>
            </span>
          </h2>
          <ScrollFade delay={0.2}>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Everyone gets exactly what they need — a dedicated view built for their role.
            </p>
          </ScrollFade>
        </div>

        {dashboardViews.map((view, index) => (
          <DashboardViewBlock key={view.id} view={view} index={index} />
        ))}
      </div>
    </section>
  );
};

export default SolutionSection;
