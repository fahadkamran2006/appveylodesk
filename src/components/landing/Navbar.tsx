import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Command } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Spacer so content doesn't jump */}
      <div className="h-16 md:h-20" />

      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 flex justify-center"
        initial={false}
        animate={isScrolled ? "scrolled" : "top"}
      >
        <motion.div
          className="w-full"
          variants={{
            top: {
              maxWidth: "100%",
              marginTop: 0,
              borderRadius: 0,
              paddingLeft: 0,
              paddingRight: 0,
            },
            scrolled: {
              maxWidth: 720,
              marginTop: 12,
              borderRadius: 22,
              paddingLeft: 4,
              paddingRight: 4,
            },
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ overflow: "hidden" }}
        >
          <motion.div
            className="border border-transparent"
            variants={{
              top: {
                backgroundColor: "rgba(0,0,0,0)",
                backdropFilter: "blur(0px)",
                borderColor: "rgba(255,255,255,0)",
                boxShadow: "0 0 0 0 rgba(0,0,0,0)",
              },
              scrolled: {
                backgroundColor: "rgba(15,15,20,0.65)",
                backdropFilter: "blur(24px)",
                borderColor: "rgba(255,255,255,0.08)",
                boxShadow: "0 8px 32px -8px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.06) inset",
              },
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ borderRadius: "inherit" }}
          >
            <div className="px-4 md:px-6">
              <div className="flex items-center justify-between h-14 md:h-16">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-2 group">
                  <motion.div
                    className="rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow duration-300"
                    variants={{
                      top: { width: 36, height: 36 },
                      scrolled: { width: 30, height: 30 },
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <Command className="w-4 h-4 text-primary-foreground" />
                  </motion.div>
                  <motion.span
                    className="font-bold text-foreground"
                    variants={{
                      top: { fontSize: "1.25rem" },
                      scrolled: { fontSize: "1rem" },
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    Veylo<span className="text-gradient">desk</span>
                  </motion.span>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-6">
                  <a
                    href="#features"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Features
                  </a>
                  <Link
                    to="/pricing"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Pricing
                  </Link>
                  <a
                    href="#testimonials"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Testimonials
                  </a>
                  <Link
                    to="/about"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    About
                  </Link>
                </div>

                {/* CTA Buttons */}
                <div className="hidden md:flex items-center gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/auth/login">Login</Link>
                  </Button>
                  <Button variant="hero" size="sm" asChild>
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
        </motion.div>
      </motion.nav>

      {/* Mobile Menu — Full-screen overlay */}
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
              {/* Header with logo & close */}
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

              {/* Nav links */}
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

              {/* CTA buttons pinned to bottom */}
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
