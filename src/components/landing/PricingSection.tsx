import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ArrowRight } from "lucide-react";

const PricingSection = () => {
  const plans = [
    {
      name: "Starter",
      price: "$49",
      period: "/month",
      description: "Perfect for solo operators and small teams",
      features: [
        "Up to 3 team members",
        "10 active projects",
        "5GB storage",
        "Basic invoicing",
        "Email support",
      ],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      name: "Professional",
      price: "$99",
      period: "/month",
      description: "For growing agencies ready to scale",
      features: [
        "Up to 10 team members",
        "Unlimited projects",
        "50GB storage",
        "Advanced invoicing & payments",
        "Client portal customization",
        "Priority support",
        "API access",
      ],
      cta: "Start Free Trial",
      popular: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large agencies with complex needs",
      features: [
        "Unlimited team members",
        "Unlimited everything",
        "500GB storage",
        "White-label options",
        "Dedicated account manager",
        "Custom integrations",
        "SLA guarantee",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-surface-dark" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="container relative z-10 mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Founders Program</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Simple Pricing.{" "}
            <span className="text-gradient">Serious Results.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            No hidden fees. No per-seat surprises. Just one flat rate for your entire agency.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`relative glass-card rounded-2xl p-8 flex flex-col ${
                plan.popular
                  ? "border-primary/50 shadow-glow scale-105 md:scale-110 z-10"
                  : "border-border/30"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-primary text-primary-foreground text-sm font-medium shadow-lg">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.popular ? "hero" : "outline"}
                size="lg"
                className="w-full"
                asChild
              >
                <Link to="/auth/signup">
                  {plan.cta}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>

        {/* Founders Badge */}
        <div className="mt-16 max-w-2xl mx-auto text-center">
          <div className="glass-card rounded-2xl p-8 border-primary/30">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20 text-warning text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Limited Time
            </div>
            <h3 className="text-2xl font-bold mb-3 text-foreground">
              Founders Lifetime Access
            </h3>
            <p className="text-muted-foreground mb-6">
              Lock in lifetime access at our launch price. First 100 agencies get 50% off forever.
              <span className="block mt-2 text-foreground font-medium">Only 23 spots remaining.</span>
            </p>
            <Button variant="hero" size="xl" asChild>
              <Link to="/auth/signup">
                Claim Your Spot
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
