import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Command } from "lucide-react";
import { motion, AnimatePresence, useMotionValueEvent, useScroll } from "framer-motion";

const spring = { type: "spring", stiffness: 260, damping: 28, mass: 0.8 };

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 50);
  });

  return (
    <>
      {/* Fixed anchor — full width, centered */}
      <motion.header
        className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
        style={{ display: "flex", justifyContent: "center" }}
      >
        <motion.div
          className="pointer-events-auto relative"
          layout
          style={{
            width: isScrolled ? "min(720px, calc(100% - 32px))" : "100%",
            marginTop: isScrolled ? 12 : 0,
            borderRadius: isScrolled ? 50 : 0,
          }}
          transition={spring}
        >
          {/* Glass background layer */}
          <motion.div
            className="absolute inset-0"
            style={{ borderRadius: "inherit" }}
            animate={{
              backgroundColor: isScrolled
                ? "rgba(12, 12, 18, 0.72)"
                : "rgba(0, 0, 0, 0)",
              backdropFilter: isScrolled ? "blur(20px) saturate(1.6)" : "blur(0px) saturate(1)",
              boxShadow: isScrolled
                ? "0 8px 32px -8px rgba(0,0,0,0.6), inset 0 0.5px 0 0 rgba(255,255,255,0.06)"
                : "0 0 0 0 rgba(0,0,0,0)",
              borderWidth: 1,
              borderStyle: "solid" as any,
              borderColor: isScrolled
                ? "rgba(255,255,255,0.08)"
                : "rgba(255,255,255,0)",
            }}
            transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          />

          {/* Content */}
          <div className="relative z-10 px-5 md:px-6">
            <div className="flex items-center justify-between h-14 md:h-16">
              {/* Logo */}
              <Link to="/" className="flex items-center gap-2 group shrink-0">
                <motion.div
                  className="rounded-lg bg-gradient-primary flex items-center justify-center"
                  animate={{
                    width: isScrolled ? 28 : 36,
                    height: isScrolled ? 28 : 36,
                    boxShadow: isScrolled
                      ? "0 0 20px hsl(240 76% 59% / 0.3)"
                      : "0 0 30px hsl(240 76% 59% / 0.25)",
                  }}
                  transition={spring}
                >
                  <Command
                    className="text-primary-foreground"
                    style={{ width: isScrolled ? 14 : 18, height: isScrolled ? 14 : 18 }}
                  />
                </motion.div>
                <motion.span
                  className="font-bold text-foreground whitespace-nowrap"
                  animate={{ fontSize: isScrolled ? "0.95rem" : "1.25rem" }}
                  transition={spring}
                >
                  Veylo<span className="text-gradient">desk</span>
                </motion.span>
              </Link>

              {/* Desktop Navigation — centered */}
              <nav className="hidden md:flex items-center gap-5 mx-auto">
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
              <div className="hidden md:flex items-center gap-2 shrink-0">
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
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.header>

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
