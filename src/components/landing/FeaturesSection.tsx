import { useRef } from "react";
import {
  Monitor, MessageSquare, FileText, FolderKanban,
  MessageCircle, UserCog, CalendarClock, ChevronRight
} from "lucide-react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
} from "framer-motion";

/* ──────────────────────────────────────────
   Feature data
   ────────────────────────────────────────── */
const features = [
  {
    id: "dashboards",
    icon: Monitor,
    tag: "Dashboards",
    title: "Dedicated Client & Editor Portals",
    description:
      "Give clients a premium portal to view projects and approve deliverables. Give editors a distraction-free workspace with only what they need.",
    bullets: [
      "Role-specific views — zero clutter",
      "Branded white-label client portal",
      "Editor task queue with deadlines",
    ],
    mockup: "dashboards",
  },
  {
    id: "approval",
    icon: MessageCircle,
    tag: "Video Review",
    title: "Next-Gen Video Approval",
    description:
      "Time-stamped, frame-accurate client comments — no account required. Share a link, collect feedback, iterate faster.",
    bullets: [
      "Frame-accurate timestamped comments",
      "No sign-up required for reviewers",
      "Version comparison side-by-side",
    ],
    mockup: "approval",
  },
  {
    id: "invoicing",
    icon: FileText,
    tag: "Invoicing",
    title: "Automated Invoicing & Payments",
    description:
      "Lock final master files behind a paywall. Auto-generate branded invoices and track every dollar in real time.",
    bullets: [
      "One-click invoice generation",
      "Payment link integration",
      "Automatic payment tracking",
    ],
    mockup: "invoicing",
  },
  {
    id: "projects",
    icon: FolderKanban,
    tag: "Projects",
    title: "End-to-End Project Management",
    description:
      "Track footage to final delivery in one centralized, drag-and-drop Kanban board. Never lose a project again.",
    bullets: [
      "Kanban board with custom statuses",
      "File management per project",
      "Deadline & budget tracking",
    ],
    mockup: "projects",
  },
  {
    id: "messaging",
    icon: MessageSquare,
    tag: "Messaging",
    title: "Real-Time Built-In Messaging",
    description:
      "Replace messy Slack channels with contextual, project-linked conversations. Voice notes, reactions, attachments — all built in.",
    bullets: [
      "Project-specific chat channels",
      "Voice notes & file attachments",
      "Read receipts & typing indicators",
    ],
    mockup: "messaging",
  },
  {
    id: "editors",
    icon: UserCog,
    tag: "Editor Mgmt",
    title: "Intelligent Editor Management",
    description:
      "Auto-assign pending videos to available editors. They report finished tasks directly — you review and approve.",
    bullets: [
      "Smart task assignment",
      "Performance leaderboard",
      "Per-project & per-editor payouts",
    ],
    mockup: "editors",
  },
  {
    id: "hr",
    icon: CalendarClock,
    tag: "HR & Attendance",
    title: "In-House Team HR & Attendance",
    description:
      "Track daily check-ins, work summaries, and leave requests for your salaried team. Payroll-ready reports every month.",
    bullets: [
      "One-tap check-in / check-out",
      "Leave request & approval flow",
      "Monthly attendance reports",
    ],
    mockup: "hr",
  },
];

/* ──────────────────────────────────────────
   Animated progress bar (hooks-safe)
   ────────────────────────────────────────── */
function AnimatedBar({ scrollProgress, range, target }: { scrollProgress: import("framer-motion").MotionValue<number>; range: [number, number]; target: number }) {
  const width = useTransform(scrollProgress, range, ["0%", `${target}%`]);
  return (
    <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
      <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-soft" style={{ width }} />
    </div>
  );
}

/* ──────────────────────────────────────────
   Scroll-animated mockup for each feature
   ────────────────────────────────────────── */
function FeatureMockup({ id, scrollProgress }: { id: string; scrollProgress: import("framer-motion").MotionValue<number> }) {
  const shared = "w-full h-full rounded-xl p-5 text-left select-none overflow-hidden";

  // Derive inner-element animation values from parent scroll
  const itemOpacity1 = useTransform(scrollProgress, [0.15, 0.35], [0, 1]);
  const itemOpacity2 = useTransform(scrollProgress, [0.25, 0.45], [0, 1]);
  const itemOpacity3 = useTransform(scrollProgress, [0.35, 0.55], [0, 1]);
  const itemY1 = useTransform(scrollProgress, [0.15, 0.35], [30, 0]);
  const itemY2 = useTransform(scrollProgress, [0.25, 0.45], [30, 0]);
  const itemY3 = useTransform(scrollProgress, [0.35, 0.55], [30, 0]);

  switch (id) {
    case "dashboards":
      return (
        <div className={shared}>
          <motion.div style={{ opacity: itemOpacity1, y: itemY1 }} className="flex gap-3 mb-4">
            {["Admin", "Client", "Editor"].map((r, i) => (
              <div key={r} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                i === 0 ? "bg-primary/20 text-primary border border-primary/30" : "bg-muted/30 text-muted-foreground border border-white/[0.06]"
              }`}>{r}</div>
            ))}
          </motion.div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: "Revenue", v: "$47.2K", c: "text-success", op: itemOpacity1, y: itemY1 },
              { l: "Clients", v: "18", c: "text-primary", op: itemOpacity2, y: itemY2 },
              { l: "Projects", v: "24", c: "text-warning", op: itemOpacity3, y: itemY3 },
            ].map((s) => (
              <motion.div key={s.l} style={{ opacity: s.op, y: s.y }} className="rounded-xl bg-surface-glass/40 border border-white/[0.06] p-3">
                <p className="text-[10px] text-muted-foreground">{s.l}</p>
                <p className={`text-lg font-bold ${s.c}`}>{s.v}</p>
              </motion.div>
            ))}
          </div>
          <div className="space-y-2 mt-4">
            <AnimatedBar scrollProgress={scrollProgress} range={[0.2, 0.6]} target={85} />
            <AnimatedBar scrollProgress={scrollProgress} range={[0.3, 0.65]} target={60} />
            <AnimatedBar scrollProgress={scrollProgress} range={[0.35, 0.7]} target={40} />
          </div>
        </div>
      );

    case "approval": {
      const playheadWidth = useTransform(scrollProgress, [0.15, 0.7], ["0%", "100%"]);
      return (
        <div className={shared}>
          <motion.div style={{ opacity: itemOpacity1, y: itemY1 }} className="rounded-xl bg-muted/10 border border-white/[0.06] aspect-video flex items-center justify-center mb-3 relative overflow-hidden">
            <div className="w-0 h-0 border-l-[18px] border-l-primary border-y-[12px] border-y-transparent ml-1" />
            <div className="absolute bottom-2 left-2 right-2 h-1 rounded-full bg-muted/30">
              <motion.div className="h-full rounded-full bg-primary/80" style={{ width: playheadWidth }} />
            </div>
          </motion.div>
          {[
            { time: "0:14", text: "Color feels too warm here", op: itemOpacity2, y: itemY2 },
            { time: "0:32", text: "Love this transition!", op: itemOpacity3, y: itemY3 },
          ].map((c) => (
            <motion.div key={c.time} style={{ opacity: c.op, y: c.y }} className="flex gap-2 items-start mb-2">
              <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">{c.time}</span>
              <span className="text-xs text-muted-foreground">{c.text}</span>
            </motion.div>
          ))}
        </div>
      );
    }

    case "invoicing": {
      const totalScale = useTransform(scrollProgress, [0.5, 0.7], [0.8, 1]);
      const totalOpacity = useTransform(scrollProgress, [0.5, 0.7], [0, 1]);
      return (
        <div className={shared}>
          <motion.div style={{ opacity: itemOpacity1, y: itemY1 }} className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-foreground">Invoice #VD-0042</span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-warning/10 text-warning border border-warning/20">Pending</span>
          </motion.div>
          <div className="space-y-2">
            {[
              { item: "Brand Video Edit", amount: "$1,200", op: itemOpacity1, y: itemY1 },
              { item: "Social Cuts (x5)", amount: "$750", op: itemOpacity2, y: itemY2 },
              { item: "Color Grading", amount: "$350", op: itemOpacity3, y: itemY3 },
            ].map((r) => (
              <motion.div key={r.item} style={{ opacity: r.op, y: r.y }} className="flex justify-between text-xs py-2 border-b border-white/[0.04]">
                <span className="text-muted-foreground">{r.item}</span>
                <span className="text-foreground font-medium">{r.amount}</span>
              </motion.div>
            ))}
          </div>
          <motion.div style={{ opacity: totalOpacity, scale: totalScale }} className="flex justify-between mt-3 pt-2 border-t border-white/[0.08]">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="text-sm font-bold text-primary">$2,300</span>
          </motion.div>
        </div>
      );
    }

    case "projects":
      return (
        <div className={shared}>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Backlog", color: "bg-muted-foreground", count: 3, op: itemOpacity1, y: itemY1 },
              { label: "Active", color: "bg-primary", count: 4, op: itemOpacity1, y: itemY1 },
              { label: "Review", color: "bg-warning", count: 2, op: itemOpacity2, y: itemY2 },
              { label: "Done", color: "bg-success", count: 7, op: itemOpacity3, y: itemY3 },
            ].map((col) => (
              <motion.div key={col.label} style={{ opacity: col.op, y: col.y }} className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${col.color}`} />
                  <span className="text-[10px] font-medium text-foreground">{col.label}</span>
                  <span className="text-[9px] text-muted-foreground ml-auto">{col.count}</span>
                </div>
                {[...Array(Math.min(col.count, 2))].map((_, j) => (
                  <div key={j} className="p-2 rounded-lg bg-surface-glass/30 border border-white/[0.05]">
                    <div className="h-1.5 w-3/4 bg-muted/30 rounded mb-1" />
                    <div className="h-1.5 w-1/2 bg-muted/15 rounded" />
                  </div>
                ))}
              </motion.div>
            ))}
          </div>
        </div>
      );

    case "messaging":
      return (
        <div className={shared}>
          <div className="space-y-3">
            {[
              { name: "Sarah", msg: "Uploaded the final cut! 🎬", time: "2m", self: false, op: itemOpacity1, y: itemY1 },
              { name: "You", msg: "Looks great, sending to client", time: "1m", self: true, op: itemOpacity2, y: itemY2 },
              { name: "Client", msg: "Approved! ✅", time: "now", self: false, op: itemOpacity3, y: itemY3 },
            ].map((m, i) => (
              <motion.div key={i} style={{ opacity: m.op, y: m.y }} className={`flex ${m.self ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-xl text-xs ${
                  m.self ? "bg-primary/20 text-primary-foreground border border-primary/30" : "bg-surface-glass/40 text-foreground border border-white/[0.06]"
                }`}>
                  {!m.self && <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">{m.name}</p>}
                  <p>{m.msg}</p>
                  <p className="text-[9px] text-muted-foreground mt-1 text-right">{m.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      );

    case "editors":
      return (
        <div className={shared}>
          <div className="space-y-2">
            {[
              { name: "Alex R.", tasks: 12, rating: "98%", status: "Online", op: itemOpacity1, y: itemY1 },
              { name: "Priya K.", tasks: 9, rating: "95%", status: "Editing", op: itemOpacity2, y: itemY2 },
              { name: "Marcus J.", tasks: 7, rating: "92%", status: "Idle", op: itemOpacity3, y: itemY3 },
            ].map((e) => (
              <motion.div key={e.name} style={{ opacity: e.op, y: e.y }} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-glass/30 border border-white/[0.06]">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                  {e.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{e.name}</p>
                  <p className="text-[10px] text-muted-foreground">{e.tasks} tasks · {e.rating}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                  e.status === "Online" ? "bg-success/10 text-success" :
                  e.status === "Editing" ? "bg-primary/10 text-primary" :
                  "bg-muted/20 text-muted-foreground"
                }`}>{e.status}</span>
              </motion.div>
            ))}
          </div>
        </div>
      );

    case "hr":
      return (
        <div className={shared}>
          <motion.div style={{ opacity: itemOpacity1, y: itemY1 }} className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-foreground">Today's Attendance</span>
            <span className="text-[10px] text-success">6/7 checked in</span>
          </motion.div>
          <motion.div style={{ opacity: itemOpacity2, y: itemY2 }} className="grid grid-cols-7 gap-1 mb-3">
            {[1,1,1,1,1,1,0].map((v, i) => (
              <div key={i} className={`h-6 rounded ${v ? "bg-success/30 border border-success/20" : "bg-destructive/20 border border-destructive/20"}`} />
            ))}
          </motion.div>
          <div className="space-y-2">
            {[
              { name: "Leave Request", desc: "Priya K. · Dec 24-26", status: "Pending", op: itemOpacity2, y: itemY2 },
              { name: "Check-in", desc: "Alex R. · 9:02 AM", status: "On Time", op: itemOpacity3, y: itemY3 },
            ].map((item) => (
              <motion.div key={item.name} style={{ opacity: item.op, y: item.y }} className="flex justify-between items-center p-2 rounded-lg bg-surface-glass/30 border border-white/[0.06]">
                <div>
                  <p className="text-[11px] font-medium text-foreground">{item.name}</p>
                  <p className="text-[9px] text-muted-foreground">{item.desc}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                  item.status === "Pending" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                }`}>{item.status}</span>
              </motion.div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}

/* ──────────────────────────────────────────
   Blur-to-focus text reveal
   ────────────────────────────────────────── */
function BlurReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, filter: "blur(12px)", y: 20 }}
      animate={isInView ? { opacity: 1, filter: "blur(0px)", y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{ willChange: "transform, opacity, filter" }}
    >
      {children}
    </motion.div>
  );
}

/* ──────────────────────────────────────────
   Staggered text mask reveal
   ────────────────────────────────────────── */
function MaskReveal({ children, className = "" }: { children: string; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const words = children.split(" ");

  return (
    <span ref={ref} className={`inline ${className}`}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-[0.25em] pb-[0.15em]">
          <motion.span
            className="inline-block"
            initial={{ y: "120%", opacity: 0, filter: "blur(4px)" }}
            animate={isInView ? { y: 0, opacity: 1, filter: "blur(0px)" } : {}}
            transition={{
              duration: 0.6,
              delay: i * 0.04,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{ willChange: "transform, opacity, filter" }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/* ──────────────────────────────────────────
   Single Feature Card (3D emerge)
   ────────────────────────────────────────── */
function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[0];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });

  // 3D spatial emergence
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [12, 3, 0]);
  const translateZ = useTransform(scrollYProgress, [0, 0.5, 1], [-120, -30, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.25, 0.6], [0, 0.4, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.88, 0.96, 1]);
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [80, 20, 0]);

  const springRotateX = useSpring(rotateX, { stiffness: 80, damping: 25 });
  const springZ = useSpring(translateZ, { stiffness: 80, damping: 25 });
  const springScale = useSpring(scale, { stiffness: 80, damping: 25 });
  const springY = useSpring(y, { stiffness: 80, damping: 25 });

  // Parallax for mockup (slightly slower)
  const mockupY = useTransform(scrollYProgress, [0, 1], [40, -20]);
  const springMockupY = useSpring(mockupY, { stiffness: 60, damping: 30 });

  const isEven = index % 2 === 0;
  const Icon = feature.icon;

  return (
    <div ref={ref} className="py-12 md:py-20">
      <motion.div
        style={{
          rotateX: springRotateX,
          translateZ: springZ,
          scale: springScale,
          y: springY,
          opacity,
          willChange: "transform, opacity",
        }}
        className="relative"
      >
        {/* Ambient glow behind card */}
        <div className="absolute -inset-8 rounded-3xl opacity-0 transition-opacity duration-700 group-hover:opacity-100"
          style={{
            background: `radial-gradient(600px circle at 50% 50%, hsl(var(--primary) / 0.08), transparent 70%)`,
          }}
        />

        <div className={`flex flex-col ${isEven ? "lg:flex-row" : "lg:flex-row-reverse"} items-center gap-10 lg:gap-16`}>
          {/* Text Side */}
          <div className="w-full lg:w-[45%] space-y-6">
            <BlurReveal delay={0.05}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15">
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold tracking-widest uppercase text-primary">
                  {feature.tag}
                </span>
              </div>
            </BlurReveal>

            <h3 className="text-3xl md:text-4xl lg:text-[2.6rem] font-bold tracking-tight leading-[1.1] text-foreground">
              <MaskReveal>{feature.title}</MaskReveal>
            </h3>

            <BlurReveal delay={0.15}>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg">
                {feature.description}
              </p>
            </BlurReveal>

            <div className="space-y-3 pt-2">
              {feature.bullets.map((b, i) => (
                <BlurReveal key={b} delay={0.2 + i * 0.08}>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <ChevronRight className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-sm text-foreground/80">{b}</span>
                  </div>
                </BlurReveal>
              ))}
            </div>
          </div>

          {/* Mockup Side with parallax */}
          <motion.div
            className="w-full lg:w-[55%]"
            style={{ y: springMockupY }}
          >
            <div className="relative group">
              {/* Dynamic border glow */}
              <div
                className="absolute -inset-px rounded-2xl opacity-50 blur-sm transition-opacity duration-500 group-hover:opacity-80"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary) / 0.4) 0%, transparent 40%, transparent 60%, hsl(var(--primary) / 0.3) 100%)",
                }}
              />
              {/* Outer glow */}
              <div className="absolute -inset-6 rounded-3xl bg-primary/5 blur-2xl opacity-40" />

              <div className="relative glass-card-premium rounded-2xl overflow-hidden border border-white/[0.08]">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-surface-dark/60">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-destructive/60" />
                    <div className="w-2 h-2 rounded-full bg-warning/60" />
                    <div className="w-2 h-2 rounded-full bg-success/60" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-3 py-1 rounded-md bg-muted/20 text-[10px] text-muted-foreground font-mono">
                      app.veylodesk.com
                    </div>
                  </div>
                </div>

                <div className="min-h-[280px] bg-gradient-cinematic">
                  <FeatureMockup id={feature.mockup} scrollProgress={scrollYProgress} />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

/* ──────────────────────────────────────────
   Ambient animated lighting
   ────────────────────────────────────────── */
function AmbientLighting() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const orbX = useTransform(scrollYProgress, [0, 0.5, 1], ["20%", "60%", "35%"]);
  const orbY = useTransform(scrollYProgress, [0, 0.5, 1], ["10%", "50%", "85%"]);
  const orbOpacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.15, 0.3, 0.25, 0.1]);

  const orb2X = useTransform(scrollYProgress, [0, 0.5, 1], ["70%", "30%", "55%"]);
  const orb2Y = useTransform(scrollYProgress, [0, 0.5, 1], ["20%", "60%", "90%"]);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full"
        style={{
          left: orbX,
          top: orbY,
          opacity: orbOpacity,
          background:
            "radial-gradient(circle, hsl(240 76% 59% / 0.15) 0%, hsl(260 70% 55% / 0.05) 40%, transparent 70%)",
          filter: "blur(100px)",
          willChange: "transform, opacity",
        }}
      />
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          left: orb2X,
          top: orb2Y,
          opacity: orbOpacity,
          background:
            "radial-gradient(circle, hsl(260 70% 60% / 0.12) 0%, transparent 60%)",
          filter: "blur(120px)",
          willChange: "transform, opacity",
        }}
      />
    </div>
  );
}

/* ──────────────────────────────────────────
   Main Section
   ────────────────────────────────────────── */
const FeaturesSection = () => {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section
      ref={sectionRef}
      id="features-deep"
      className="relative overflow-hidden"
      style={{ perspective: "1200px" }}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-cinematic" />
      <AmbientLighting />

      {/* Divider line */}
      <div className="absolute top-0 left-0 right-0 overflow-hidden">
        <motion.div
          className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <div className="container relative z-10 mx-auto px-6">
        {/* Section Header */}
        <div className="max-w-4xl mx-auto text-center pt-28 pb-12">
          <BlurReveal>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/8 border border-primary/15 mb-8">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-semibold tracking-widest uppercase text-primary">
                Platform Features
              </span>
            </div>
          </BlurReveal>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-foreground">
            <MaskReveal>Everything Your Agency</MaskReveal>
            <br />
            <span className="inline-block text-gradient">
              <MaskReveal>Needs to Scale</MaskReveal>
            </span>
          </h2>

          <BlurReveal delay={0.2}>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Seven powerful modules. One seamless platform. Built from the ground up for video production agencies.
            </p>
          </BlurReveal>
        </div>

        {/* Feature Cards */}
        <div className="max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <FeatureCard key={feature.id} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
