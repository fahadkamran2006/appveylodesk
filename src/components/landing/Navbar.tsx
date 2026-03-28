import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Command } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [introPhase, setIntroPhase] = useState<"logo" | "shrink" | "done">("logo");

  // Debounced scroll handler to avoid rapid re-renders at the threshold
  const handleScroll = useCallback(() => {
    const y = window.scrollY;
    setIsScrolled(y > 60);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    // Phase 1: Centered logo with glow pulse for 1.6s
    const t1 = setTimeout(() => setIntroPhase("shrink"), 1600);
    // Phase 2: After shrink+fly completes, reveal full nav
    const t2 = setTimeout(() => setIntroPhase("done"), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const showNav = introPhase === "done";

  return (
    <>
      {/* ── Intro overlay: cinematic centered logo ── */}
      <AnimatePresence>
        {introPhase === "logo" && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{
                opacity: 1,
                scale: [0.6, 1.08, 1],
              }}
              transition={{
                duration: 1.2,
                ease: [0.16, 1, 0.3, 1],
                times: [0, 0.6, 1],
              }}
            >
              {/* Glow ring behind the logo */}
              <div className="relative">
                <motion.div
                  className="absolute inset-0 rounded-xl bg-primary/30"
                  initial={{ scale: 1, opacity: 0 }}
                  animate={{
                    scale: [1, 1.8, 2.2],
                    opacity: [0, 0.4, 0],
                  }}
                  transition={{
                    duration: 1.4,
                    delay: 0.3,
                    ease: "easeOut",
                  }}
                  style={{ filter: "blur(16px)" }}
                />
                <motion.div
                  className="w-14 h-14 rounded-xl bg-gradient-primary flex items-center justify-center relative z-10"
                  animate={{
                    boxShadow: [
                      "0 0 20px hsl(240 76% 59% / 0.2)",
                      "0 0 60px hsl(240 76% 59% / 0.5)",
                      "0 0 30px hsl(240 76% 59% / 0.3)",
                    ],
                  }}
                  transition={{ duration: 1.4, delay: 0.2, ease: "easeInOut" }}
                >
                  <Command className="w-7 h-7 text-primary-foreground" />
                </motion.div>
              </div>
              <span className="text-3xl font-bold text-foreground">
                Veylo<span className="text-gradient">desk</span>
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Shrink-and-fly phase: logo moves to header position ── */}
      <AnimatePresence>
        {introPhase === "shrink" && (
          <motion.div
            className="fixed inset-0 z-[100] pointer-events-none"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="flex items-center gap-2 absolute"
              initial={{
                top: "50%",
                left: "50%",
                x: "-50%",
                y: "-50%",
                scale: 1,
              }}
              animate={{
                top: "0px",
                left: "20px",
                x: "0%",
                y: "12px",
                scale: 0.7,
              }}
              transition={{
                duration: 0.9,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Command className="w-7 h-7 text-primary-foreground" />
              </div>
              <span className="text-3xl font-bold text-foreground whitespace-nowrap">
                Veylo<span className="text-gradient">desk</span>
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{
          opacity: introPhase === "logo" ? 0 : 1,
          transition: `opacity 0.5s ${EASE}`,
        }}
      >
        {/* Morphing container — pure CSS transitions for 60fps */}
        <div
          className="pointer-events-auto relative will-change-[width,margin-top,border-radius]"
          style={{
            width: isScrolled ? "min(720px, calc(100% - 32px))" : "100%",
            marginTop: isScrolled ? 12 : 0,
            borderRadius: isScrolled ? 50 : 0,
            transition: `
              width 0.8s ${EASE},
              margin-top 0.8s ${EASE},
              border-radius 0.8s ${EASE}
            `,
          }}
        >
          {/* Glass background */}
          <div
            className="absolute inset-0 will-change-[background-color,backdrop-filter,box-shadow,border-color]"
            style={{
              borderRadius: "inherit",
              backgroundColor: isScrolled ? "rgba(12, 12, 18, 0.72)" : "rgba(0, 0, 0, 0)",
              backdropFilter: isScrolled ? "blur(20px) saturate(1.6)" : "blur(0px) saturate(1)",
              WebkitBackdropFilter: isScrolled ? "blur(20px) saturate(1.6)" : "blur(0px) saturate(1)",
              boxShadow: isScrolled
                ? "0 8px 32px -8px rgba(0,0,0,0.6), inset 0 0.5px 0 0 rgba(255,255,255,0.06)"
                : "0 0 0 0 rgba(0,0,0,0)",
              border: isScrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
              transition: `
                background-color 0.8s ${EASE},
                backdrop-filter 0.8s ${EASE},
                -webkit-backdrop-filter 0.8s ${EASE},
                box-shadow 0.8s ${EASE},
                border-color 0.8s ${EASE}
              `,
            }}
          />

          {/* Content */}
          <div className="relative z-10 px-5 md:px-6">
            <div className="flex items-center justify-between h-14 md:h-16">
              {/* Logo */}
              <Link to="/" className="flex items-center gap-2 group shrink-0">
                <div
                  className="rounded-lg bg-gradient-primary flex items-center justify-center will-change-[width,height]"
                  style={{
                    width: isScrolled ? 28 : 36,
                    height: isScrolled ? 28 : 36,
                    boxShadow: isScrolled
                      ? "0 0 20px hsl(240 76% 59% / 0.3)"
                      : "0 0 30px hsl(240 76% 59% / 0.25)",
                    transition: `all 0.8s ${EASE}`,
                  }}
                >
                  <Command
                    className="text-primary-foreground"
                    style={{
                      width: isScrolled ? 14 : 18,
                      height: isScrolled ? 14 : 18,
                      transition: `all 0.8s ${EASE}`,
                    }}
                  />
                </div>
                <span
                  className="font-bold text-foreground whitespace-nowrap"
                  style={{
                    fontSize: isScrolled ? "0.95rem" : "1.25rem",
                    transition: `font-size 0.8s ${EASE}`,
                  }}
                >
                  Veylo<span className="text-gradient">desk</span>
                </span>
              </Link>

              {/* Desktop Navigation */}
              <nav
                className="hidden md:flex items-center gap-5 mx-auto"
                style={{
                  opacity: showNav ? 1 : 0,
                  transition: `opacity 0.5s ${EASE}`,
                }}
              >
                {[
                  { label: "Features", href: "#features", isAnchor: true },
                  { label: "Pricing", href: "/pricing" },
                  { label: "Testimonials", href: "#testimonials", isAnchor: true },
                  { label: "About", href: "/about" },
                ].map((item) =>
                  item.isAnchor ? (
                    <a
                      key={item.label}
                      href={item.href}
                      className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      key={item.label}
                      to={item.href}
                      className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
                    >
                      {item.label}
                    </Link>
                  )
                )}
              </nav>

              {/* CTA Buttons */}
              <div
                className="hidden md:flex items-center gap-2 shrink-0"
                style={{
                  opacity: showNav ? 1 : 0,
                  transition: `opacity 0.5s ${EASE}`,
                }}
              >
                <Button variant="ghost" size="sm" className="text-[13px] h-8" asChild>
                  <Link to="/auth/login">Login</Link>
                </Button>
                <Button variant="hero" size="sm" className="text-[13px] h-8 px-4" asChild>
                  <Link to="/pricing">Get Started</Link>
                </Button>
              </div>

              {/* Mobile Menu Toggle */}
              <button
                className="md:hidden p-2 text-foreground"
                style={{
                  opacity: showNav ? 1 : 0,
                  pointerEvents: showNav ? "auto" : "none",
                  transition: `opacity 0.5s ${EASE}`,
                }}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Height spacer */}
      <div className="h-14 md:h-16" />

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="md:hidden fixed inset-0 z-[60] bg-background/95 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex flex-col h-full px-6 py-5">
              <div className="flex items-center justify-between mb-10">
                <Link to="/" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
                  <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow-sm">
                    <Command className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="text-xl font-bold text-foreground">
                    Veylo<span className="text-gradient">desk</span>
                  </span>
                </Link>
                <button
                  className="p-2 rounded-lg bg-muted/50 text-foreground"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="flex flex-col gap-1">
                {[
                  { label: "Features", href: "#features", isAnchor: true },
                  { label: "Pricing", href: "/pricing" },
                  { label: "Testimonials", href: "#testimonials", isAnchor: true },
                  { label: "About", href: "/about" },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                  >
                    {item.isAnchor ? (
                      <a
                        href={item.href}
                        className="text-lg font-medium text-muted-foreground hover:text-foreground transition-colors py-3 px-3 rounded-lg hover:bg-muted/40"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        to={item.href}
                        className="text-lg font-medium text-muted-foreground hover:text-foreground transition-colors py-3 px-3 rounded-lg hover:bg-muted/40 block"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    )}
                  </motion.div>
                ))}
              </nav>

              <div className="flex-1" />

              <motion.div
                className="flex flex-col gap-3 pb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Button variant="outline" size="lg" className="w-full text-base" asChild>
                  <Link to="/auth/login" onClick={() => setIsMobileMenuOpen(false)}>Login</Link>
                </Button>
                <Button variant="hero" size="lg" className="w-full text-base" asChild>
                  <Link to="/pricing" onClick={() => setIsMobileMenuOpen(false)}>Get Started</Link>
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
