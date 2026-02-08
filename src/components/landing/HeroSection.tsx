import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const HeroSection = () => {
  return (
    <section className="relative min-h-[110vh] flex items-center justify-center overflow-hidden pt-24">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      
      {/* Animated glow orbs */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-gradient-glow animate-pulse-glow" />
      <div className="absolute top-40 left-20 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] animate-float" />
      <div className="absolute bottom-40 right-20 w-[600px] h-[600px] bg-indigo-soft/5 rounded-full blur-[150px] animate-float" style={{ animationDelay: "2s" }} />
      <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] bg-gradient-glow-soft rounded-full blur-[80px]" />

      <div className="container relative z-10 mx-auto px-6 py-32">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20 mb-10"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium text-primary tracking-wide">
              Built for Video Agencies
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[0.95] tracking-tighter mb-8"
          >
            Run Your Agency From{" "}
            <span className="text-gradient">One Command Center</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-14 leading-relaxed"
          >
            Stop managing chaos. Start scaling. Manage{" "}
            <span className="text-foreground font-medium">Clients</span>,{" "}
            <span className="text-foreground font-medium">Editors</span>, and{" "}
            <span className="text-foreground font-medium">Projects</span> in one tab.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-16"
          >
            <Button variant="hero" size="xl" className="btn-glow" asChild>
              <Link to="/pricing">
                Start Scaling Today
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="hero-outline" size="xl" asChild>
              <Link to="/auth/login">
                <Play className="w-5 h-5" />
                Watch Demo
              </Link>
            </Button>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Unlimited team members</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>14-day money-back guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Cancel anytime</span>
            </div>
          </motion.div>
        </div>

        {/* Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
          className="mt-24 max-w-6xl mx-auto"
        >
          <div className="relative">
            {/* Massive Glow Effect */}
            <div className="absolute -inset-8 bg-gradient-to-r from-primary/30 via-indigo-soft/20 to-primary/30 rounded-3xl blur-3xl opacity-50" />
            <div className="absolute -inset-4 bg-gradient-glow rounded-3xl opacity-60" />
            
            {/* Dashboard Card */}
            <div className="relative glass-card-premium rounded-3xl p-3 overflow-hidden">
              <div className="rounded-2xl bg-midnight-deep overflow-hidden">
                {/* Browser Chrome */}
                <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive/60" />
                    <div className="w-3 h-3 rounded-full bg-warning/60" />
                    <div className="w-3 h-3 rounded-full bg-success/60" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-5 py-1.5 rounded-lg bg-muted/30 text-xs text-muted-foreground border border-white/[0.04]">
                      app.veylodesk.com/admin/dashboard
                    </div>
                  </div>
                </div>
                
                {/* Dashboard Content Preview */}
                <div className="p-8 min-h-[450px] bg-gradient-cinematic">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">Command Center</h3>
                      <p className="text-sm text-muted-foreground mt-1">Welcome back, Agency Owner</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="px-4 py-2 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium">
                        5 Active Projects
                      </div>
                    </div>
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-3 gap-5 mb-8">
                    <div className="glass-card-premium rounded-2xl p-5">
                      <p className="text-sm text-muted-foreground mb-2">Total Revenue</p>
                      <p className="text-3xl font-bold text-foreground">$47,280</p>
                      <p className="text-xs text-success mt-1">+12% this month</p>
                    </div>
                    <div className="glass-card-premium rounded-2xl p-5">
                      <p className="text-sm text-muted-foreground mb-2">Active Clients</p>
                      <p className="text-3xl font-bold text-foreground">18</p>
                      <p className="text-xs text-muted-foreground mt-1">3 pending invites</p>
                    </div>
                    <div className="glass-card-premium rounded-2xl p-5">
                      <p className="text-sm text-muted-foreground mb-2">Pending Invoices</p>
                      <p className="text-3xl font-bold text-foreground">$8,450</p>
                      <p className="text-xs text-warning mt-1">4 awaiting payment</p>
                    </div>
                  </div>

                  {/* Kanban Preview */}
                  <div className="grid grid-cols-4 gap-4">
                    {["Backlog", "In Progress", "Review", "Done"].map((status, i) => (
                      <div key={status} className="glass rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className={`w-2 h-2 rounded-full ${
                            i === 0 ? "bg-muted-foreground" :
                            i === 1 ? "bg-primary" :
                            i === 2 ? "bg-warning" : "bg-success"
                          }`} />
                          <span className="text-sm font-medium text-foreground">{status}</span>
                        </div>
                        <div className="space-y-3">
                          {[...Array(i === 1 ? 2 : 1)].map((_, j) => (
                            <div key={j} className="p-3 rounded-lg bg-midnight-deep/60 border border-white/[0.04]">
                              <div className="h-2 w-3/4 bg-muted/40 rounded mb-2" />
                              <div className="h-2 w-1/2 bg-muted/20 rounded" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;