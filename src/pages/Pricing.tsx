import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription, openPaddleCheckout } from "@/hooks/useSubscription";

interface PlanFeature {
  text: string;
  highlight: boolean;
}

interface Plan {
  name: string;
  key: 'free' | 'starter' | 'growth' | 'scale';
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  features: PlanFeature[];
  popular: boolean;
  isFree?: boolean;
}

const Pricing = () => {
  const [isYearly, setIsYearly] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { user } = useAuth();
  const { agencyId, isActive } = useSubscription();
  const navigate = useNavigate();

  const plans: Plan[] = [
    {
      name: "Free",
      key: "free",
      monthlyPrice: 0,
      yearlyPrice: 0,
      description: "For Solo Creators",
      features: [
        { text: "Unlimited Editors", highlight: true },
        { text: "1 Active Client", highlight: false },
        { text: "1 Active Project", highlight: false },
        { text: "2GB Storage", highlight: false },
        { text: "Powered by Veylodesk branding", highlight: false },
      ],
      popular: false,
      isFree: true,
    },
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
    if (plan.isFree) {
      return { main: '$0', period: '/mo', subtext: 'Free forever' };
    }
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
    // Free plan: send users straight to signup / onboarding (no Paddle checkout)
    if (plan.key === 'free') {
      if (!user) {
        navigate(`/auth/signup?plan=free`);
      } else {
        navigate(agencyId ? '/admin/dashboard' : '/onboarding');
      }
      return;
    }

    // If not logged in, redirect to signup with plan + interval params
    const interval = isYearly ? 'yearly' : 'monthly';
    if (!user) {
      navigate(`/auth/signup?plan=${plan.key}&interval=${interval}`);
      return;
    }

    // If no agency yet, something is wrong - redirect to onboarding
    if (!agencyId) {
      navigate('/onboarding');
      return;
    }

    setLoadingPlan(plan.key);

    // Build checkout URL with agency_id
    openPaddleCheckout(plan.key as 'starter' | 'growth' | 'scale', interval, agencyId);
    setTimeout(() => setLoadingPlan(null), 2000);
  };

  return (
    <>
      <Helmet>
        <title>Pricing | Video Agency Management Software — Veylodesk</title>
        <meta name="description" content="Transparent pricing for Veylodesk — the video agency management software and production CRM. Plans for freelancers, growing agencies, and production houses." />
        <link rel="canonical" href="https://veylodesk.com/pricing" />
        <meta property="og:title" content="Pricing | Video Agency Management Software — Veylodesk" />
        <meta property="og:description" content="Pricing for Veylodesk — video agency management software and video production CRM." />
        <meta property="og:url" content="https://veylodesk.com/pricing" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Veylodesk Agency OS",
          "description": "Subscription plans for video editing agencies — Starter, Growth, and Scale.",
          "brand": { "@type": "Brand", "name": "Veylodesk" },
          "offers": plans.map((p) => ({
            "@type": "Offer",
            "name": p.name,
            "description": p.description,
            "price": (isYearly ? p.yearlyPrice : p.monthlyPrice).toString(),
            "priceCurrency": "USD",
            "url": `https://veylodesk.com/pricing`,
            "availability": "https://schema.org/InStock",
          })),
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="pt-32 pb-24">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center mb-12">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                Simple Pricing.{" "}
                <span className="text-gradient">Serious Results.</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                No hidden fees. No per-seat surprises. One flat rate for your entire agency.
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
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {plans.map((plan) => {
                const price = getDisplayPrice(plan);
                const isLoading = loadingPlan === plan.key;
                return (
                  <div
                    key={plan.name}
                    className={`relative glass-card rounded-2xl p-8 flex flex-col ${
                      plan.popular
                        ? "border-primary/50 shadow-glow scale-105 z-10"
                        : "border-border/30"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-primary text-primary-foreground text-sm font-medium shadow-lg">
                        Most Popular
                      </div>
                    )}

                    <div className="mb-8">
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        {plan.name}
                      </h3>
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-4xl font-bold text-foreground">{price.main}</span>
                        <span className="text-muted-foreground">{price.period}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{price.subtext}</p>
                      <p className="text-muted-foreground mt-2">{plan.description}</p>
                    </div>

                    <ul className="space-y-4 mb-8 flex-1">
                      {plan.features.map((feature) => (
                        <li key={feature.text} className="flex items-start gap-3">
                          <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${feature.highlight ? 'text-primary' : 'text-success'}`} />
                          <span className={`${feature.highlight ? 'font-bold text-foreground' : 'text-foreground'}`}>
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
                          {plan.isFree
                            ? (user ? 'Use Free Plan' : 'Start for Free')
                            : (user ? 'Subscribe Now' : 'Get Started')}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* FAQ or Guarantee */}
            <div className="mt-24 max-w-2xl mx-auto text-center">
              <h2 className="text-2xl font-bold text-foreground mb-4">100% Satisfaction Guarantee</h2>
              <p className="text-muted-foreground">
                Not satisfied? Get a full refund within the first 14 days—no questions asked.
              </p>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Pricing;
