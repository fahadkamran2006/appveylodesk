import { motion, useTransform, MotionValue } from "framer-motion";
import { TiltCard } from "./ScrollAnimations";
import { AnimatedCounter } from "./ScrollAnimations";

interface Props {
  scrollYProgress: MotionValue<number>;
}

const HeroDashboardPreview = ({ scrollYProgress }: Props) => {
  const scale = useTransform(scrollYProgress, [0, 0.3], [1, 0.96]);
  const rotateX = useTransform(scrollYProgress, [0, 0.3], [0, 4]);
  const y = useTransform(scrollYProgress, [0, 0.4], [0, -20]);

  return (
    <TiltCard intensity={5} className="relative">
      <div className="absolute -inset-8 bg-gradient-to-r from-primary/20 via-indigo-soft/15 to-primary/20 rounded-3xl blur-3xl opacity-40" />
      
      <motion.div
        className="relative glass-card-premium rounded-2xl md:rounded-3xl p-2 md:p-3 overflow-hidden"
        style={{ perspective: "1200px", scale, y }}
      >
        <motion.div className="rounded-xl md:rounded-2xl overflow-hidden bg-midnight-deep" style={{ rotateX }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-destructive/60" />
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-warning/60" />
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-success/60" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-4 py-1 rounded-lg bg-muted/30 text-[10px] md:text-xs text-muted-foreground border border-white/[0.04]">
                app.veylodesk.com
              </div>
            </div>
          </div>
          
          <div className="p-4 md:p-8 min-h-[280px] md:min-h-[420px] bg-gradient-cinematic">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <div>
                <h3 className="text-sm md:text-xl font-semibold text-foreground">Command Center</h3>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Welcome back</p>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-success/10 border border-success/20 text-success text-xs font-medium hidden sm:block">
                <AnimatedCounter target={5} /> Active
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 md:gap-5 mb-6 md:mb-8">
              {[
                { label: "Revenue", value: 47280, prefix: "$", change: "+12%" },
                { label: "Clients", value: 18, prefix: "", change: "3 pending" },
                { label: "Invoices", value: 8450, prefix: "$", change: "4 unpaid" },
              ].map((card) => (
                <div key={card.label} className="glass-card-premium rounded-xl md:rounded-2xl p-3 md:p-5">
                  <p className="text-[10px] md:text-sm text-muted-foreground mb-1">{card.label}</p>
                  <p className="text-lg md:text-3xl font-bold text-foreground">
                    <AnimatedCounter target={card.value} prefix={card.prefix} duration={2} />
                  </p>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 hidden sm:block">{card.change}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2 md:gap-4 hidden sm:grid">
              {["Backlog", "In Progress", "Review", "Done"].map((status, i) => (
                <div key={status} className="glass rounded-lg md:rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      i === 0 ? "bg-muted-foreground" :
                      i === 1 ? "bg-primary" :
                      i === 2 ? "bg-warning" : "bg-success"
                    }`} />
                    <span className="text-xs font-medium text-foreground">{status}</span>
                  </div>
                  <div className="space-y-2">
                    {[...Array(i === 1 ? 2 : 1)].map((_, j) => (
                      <div key={j} className="p-2 rounded-md bg-midnight-deep/60 border border-white/[0.04]">
                        <div className="h-1.5 w-3/4 bg-muted/40 rounded mb-1.5" />
                        <div className="h-1.5 w-1/2 bg-muted/20 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </TiltCard>
  );
};

export default HeroDashboardPreview;
