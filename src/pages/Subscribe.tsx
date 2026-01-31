import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Check, ArrowRight, Loader2, Sparkles, Command } from 'lucide-react';
import { useSubscription, getCheckoutUrl } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';

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

const Subscribe = () => {
  const [isYearly, setIsYearly] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState('');
  const { agencyId, isActive, loading } = useSubscription();
  const navigate = useNavigate();

  // Redirect if already subscribed
  useEffect(() => {
    if (!loading && isActive) {
      navigate('/admin/dashboard');
    }
  }, [isActive, loading, navigate]);

  // Fetch agency name
  useEffect(() => {
    const fetchAgencyName = async () => {
      if (!agencyId) return;
      const { data } = await supabase
        .from('agencies')
        .select('name')
        .eq('id', agencyId)
        .single();
      if (data) setAgencyName(data.name);
    };
    fetchAgencyName();
  }, [agencyId]);

  const plans: Plan[] = [
    {
      name: 'Starter',
      key: 'starter',
      monthlyPrice: 29,
      yearlyPrice: 290,
      description: 'For Freelancers',
      features: [
        { text: 'Unlimited Team Members', highlight: true },
        { text: '5 Active Clients', highlight: false },
        { text: '200GB Storage', highlight: false },
        { text: 'Standard Support', highlight: false },
      ],
      popular: false,
    },
    {
      name: 'Growth',
      key: 'growth',
      monthlyPrice: 79,
      yearlyPrice: 790,
      description: 'For Growing Agencies',
      features: [
        { text: 'Unlimited Team Members', highlight: true },
        { text: '25 Active Clients', highlight: false },
        { text: '1TB Storage', highlight: false },
        { text: 'White-label Branding', highlight: false },
      ],
      popular: true,
    },
    {
      name: 'Scale',
      key: 'scale',
      monthlyPrice: 149,
      yearlyPrice: 1490,
      description: 'For Production Houses',
      features: [
        { text: 'Unlimited Team Members', highlight: true },
        { text: 'Unlimited Clients', highlight: false },
        { text: '3TB Storage', highlight: false },
        { text: 'White-label + Priority Support', highlight: false },
      ],
      popular: false,
    },
  ];

  const getDisplayPrice = (plan: Plan) => {
    if (isYearly) {
      const monthlyEquivalent = Math.round(plan.yearlyPrice / 12);
      return {
        main: `$${monthlyEquivalent}`,
        period: '/mo',
        subtext: `Billed $${plan.yearlyPrice}/year`,
      };
    }
    return {
      main: `$${plan.monthlyPrice}`,
      period: '/mo',
      subtext: 'Billed monthly',
    };
  };

  const handleSelectPlan = (plan: Plan) => {
    if (!agencyId) return;
    
    setLoadingPlan(plan.key);
    const interval = isYearly ? 'yearly' : 'monthly';
    const checkoutUrl = getCheckoutUrl(plan.key, interval, agencyId);
    window.location.href = checkoutUrl;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Choose Your Plan | Veylodesk</title>
        <meta name="description" content="Select a subscription plan to unlock your Veylodesk dashboard." />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border/50 bg-surface-dark/50 backdrop-blur-sm">
          <div className="container mx-auto px-6 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Command className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">
              Veylo<span className="text-gradient">desk</span>
            </span>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center py-12 px-6">
          <div className="max-w-5xl w-full mx-auto">
            {/* Welcome Message */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                Almost there!
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                Welcome to {agencyName || 'your agency'}!
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Choose a plan to unlock your dashboard and start managing your video editing projects.
              </p>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-8">
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
                  Save 17%
                </span>
              )}
            </div>

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const price = getDisplayPrice(plan);
                const isLoading = loadingPlan === plan.key;
                return (
                  <div
                    key={plan.name}
                    className={`relative glass-card rounded-2xl p-6 flex flex-col ${
                      plan.popular
                        ? 'border-primary/50 shadow-glow scale-[1.02] z-10'
                        : 'border-border/30'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-primary text-primary-foreground text-xs font-medium shadow-lg">
                        Most Popular
                      </div>
                    )}

                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-foreground mb-1">
                        {plan.name}
                      </h3>
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-3xl font-bold text-foreground">{price.main}</span>
                        <span className="text-muted-foreground text-sm">{price.period}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{price.subtext}</p>
                      <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                    </div>

                    <ul className="space-y-3 mb-6 flex-1">
                      {plan.features.map((feature) => (
                        <li key={feature.text} className="flex items-start gap-2">
                          <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${feature.highlight ? 'text-primary' : 'text-success'}`} />
                          <span className={`text-sm ${feature.highlight ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                            {feature.text}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant={plan.popular ? 'hero' : 'outline'}
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
                          Get Started
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Guarantee */}
            <div className="text-center mt-8">
              <p className="text-sm text-muted-foreground">
                All plans include a 14-day money-back guarantee. No questions asked.
              </p>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default Subscribe;
