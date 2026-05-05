import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Mail, MailCheck, MailX, MousePointerClick, Eye, AlertTriangle,
  Loader2, RefreshCw, Search, Inbox,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Subscriber = {
  id: string;
  email: string;
  first_name: string;
  downloaded_at: string;
  email_2_sent_at: string | null;
  email_3_sent_at: string | null;
  email_1_message_id: string | null;
  email_2_message_id: string | null;
  email_3_message_id: string | null;
  unsubscribed_at: string | null;
};

type EmailEvent = {
  id: string;
  subscriber_id: string | null;
  message_id: string | null;
  recipient_email: string;
  email_type: number | null;
  event_type: string;
  bounce_reason: string | null;
  click_url: string | null;
  occurred_at: string;
};

const EVENT_RANK: Record<string, number> = {
  queued: 0, sent: 1, delivered: 2, opened: 3, clicked: 4,
  delivery_delayed: 1, bounced: 5, complained: 6, failed: 5,
};

function statusBadge(s: string) {
  const map: Record<string, { cls: string; label: string }> = {
    delivered: { cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", label: "Delivered" },
    opened: { cls: "bg-blue-500/15 text-blue-600 border-blue-500/30", label: "Opened" },
    clicked: { cls: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30", label: "Clicked" },
    sent: { cls: "bg-slate-500/15 text-slate-600 border-slate-500/30", label: "Sent" },
    queued: { cls: "bg-slate-500/15 text-slate-600 border-slate-500/30", label: "Queued" },
    bounced: { cls: "bg-red-500/15 text-red-600 border-red-500/30", label: "Bounced" },
    complained: { cls: "bg-orange-500/15 text-orange-600 border-orange-500/30", label: "Spam complaint" },
    failed: { cls: "bg-red-500/15 text-red-600 border-red-500/30", label: "Failed" },
    delivery_delayed: { cls: "bg-amber-500/15 text-amber-600 border-amber-500/30", label: "Delayed" },
  };
  const m = map[s] ?? { cls: "bg-muted text-muted-foreground", label: s };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

type ResendCheck = {
  audience_id_present: boolean;
  audience_id: string | null;
  audience_valid: boolean;
  audience: { id: string; name: string; created_at: string } | null;
  contacts_count: number | null;
  last_webhook_event: { event_type: string; recipient_email: string; email_type: number | null; occurred_at: string } | null;
  webhook_events_24h: number;
  error: string | null;
};

export default function LeadMagnetEmailsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [search, setSearch] = useState("");
  const [resendCheck, setResendCheck] = useState<ResendCheck | null>(null);
  const [checking, setChecking] = useState(false);

  const runResendCheck = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("lead-magnet-resend-check");
      if (error) throw error;
      setResendCheck(data as ResendCheck);
    } catch (e: any) {
      setResendCheck({
        audience_id_present: false, audience_id: null, audience_valid: false, audience: null,
        contacts_count: null, last_webhook_event: null, webhook_events_24h: 0,
        error: e?.message ?? String(e),
      });
    } finally {
      setChecking(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    const [{ data: subs, error: subsError }, { data: evs, error: evsError }] = await Promise.all([
      supabase
        .from("lead_magnet_subscribers")
        .select("id,email,first_name,downloaded_at,email_2_sent_at,email_3_sent_at,email_1_message_id,email_2_message_id,email_3_message_id,unsubscribed_at")
        .order("downloaded_at", { ascending: false })
        .limit(2000),
      supabase
        .from("lead_magnet_email_events")
        .select("id,subscriber_id,message_id,recipient_email,email_type,event_type,bounce_reason,click_url,occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(5000),
    ]);

    if (subsError || evsError) {
      setError(subsError?.message ?? evsError?.message ?? "Failed to load lead magnet analytics.");
    }

    setSubscribers((subs as Subscriber[]) || []);
    setEvents((evs as EmailEvent[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); runResendCheck(); }, []);

  // Aggregate latest event per (subscriber, email_type)
  const latestBy = useMemo(() => {
    const map = new Map<string, EmailEvent>();
    for (const e of events) {
      const key = `${e.subscriber_id ?? e.recipient_email}|${e.email_type ?? 0}`;
      const cur = map.get(key);
      if (!cur || (EVENT_RANK[e.event_type] ?? 0) > (EVENT_RANK[cur.event_type] ?? 0)) {
        map.set(key, e);
      }
    }
    return map;
  }, [events]);

  // Per-email-type stats
  const stats = useMemo(() => {
    const calc = (type: number) => {
      const items = subscribers
        .filter((s) => (type === 1 ? true : type === 2 ? !!s.email_2_sent_at : !!s.email_3_sent_at))
        .map((s) => latestBy.get(`${s.id}|${type}`)?.event_type);
      const total = items.length;
      const cnt = (st: string) => items.filter((x) => x === st).length;
      const delivered = cnt("delivered") + cnt("opened") + cnt("clicked");
      return {
        total,
        delivered,
        opened: cnt("opened") + cnt("clicked"),
        clicked: cnt("clicked"),
        bounced: cnt("bounced") + cnt("failed"),
        complained: cnt("complained"),
      };
    };
    return { e1: calc(1), e2: calc(2), e3: calc(3) };
  }, [subscribers, latestBy]);

  const totals = useMemo(() => {
    const total = subscribers.length;
    const unsub = subscribers.filter((s) => s.unsubscribed_at).length;
    return { total, unsub };
  }, [subscribers]);

  // "Stuck in spam/promotions" heuristic — sent/delivered with NO opens after 48h
  const stuckCandidates = useMemo(() => {
    const out: { subscriber: Subscriber; emailType: number; sentAt: string }[] = [];
    const TWO_DAYS = 1000 * 60 * 60 * 48;
    const now = Date.now();
    for (const s of subscribers) {
      const checks: { type: number; sent: string | null }[] = [
        { type: 1, sent: s.downloaded_at },
        { type: 2, sent: s.email_2_sent_at },
        { type: 3, sent: s.email_3_sent_at },
      ];
      for (const c of checks) {
        if (!c.sent) continue;
        if (now - new Date(c.sent).getTime() < TWO_DAYS) continue;
        const ev = latestBy.get(`${s.id}|${c.type}`);
        const rank = EVENT_RANK[ev?.event_type ?? ""] ?? 0;
        // delivered/sent but never opened (rank < 3) AND not bounced/complained
        if (rank < 3 && rank >= 1 && ev?.event_type !== "bounced" && ev?.event_type !== "complained") {
          out.push({ subscriber: s, emailType: c.type, sentAt: c.sent });
        }
      }
    }
    return out;
  }, [subscribers, latestBy]);

  const bounced = useMemo(
    () => events.filter((e) => e.event_type === "bounced" || e.event_type === "failed"),
    [events],
  );
  const complaints = useMemo(
    () => events.filter((e) => e.event_type === "complained"),
    [events],
  );

  const filteredSubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subscribers;
    return subscribers.filter(
      (s) => s.email.toLowerCase().includes(q) || s.first_name?.toLowerCase().includes(q),
    );
  }, [search, subscribers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const StatCard = ({
    icon: Icon, label, value, sub,
  }: { icon: any; label: string; value: string | number; sub?: string }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );

  const EmailStatRow = ({ name, s }: { name: string; s: typeof stats.e1 }) => {
    const pct = (n: number) => (s.total ? Math.round((n / s.total) * 100) : 0);
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{name}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
          <div><div className="text-muted-foreground text-xs">Sent</div><div className="font-semibold">{s.total}</div></div>
          <div><div className="text-muted-foreground text-xs">Delivered</div><div className="font-semibold">{s.delivered} <span className="text-xs text-muted-foreground">({pct(s.delivered)}%)</span></div></div>
          <div><div className="text-muted-foreground text-xs">Opened</div><div className="font-semibold">{s.opened} <span className="text-xs text-muted-foreground">({pct(s.opened)}%)</span></div></div>
          <div><div className="text-muted-foreground text-xs">Clicked</div><div className="font-semibold">{s.clicked} <span className="text-xs text-muted-foreground">({pct(s.clicked)}%)</span></div></div>
          <div><div className="text-muted-foreground text-xs">Bounced</div><div className="font-semibold text-red-600">{s.bounced}</div></div>
          <div><div className="text-muted-foreground text-xs">Complaints</div><div className="font-semibold text-orange-600">{s.complained}</div></div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Lead Magnet Emails</h2>
          <p className="text-sm text-muted-foreground">Delivery, opens, clicks, bounces, and inbox-placement signals</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Mail} label="Subscribers" value={totals.total} />
        <StatCard icon={MailCheck} label="Delivered (E1)" value={stats.e1.delivered} sub={`${stats.e1.total ? Math.round((stats.e1.delivered/stats.e1.total)*100) : 0}% of sent`} />
        <StatCard icon={Eye} label="Opens (any)" value={stats.e1.opened + stats.e2.opened + stats.e3.opened} />
        <StatCard icon={MailX} label="Unsubscribed" value={totals.unsub} />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <EmailStatRow name="Email 1 — Welcome + Guide" s={stats.e1} />
        <EmailStatRow name="Email 2 — Day 3 Follow-up" s={stats.e2} />
        <EmailStatRow name="Email 3 — Day 6 Last Note" s={stats.e3} />
      </div>

      <Tabs defaultValue="subscribers">
        <TabsList>
          <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
          <TabsTrigger value="bounces">Bounces ({bounced.length})</TabsTrigger>
          <TabsTrigger value="complaints">Spam Complaints ({complaints.length})</TabsTrigger>
          <TabsTrigger value="stuck">Stuck in Promotions ({stuckCandidates.length})</TabsTrigger>
          <TabsTrigger value="events">Event Log</TabsTrigger>
        </TabsList>

        <TabsContent value="subscribers" className="mt-4 space-y-3">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search email or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subscriber</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Email 1</TableHead>
                  <TableHead>Email 2</TableHead>
                  <TableHead>Email 3</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubs.slice(0, 200).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.first_name}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                      {s.unsubscribed_at && (
                        <Badge variant="outline" className="mt-1 bg-muted text-muted-foreground">Unsubscribed</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(s.downloaded_at), { addSuffix: true })}
                    </TableCell>
                    {[1, 2, 3].map((t) => {
                      const sentAt = t === 1 ? s.downloaded_at : t === 2 ? s.email_2_sent_at : s.email_3_sent_at;
                      const ev = latestBy.get(`${s.id}|${t}`);
                      return (
                        <TableCell key={t}>
                          {!sentAt ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="space-y-1">
                              {statusBadge(ev?.event_type ?? "queued")}
                              {ev?.bounce_reason && (
                                <div className="text-xs text-red-600 line-clamp-1">{ev.bounce_reason}</div>
                              )}
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {!filteredSubs.length && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No subscribers yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="bounces" className="mt-4">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bounced.slice(0, 200).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{e.recipient_email}</TableCell>
                    <TableCell><Badge variant="outline">Email {e.email_type ?? "?"}</Badge></TableCell>
                    <TableCell className="text-xs text-red-600">{e.bounce_reason ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(e.occurred_at), { addSuffix: true })}</TableCell>
                  </TableRow>
                ))}
                {!bounced.length && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No bounces — clean!</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="complaints" className="mt-4">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complaints.slice(0, 200).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{e.recipient_email}</TableCell>
                    <TableCell><Badge variant="outline">Email {e.email_type ?? "?"}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(e.occurred_at), { addSuffix: true })}</TableCell>
                  </TableRow>
                ))}
                {!complaints.length && (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No spam complaints.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="stuck" className="mt-4 space-y-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-md border bg-muted/40 p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Heuristic: emails sent more than 48 hours ago that were delivered but never opened.
              These recipients likely have the email in Promotions, Spam, or simply ignored it.
              Use this list to A/B test subject lines or reach out personally.
            </span>
          </div>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stuckCandidates.slice(0, 200).map((c, i) => (
                  <TableRow key={`${c.subscriber.id}-${c.emailType}-${i}`}>
                    <TableCell>
                      <div className="font-medium">{c.subscriber.first_name}</div>
                      <div className="text-xs text-muted-foreground">{c.subscriber.email}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline">Email {c.emailType}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.sentAt), { addSuffix: true })}</TableCell>
                  </TableRow>
                ))}
                {!stuckCandidates.length && (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground"><Inbox className="w-5 h-5 mx-auto mb-2" />Nothing stuck — engagement is healthy.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.slice(0, 300).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{statusBadge(e.event_type)}</TableCell>
                    <TableCell className="text-sm">{e.recipient_email}</TableCell>
                    <TableCell><Badge variant="outline">E{e.email_type ?? "?"}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {e.click_url ? <span className="text-indigo-600">{e.click_url}</span> : e.bounce_reason ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(e.occurred_at), { addSuffix: true })}</TableCell>
                  </TableRow>
                ))}
                {!events.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      <MousePointerClick className="w-5 h-5 mx-auto mb-2" />
                      No events yet. Configure the Resend webhook to point at the
                      <code className="ml-1 px-1 bg-muted rounded">lead-magnet-resend-webhook</code> endpoint.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
