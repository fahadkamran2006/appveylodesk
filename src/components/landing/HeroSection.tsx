import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, CheckCircle2 } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-glow animate-pulse-glow" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-soft/5 rounded-full blur-3xl" />

      <div className="container relative z-10 mx-auto px-6 py-20">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 animate-fade-up">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium text-primary">
              Built for Video Agencies
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            Run Your Agency From{" "}
            <span className="text-gradient">One Command Center</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            Stop managing chaos. Start scaling. The first OS built specifically for
            Video Agencies to manage{" "}
            <span className="text-foreground font-medium">Clients</span>,{" "}
            <span className="text-foreground font-medium">Editors</span>, and{" "}
            <span className="text-foreground font-medium">Projects</span> in one tab.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <Button variant="hero" size="xl" asChild>
              <Link to="/auth/signup">
                Start Your Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="hero-outline" size="xl" asChild>
              <Link to="/auth/login">
                <Play className="w-5 h-5" />
                Watch Demo
              </Link>
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground animate-fade-up" style={{ animationDelay: "0.4s" }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="mt-16 max-w-6xl mx-auto animate-fade-up" style={{ animationDelay: "0.5s" }}>
          <div className="relative">
            {/* Glow Effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-indigo-soft/20 to-primary/20 rounded-2xl blur-2xl opacity-60" />
            
            {/* Dashboard Card */}
            <div className="relative glass-card rounded-2xl p-2 overflow-hidden">
              <div className="rounded-xl bg-surface-dark overflow-hidden">
                {/* Browser Chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-destructive/60" />
                    <div className="w-3 h-3 rounded-full bg-warning/60" />
                    <div className="w-3 h-3 rounded-full bg-success/60" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">
                      app.veylodesk.com/admin/dashboard
                    </div>
                  </div>
                </div>
                
                {/* Dashboard Content Preview */}
                <div className="p-6 min-h-[400px] bg-gradient-to-b from-surface-elevated to-surface-dark">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Command Center</h3>
                      <p className="text-sm text-muted-foreground">Welcome back, Agency Owner</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="px-3 py-1.5 rounded-lg bg-success/10 border border-success/20 text-success text-sm font-medium">
                        5 Active Projects
                      </div>
                    </div>
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="glass-card rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
                      <p className="text-2xl font-bold text-foreground">$47,280</p>
                      <p className="text-xs text-success">+12% this month</p>
                    </div>
                    <div className="glass-card rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">Active Clients</p>
                      <p className="text-2xl font-bold text-foreground">18</p>
                      <p className="text-xs text-muted-foreground">3 pending invites</p>
                    </div>
                    <div className="glass-card rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">Pending Invoices</p>
                      <p className="text-2xl font-bold text-foreground">$8,450</p>
                      <p className="text-xs text-warning">4 awaiting payment</p>
                    </div>
                  </div>

                  {/* Kanban Preview */}
                  <div className="grid grid-cols-4 gap-4">
                    {["Backlog", "In Progress", "Review", "Done"].map((status, i) => (
                      <div key={status} className="glass rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-2 h-2 rounded-full ${
                            i === 0 ? "bg-muted-foreground" :
                            i === 1 ? "bg-primary" :
                            i === 2 ? "bg-warning" : "bg-success"
                          }`} />
                          <span className="text-sm font-medium text-foreground">{status}</span>
                        </div>
                        <div className="space-y-2">
                          {[...Array(i === 1 ? 2 : 1)].map((_, j) => (
                            <div key={j} className="p-2 rounded-md bg-surface-dark/60 border border-border/20">
                              <div className="h-2 w-3/4 bg-muted rounded mb-2" />
                              <div className="h-2 w-1/2 bg-muted/50 rounded" />
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
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
