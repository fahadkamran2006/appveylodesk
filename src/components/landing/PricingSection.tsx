import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Check, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription, getCheckoutUrl } from "@/hooks/useSubscription";

interface PlanFeature {
  text: string;
  highlight: boolean;
}

interface Plan {
  name: string;
  key: 'starter' | 'growth' | 'scale';
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  features: PlanFeature[];
  popular: boolean;
}

const PricingSection = () => {
  const [isYearly, setIsYearly] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { user } = useAuth();
  const { agencyId } = useSubscription();
  const navigate = useNavigate();

  const plans: Plan[] = [
    {
      name: "Starter",
      key: "starter",
      monthlyPrice: 29,
      yearlyPrice: 290,
      description: "For Freelancers",
      features: [
        { text: "Unlimited Team Members", highlight: true },
        { text: "5 Active Clients", highlight: false },
        { text: "200GB Storage", highlight: false },
        { text: "Standard Support", highlight: false },
      ],
      popular: false,
    },
    {
      name: "Growth",
      key: "growth",
      monthlyPrice: 79,
      yearlyPrice: 790,
      description: "For Growing Agencies",
      features: [
        { text: "Unlimited Team Members", highlight: true },
        { text: "25 Active Clients", highlight: false },
        { text: "1TB Storage", highlight: false },
        { text: "White-label Branding", highlight: false },
      ],
      popular: true,
    },
    {
      name: "Scale",
      key: "scale",
      monthlyPrice: 149,
      yearlyPrice: 1490,
      description: "For Production Houses",
      features: [
        { text: "Unlimited Team Members", highlight: true },
        { text: "Unlimited Clients", highlight: false },
        { text: "3TB Storage", highlight: false },
        { text: "White-label + Priority Support", highlight: false },
      ],
      popular: false,
    },
  ];

  const getDisplayPrice = (plan: Plan) => {
    if (isYearly) {
      const monthlyEquivalent = Math.round(plan.yearlyPrice / 12);
      return {
        main: `$${monthlyEquivalent}`,
        period: "/mo",
        subtext: `Billed $${plan.yearlyPrice}/year`,
      };
    }
    return {
      main: `$${plan.monthlyPrice}`,
      period: "/mo",
      subtext: "Billed monthly",
    };
  };

  const handleSelectPlan = (plan: Plan) => {
    // If not logged in, redirect to signup with plan param
    if (!user) {
      navigate(`/auth/signup?plan=${plan.key}`);
      return;
    }

    // If no agency yet, redirect to onboarding
    if (!agencyId) {
      navigate('/onboarding');
      return;
    }

    setLoadingPlan(plan.key);
    
    // Build checkout URL with agency_id
    const interval = isYearly ? 'yearly' : 'monthly';
    const checkoutUrl = getCheckoutUrl(plan.key, interval, agencyId);
    
    // Redirect to Lemon Squeezy checkout
    window.location.href = checkoutUrl;
  };

  return (
    <section id="pricing" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-surface-dark" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="container relative z-10 mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Simple Pricing</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Choose Your Plan.{" "}
            <span className="text-gradient">Scale Without Limits.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            No hidden fees. No per-seat surprises. Just one flat rate for your entire agency.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm font-medium transition-colors ${!isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
            Monthly
          </span>
          <Switch
            checked={isYearly}
            onCheckedChange={setIsYearly}
            className="data-[state=checked]:bg-primary"
          />
          <span className={`text-sm font-medium transition-colors ${isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
            Yearly
          </span>
          {isYearly && (
            <span className="ml-2 px-3 py-1 rounded-full bg-success/10 text-success text-sm font-medium">
              Save 17% — 2 Months Free!
            </span>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const price = getDisplayPrice(plan);
            const isLoading = loadingPlan === plan.key;
            return (
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
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-bold text-foreground">{price.main}</span>
                    <span className="text-muted-foreground">{price.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{price.subtext}</p>
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature.text} className="flex items-start gap-3">
                      <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${feature.highlight ? 'text-primary' : 'text-success'}`} />
                      <span className={`text-sm ${feature.highlight ? 'font-bold text-foreground' : 'text-foreground'}`}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.popular ? "hero" : "outline"}
                  size="lg"
                  className="w-full"
                  onClick={() => handleSelectPlan(plan)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    <>
                      {user ? 'Subscribe Now' : 'Get Started'}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Guarantee Badge */}
        <div className="mt-16 max-w-2xl mx-auto text-center">
          <div className="glass-card rounded-2xl p-8 border-primary/30">
            <h3 className="text-2xl font-bold mb-3 text-foreground">
              100% Satisfaction Guarantee
            </h3>
            <p className="text-muted-foreground">
              Not satisfied? Get a full refund within the first 14 days—no questions asked.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
