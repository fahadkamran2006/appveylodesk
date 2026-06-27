import { useMemo, useState } from 'react';
import { Eye, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useBranding } from '@/contexts/BrandingContext';

type PreviewKey = 'deliverable_uploaded' | 'project_status_change' | 'invoice_paid';

interface PreviewSpec {
  key: PreviewKey;
  label: string;
  subject: string;
  title: string;
  message: string;
  cta: string;
}

function buildPreviews(agencyName: string): PreviewSpec[] {
  return [
    {
      key: 'deliverable_uploaded',
      label: 'Deliverable Uploaded',
      subject: `New deliverable for "Brand Launch Promo"`,
      title: 'New deliverable uploaded',
      message: `Your editor just uploaded "Final_Cut_v2.mp4" to the project Brand Launch Promo. Open the project to review the new file.`,
      cta: 'View Deliverable',
    },
    {
      key: 'project_status_change',
      label: 'Review Requested',
      subject: `Review requested on "Brand Launch Promo"`,
      title: 'A project is ready for your review',
      message: `The project Brand Launch Promo has been moved to Review. Please leave time-coded feedback or approve the cut.`,
      cta: 'Open Review',
    },
    {
      key: 'invoice_paid',
      label: 'Invoice Paid',
      subject: `Invoice INV-00042 was marked as paid`,
      title: 'Payment received 🎉',
      message: `Invoice INV-00042 for $1,250.00 has been marked as paid. The payment will reflect in your billing history shortly.`,
      cta: 'View Invoice',
    },
  ];
}

function EmailFrame({ spec, agencyName }: { spec: PreviewSpec; agencyName: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border/60 bg-[#0a0a0b]">
      <div className="px-4 py-3 border-b border-border/60 bg-surface-elevated/60 flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">
            From: <span className="text-foreground">{agencyName} &lt;noreply@veylodesk.com&gt;</span>
          </p>
          <p className="text-xs text-muted-foreground truncate">
            Subject: <span className="text-foreground">{spec.subject}</span>
          </p>
        </div>
      </div>
      <div className="p-6 bg-[#0a0a0b]">
        <div
          className="mx-auto max-w-[520px] rounded-2xl overflow-hidden"
          style={{ background: '#18181b' }}
        >
          <div
            style={{
              padding: '24px 32px',
              background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
            }}
          >
            <h1 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 600 }}>
              {agencyName}
            </h1>
          </div>
          <div style={{ padding: 32 }}>
            <p style={{ margin: '0 0 8px 0', color: '#a1a1aa', fontSize: 14 }}>Hi there,</p>
            <h2 style={{ margin: '16px 0', color: '#fff', fontSize: 18, fontWeight: 600 }}>
              {spec.title}
            </h2>
            <p style={{ margin: '0 0 24px 0', color: '#d4d4d8', fontSize: 14, lineHeight: 1.6 }}>
              {spec.message}
            </p>
            <span
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                color: '#fff',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {spec.cta}
            </span>
          </div>
          <div style={{ padding: 24, textAlign: 'center' }}>
            <p style={{ margin: 0, color: '#71717a', fontSize: 12 }}>
              You received this email because you have notifications enabled for {agencyName}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmailPreviewModal() {
  const [open, setOpen] = useState(false);
  const { branding } = useBranding();
  const agencyName = branding?.agency_name || 'Veylodesk';
  const previews = useMemo(() => buildPreviews(agencyName), [agencyName]);
  const [active, setActive] = useState<PreviewKey>('deliverable_uploaded');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Eye className="h-4 w-4" />
          Preview emails
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notification Preview
          </DialogTitle>
          <DialogDescription>
            See exactly how the most important email alerts will look in your inbox before enabling them.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={active} onValueChange={(v) => setActive(v as PreviewKey)}>
          <TabsList className="grid grid-cols-3 w-full">
            {previews.map((p) => (
              <TabsTrigger key={p.key} value={p.key} className="text-xs">
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {previews.map((p) => (
            <TabsContent key={p.key} value={p.key} className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{p.key}</Badge>
                <span className="text-xs text-muted-foreground">
                  Toggle this alert in the list below to start receiving it.
                </span>
              </div>
              <EmailFrame spec={p} agencyName={agencyName} />
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
