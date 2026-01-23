import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, ArrowLeft, Command } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const Pricing = () => {
  const plans = [
    {
      name: "Starter",
      price: "$29",
      period: "/mo",
      description: "For Freelancers",
      features: [
        { text: "Unlimited Team Members", highlight: true },
        { text: "Manage 5 Active Clients", highlight: false },
        { text: "200GB Storage", highlight: false },
        { text: "Standard Support", highlight: false },
      ],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      name: "Growth",
      price: "$79",
      period: "/mo",
      description: "For Growing Agencies",
      features: [
        { text: "Unlimited Team Members", highlight: true },
        { text: "Manage 25 Active Clients", highlight: false },
        { text: "1TB Storage", highlight: false },
        { text: "White-label Sharing", highlight: false },
      ],
      cta: "Start Free Trial",
      popular: true,
    },
    {
      name: "Scale",
      price: "$149",
      period: "/mo",
      description: "For Production Houses",
      features: [
        { text: "Unlimited Team Members", highlight: true },
        { text: "Unlimited Clients", highlight: false },
        { text: "3TB Storage", highlight: false },
        { text: "Priority Support", highlight: false },
      ],
      cta: "Start Free Trial",
      popular: false,
    },
  ];

  return (
    <>
      <Helmet>
        <title>Pricing | Veylodesk</title>
        <meta name="description" content="Simple, transparent pricing for video agencies of all sizes. Start your 14-day free trial today." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="pt-32 pb-24">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center mb-20">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                Simple Pricing.{" "}
                <span className="text-gradient">Serious Results.</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                No hidden fees. No per-seat surprises. One flat rate for your entire agency.
              </p>
            </div>

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {plans.map((plan) => (
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
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    <p className="text-muted-foreground">{plan.description}</p>
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

            {/* FAQ or Guarantee */}
            <div className="mt-24 max-w-2xl mx-auto text-center">
              <h2 className="text-2xl font-bold text-foreground mb-4">14-Day Money-Back Guarantee</h2>
              <p className="text-muted-foreground">
                Try Veylodesk risk-free. If you're not completely satisfied within the first 14 days, we'll refund your payment—no questions asked.
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
