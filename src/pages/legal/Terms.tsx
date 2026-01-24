import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
const Terms = () => {
  return <>
      <Helmet>
        <title>Terms of Service | Veylodesk</title>
        <meta name="description" content="Veylodesk terms of service - the agreement between you and Veylodesk." />
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

              <h1 className="text-4xl font-bold text-foreground mb-8">Terms of Service</h1>
              <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

              <div className="prose prose-invert max-w-none space-y-8">
                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
                  <p className="text-muted-foreground">These Terms of Service constitute a legally binding agreement between you and VeyloDesk. By accessing or using the Veylodesk platform and website (veylodesk.com), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">2. Description of Service</h2>
                  <p className="text-muted-foreground">
                    Veylodesk is a project management and client portal platform designed for video production agencies. We provide tools for managing projects, clients, editors, invoicing, and file delivery.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">3. User Accounts</h2>
                  <p className="text-muted-foreground mb-4">
                    You are responsible for:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li>Maintaining the confidentiality of your account credentials</li>
                    <li>All activities that occur under your account</li>
                    <li>Notifying us immediately of any unauthorized use</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">4. Acceptable Use</h2>
                  <p className="text-muted-foreground mb-4">
                    You agree not to:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li>Use the service for any illegal purpose</li>
                    <li>Upload malicious content or code</li>
                    <li>Attempt to gain unauthorized access to any part of the service</li>
                    <li>Interfere with the proper functioning of the service</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">5. Billing and Payment</h2>
                  <p className="text-muted-foreground">
                    Subscription fees are billed in advance on a monthly or annual basis. You authorize us to charge your payment method for all fees due. All fees are non-refundable except as required by law.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">6. Termination</h2>
                  <p className="text-muted-foreground">
                    We may terminate or suspend your account at any time for violations of these terms. You may cancel your subscription at any time through your account settings.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-semibold text-foreground mb-4">7. Contact</h2>
                  <p className="text-muted-foreground">
                    For questions about these Terms, contact us at support@veylodesk.com.
                  </p>
                </section>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>;
};
export default Terms;