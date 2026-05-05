import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Video,
  Lock,
  Users,
  Receipt,
  MessageSquare,
  Loader2,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: Building2,
    title: "Look like an agency, not a freelancer.",
    body: "Give your clients a branded professional portal they log into — not a Google Drive link.",
  },
  {
    icon: Video,
    title: "Fix your feedback process.",
    body: "Frame-accurate timestamped video reviews. No more WhatsApp voice notes at midnight.",
  },
  {
    icon: Lock,
    title: "Protect your final files.",
    body: "Never deliver a file before payment clears. Lock the download until the invoice is paid.",
  },
  {
    icon: Users,
    title: "Manage your editors properly.",
    body: "Kanban boards, task logs, attendance tracking, and freelancer payouts — all in one system.",
  },
  {
    icon: Receipt,
    title: "Get paid on time, every time.",
    body: "Build leverage into every invoice. A system that makes late payment structurally impossible.",
  },
  {
    icon: MessageSquare,
    title: "Communicate like a pro.",
    body: "Project-specific channels, proactive updates, and no more client messages buried in Slack.",
  },
];

function LeadForm({ idSuffix }: { idSuffix: string }) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ firstName?: string; email?: string }>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<null | "ok" | "duplicate">(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!firstName.trim()) errs.firstName = "First name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = "Please enter a valid email";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("lead-magnet-subscribe", {
        body: { email: email.trim(), first_name: firstName.trim() },
      });
      if (error) throw error;
      setDone(data?.duplicate ? "duplicate" : "ok");
    } catch (err) {
      setErrors({ email: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
        <p className="text-foreground font-medium">
          {done === "duplicate"
            ? "Looks like you're already on the list — check your inbox for the guide!"
            : "Check your inbox — the guide is on its way."}
        </p>
        <p className="text-sm text-muted-foreground">
          Check your spam folder if you don't see it in 2 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`fn-${idSuffix}`}>First name</Label>
        <Input
          id={`fn-${idSuffix}`}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Your first name"
          aria-invalid={!!errors.firstName}
          className={errors.firstName ? "border-destructive" : ""}
        />
        {errors.firstName && (
          <p className="text-xs text-destructive">{errors.firstName}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`em-${idSuffix}`}>Email address</Label>
        <Input
          id={`em-${idSuffix}`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@youragency.com"
          aria-invalid={!!errors.email}
          className={errors.email ? "border-destructive" : ""}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="w-full bg-[#4B4BE1] hover:bg-[#4B4BE1]/90 text-white"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…
          </>
        ) : (
          "Send me the free guide →"
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Free forever. No spam. Unsubscribe anytime.
      </p>
    </form>
  );
}

export default function FreeGuide() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-foreground">
      <Helmet>
        <title>Free Guide: Run a Video Editing Agency Like a Pro | Veylodesk</title>
        <meta
          name="description"
          content="Free guide for video editing agency owners — manage clients professionally, protect deliverables, and run a real business."
        />
        <link rel="canonical" href="https://veylodesk.com/free-guide" />
      </Helmet>

      {/* Hero */}
      <section className="px-6 pt-20 pb-24 md:pt-32 md:pb-32">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            The Free Guide Every Video Editing Agency Owner Needs.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground">
            Learn exactly how to manage clients professionally, protect your
            deliverables, and run your agency like a real business — not a cheap
            freelancer.
          </p>
          <div className="max-w-md mx-auto rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
            <LeadForm idSuffix="hero" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14">
            What you'll learn in this guide
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-[#4B4BE1]/40 transition"
              >
                <div className="w-11 h-11 rounded-lg bg-[#4B4BE1]/15 text-[#4B4BE1] flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Author */}
      <section className="px-6 py-20 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <p className="text-sm uppercase tracking-widest text-[#4B4BE1] font-medium">
            Written by someone who lived this
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Fahad Kamran ran a video editing agency called Videoflickz for two years
            before building Veylodesk. Every chapter in this guide comes from a real
            operational problem he personally solved.
          </p>
        </div>
      </section>

      {/* Second CTA */}
      <section className="px-6 py-24 border-t border-white/5">
        <div className="max-w-md mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold">
            Get the guide — it's completely free.
          </h2>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left">
            <LeadForm idSuffix="footer" />
          </div>
        </div>
      </section>
    </div>
  );
}
