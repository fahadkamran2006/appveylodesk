import { motion, useTransform, MotionValue } from "framer-motion";
import { TiltCard } from "./ScrollAnimations";
import dashboardPreview from "@/assets/dashboard-preview.png";

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
        className="relative glass-card-premium rounded-2xl md:rounded-3xl p-1.5 md:p-2 overflow-hidden"
        style={{ perspective: "1200px", scale, y }}
      >
        <motion.div className="rounded-xl md:rounded-2xl overflow-hidden" style={{ rotateX }}>
          <img
            src={dashboardPreview}
            alt="Veylodesk Command Center Dashboard"
            className="w-full h-auto block"
            loading="eager"
          />
        </motion.div>
      </motion.div>
    </TiltCard>
  );
};

export default HeroDashboardPreview;
