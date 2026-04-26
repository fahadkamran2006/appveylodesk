import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, CreditCard, RefreshCw, LifeBuoy, X } from 'lucide-react';
import { openPaddleCheckout } from '@/hooks/useSubscription';

type FailureReason = 'closed' | 'payment_failed' | 'error';

interface CheckoutFailureDetail {
  reason: FailureReason;
  plan: 'starter' | 'growth' | 'scale';
  interval: 'monthly' | 'yearly';
  agencyId: string;
  userEmail?: string;
  errorMessage?: string;
}

const EVENT_NAME = 'veylo:checkout-failure';

export const dispatchCheckoutFailure = (detail: CheckoutFailureDetail) => {
  window.dispatchEvent(new CustomEvent<CheckoutFailureDetail>(EVENT_NAME, { detail }));
};

const REASON_COPY: Record<
  FailureReason,
  { title: string; description: string; tone: 'warn' | 'error' }
> = {
  closed: {
    title: 'Checkout closed before payment',
    description:
      "Looks like the checkout window was closed before your payment finished. No charge was made and your card hasn't been touched — you can pick up right where you left off.",
    tone: 'warn',
  },
  payment_failed: {
    title: "Your payment didn't go through",
    description:
      'Your bank declined the transaction. This is usually a card issue (insufficient funds, card limits, or 3D Secure verification). Try a different card or contact your bank, then retry — nothing was charged.',
    tone: 'error',
  },
  error: {
    title: 'Something went wrong at checkout',
    description:
      'The checkout ran into an unexpected error. Your card was not charged. Try again — if it keeps happening, get in touch and we will sort it out.',
    tone: 'error',
  },
};

export const CheckoutFailureModal = () => {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<CheckoutFailureDetail | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<CheckoutFailureDetail>;
      setDetail(ce.detail);
      setOpen(true);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const handleRetry = () => {
    if (!detail) return;
    setOpen(false);
    // Slight delay so the dialog finishes its close animation before Paddle opens
    setTimeout(() => {
      openPaddleCheckout(detail.plan, detail.interval, detail.agencyId, detail.userEmail);
    }, 200);
  };

  const handleContact = () => {
    window.location.href =
      'mailto:hello@veylodesk.com?subject=Checkout%20issue&body=Hi%20Veylodesk%20team%2C%0A%0AI%20ran%20into%20an%20issue%20completing%20checkout.';
  };

  if (!detail) return null;

  const copy = REASON_COPY[detail.reason];
  const planLabel = detail.plan.charAt(0).toUpperCase() + detail.plan.slice(1);
  const intervalLabel = detail.interval === 'yearly' ? 'yearly' : 'monthly';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div
            className={`mx-auto sm:mx-0 mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
              copy.tone === 'error'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary'
            }`}
          >
            {copy.tone === 'error' ? (
              <AlertCircle className="h-6 w-6" />
            ) : (
              <X className="h-6 w-6" />
            )}
          </div>
          <DialogTitle className="text-xl">{copy.title}</DialogTitle>
          <DialogDescription className="text-base leading-relaxed pt-1">
            {copy.description}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Selected plan</span>
            <span className="font-semibold text-foreground">
              {planLabel} · {intervalLabel}
            </span>
          </div>
          {detail.errorMessage && (
            <div className="mt-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Details:</span> {detail.errorMessage}
            </div>
          )}
        </div>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CreditCard className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
            <span>You weren't charged — your card details are safe.</span>
          </li>
          <li className="flex items-start gap-2">
            <RefreshCw className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
            <span>You can retry instantly with the same or a different card.</span>
          </li>
        </ul>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleContact} className="sm:flex-1">
            <LifeBuoy className="h-4 w-4" />
            Contact support
          </Button>
          <Button variant="hero" onClick={handleRetry} className="sm:flex-1">
            <RefreshCw className="h-4 w-4" />
            Retry payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
