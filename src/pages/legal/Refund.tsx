import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const Refund = () => {
  return (
    <>
      <Helmet>
        <title>Refund Policy | Veylodesk</title>
        <meta name="description" content="Veylodesk refund policy - our commitment to your satisfaction." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="pt-32 pb-24">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to home
              </Link>

              <h1 className="text-4xl font-bold text-foreground mb-8">Refund Policy</h1>
              <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

              <div className="prose prose-invert max-w-none space-y-8">
                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">14-Day Money-Back Guarantee</h2>
                  <p className="text-muted-foreground">
                    We offer a 14-day money-back guarantee on all new subscriptions. If you're not satisfied with Veylodesk within the first 14 days of your paid subscription, contact us for a full refund—no questions asked.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">How to Request a Refund</h2>
                  <p className="text-muted-foreground mb-4">
                    To request a refund:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li>Email us at billing@veylodesk.com within 14 days of your purchase</li>
                    <li>Include your account email and the reason for your refund request</li>
                    <li>Refunds are processed within 5-10 business days</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">After 14 Days</h2>
                  <p className="text-muted-foreground">
                    After the 14-day period, refunds are not available. However, you may cancel your subscription at any time to prevent future charges. Your access will continue until the end of your current billing period.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">Subscription Changes</h2>
                  <p className="text-muted-foreground">
                    You may upgrade or downgrade your subscription at any time. When upgrading, you'll be charged the prorated difference immediately. When downgrading, the change takes effect at the start of your next billing cycle.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">Chargebacks</h2>
                  <p className="text-muted-foreground">
                    If you initiate a chargeback or dispute with your bank without first contacting us, your account may be suspended. We encourage you to reach out to our support team to resolve any billing issues directly.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Us</h2>
                  <p className="text-muted-foreground">
                    For any questions about our refund policy, please contact billing@veylodesk.com.
                  </p>
                </section>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Refund;
