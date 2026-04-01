import { useRef, useEffect, useState, ReactNode } from "react";
import { motion, useScroll, useTransform, useSpring, useInView, MotionValue } from "framer-motion";

// ─── Animated Counter ───
export function AnimatedCounter({ 
  target, 
  prefix = "", 
  suffix = "", 
  duration = 2,
  className = "" 
}: { 
  target: number; 
  prefix?: string; 
  suffix?: string; 
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const end = target;
    const stepTime = (duration * 1000) / end;
    const timer = setInterval(() => {
      start += Math.ceil(end / 60);
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [isInView, target, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

// ─── Text Reveal (word by word — smooth fade) ───
export function TextReveal({ 
  children, 
  className = "",
  staggerDelay = 0.03,
  gradient = false,
}: { 
  children: string; 
  className?: string;
  staggerDelay?: number;
  gradient?: boolean;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });
  const words = children.split(" ");

  return (
    <span ref={ref} className={`inline leading-[1.15] ${className}`}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-visible mr-[0.25em] align-baseline">
          <motion.span
            className={`inline-block pb-[0.12em] ${gradient ? "text-gradient" : ""}`}
            initial={{ y: "100%", opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{
              duration: 0.7,
              delay: i * staggerDelay,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{ willChange: "transform, opacity" }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

// ─── Character Reveal (smooth blur) ───
export function CharReveal({ 
  children, 
  className = "",
  staggerDelay = 0.02,
}: { 
  children: string; 
  className?: string;
  staggerDelay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <span ref={ref} className={`inline-block pb-[0.1em] ${className}`}>
      {children.split("").map((char, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: 0.5,
            delay: i * staggerDelay,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{ willChange: "transform, opacity" }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </span>
  );
}

// ─── Scroll Fade Section (blur fade-in) ───
export function ScrollFade({ 
  children, 
  className = "",
  direction = "up",
  delay = 0,
}: { 
  children: ReactNode; 
  className?: string;
  direction?: "up" | "down" | "left" | "right";
  delay?: number;
}) {
  const directionMap = {
    up: { y: 30, x: 0 },
    down: { y: -30, x: 0 },
    left: { x: 40, y: 0 },
    right: { x: -40, y: 0 },
  };

  const offset = directionMap[direction];

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}

// ─── 3D Tilt Card ───
export function TiltCard({ 
  children, 
  className = "",
  intensity = 10,
}: { 
  children: ReactNode; 
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setRotateX(-y * intensity);
    setRotateY(x * intensity);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX, rotateY }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{ perspective: 1000, transformStyle: "preserve-3d" }}
    >
      {children}
    </motion.div>
  );
}

// ─── Parallax Layer ───
export function ParallaxSection({ 
  children, 
  className = "",
  speed = 0.5,
}: { 
  children: ReactNode; 
  className?: string;
  speed?: number;
}) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  
  const y = useTransform(scrollYProgress, [0, 1], [100 * speed, -100 * speed]);
  const springY = useSpring(y, { stiffness: 100, damping: 30 });

  return (
    <div ref={ref} className={`relative ${className}`}>
      <motion.div style={{ y: springY }}>
        {children}
      </motion.div>
    </div>
  );
}

// ─── Horizontal Line Reveal ───
export function LineReveal({ className = "" }: { className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  
  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div
        className="h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        initial={{ scaleX: 0 }}
        animate={isInView ? { scaleX: 1 } : {}}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

// ─── Floating 3D Element ───
export function Float3D({ 
  children, 
  className = "",
  amplitude = 20,
  duration = 6,
}: { 
  children: ReactNode; 
  className?: string;
  amplitude?: number;
  duration?: number;
}) {
  return (
    <motion.div
      className={className}
      animate={{
        y: [-amplitude, amplitude, -amplitude],
        rotateX: [-5, 5, -5],
        rotateY: [-5, 5, -5],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      style={{ perspective: 800 }}
    >
      {children}
    </motion.div>
  );
}
