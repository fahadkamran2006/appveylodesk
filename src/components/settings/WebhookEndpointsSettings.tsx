import { useEffect, useState } from 'react';
import { Webhook, Plus, Trash2, Copy, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  last_delivery_at: string | null;
  last_delivery_status: number | null;
}

const AVAILABLE_EVENTS = [
  { id: 'deliverable_uploaded', label: 'Deliverable Uploaded' },
  { id: 'review_requested', label: 'Review Requested' },
  { id: 'invoice_paid', label: 'Invoice Paid' },
];

export function WebhookEndpointsSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(AVAILABLE_EVENTS.map((e) => e.id));

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('webhook_endpoints')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setEndpoints((data as WebhookEndpoint[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim() || !url.trim()) {
      toast({ title: 'Missing fields', description: 'Provide a name and a URL.', variant: 'destructive' });
      return;
    }
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      toast({ title: 'Invalid URL', description: 'Use a valid http(s) URL.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { data: roleRow } = await supabase.from('user_roles').select('agency_id').eq('user_id', user!.id).limit(1).maybeSingle();
    const { error } = await (supabase as any).from('webhook_endpoints').insert({
      agency_id: roleRow?.agency_id,
      name: name.trim(),
      url: url.trim(),
      events,
      created_by: user!.id,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Failed to add webhook', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Webhook added' });
    setName(''); setUrl(''); setShowForm(false);
    load();
  };

  const toggleActive = async (ep: WebhookEndpoint) => {
    await (supabase as any).from('webhook_endpoints').update({ is_active: !ep.is_active }).eq('id', ep.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    await (supabase as any).from('webhook_endpoints').delete().eq('id', id);
    toast({ title: 'Webhook deleted' });
    load();
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast({ title: 'Secret copied' });
  };

  const toggleEvent = (id: string) => {
    setEvents((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  };

  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="w-5 h-5" />
          Webhook Endpoints
        </CardTitle>
        <CardDescription>
          Send event payloads to external services when deliverables are uploaded, reviews are requested, or invoices get paid.
          Each request includes an <code className="text-xs">X-Veylodesk-Secret</code> header you can verify.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : endpoints.length === 0 && !showForm ? (
          <p className="text-sm text-muted-foreground">No webhooks configured yet.</p>
        ) : (
          <div className="space-y-3">
            {endpoints.map((ep) => (
              <div key={ep.id} className="rounded-lg border border-border/50 bg-surface-elevated/50 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{ep.name}</span>
                      {!ep.is_active && <Badge variant="outline" className="text-xs">Paused</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{ep.url}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ep.events.map((e) => (
                        <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={ep.is_active} onCheckedChange={() => toggleActive(ep)} />
                    <Button size="icon" variant="ghost" onClick={() => copySecret(ep.secret)} title="Copy secret">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(ep.id)} title="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {ep.last_delivery_at && (
                  <p className="text-[10px] text-muted-foreground">
                    Last delivery: {new Date(ep.last_delivery_at).toLocaleString()} ({ep.last_delivery_status ?? 'pending'})
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {showForm ? (
          <div className="space-y-3 rounded-lg border border-border/50 p-3">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Zapier integration" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.example.com/..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Events</Label>
              <div className="space-y-1.5">
                {AVAILABLE_EVENTS.map((ev) => (
                  <label key={ev.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={events.includes(ev.id)} onCheckedChange={() => toggleEvent(ev.id)} />
                    {ev.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add webhook'}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add webhook
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
