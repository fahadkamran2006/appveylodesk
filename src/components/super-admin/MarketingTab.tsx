import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MailCheck, Send, Users, TrendingUp, Calendar } from "lucide-react";
import { toast } from "sonner";

interface InactiveUser {
  user_id: string;
  agency_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  days_since_signup: number;
  onboarding_email_sent: boolean;
}

interface MarketingAnalytics {
  inactive_users: InactiveUser[];
  recent_emails: Array<{
    id: string;
    user_id: string;
    email_type: string;
    sent_at: string;
    metadata: Record<string, unknown>;
  }>;
  total_inactive: number;
  total_emails_sent: number;
}

async function invokeAction(body: Record<string, unknown>) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-actions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Action failed");
  }
  return res.json();
}

export default function MarketingTab() {
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useQuery<MarketingAnalytics>({
    queryKey: ["super-admin-marketing"],
    queryFn: () => invokeAction({ action: "get_marketing_analytics" }),
    refetchInterval: 120_000,
  });

  const sendBulk = useMutation({
    mutationFn: async () => {
      const users = (data?.inactive_users || []).filter(
        (u) => selectedUsers.has(u.user_id) && !u.onboarding_email_sent
      );
      if (users.length === 0) throw new Error("No users selected");
      return invokeAction({ action: "send_bulk_onboarding_emails", users });
    },
    onSuccess: (res) => {
      toast.success(`Sent ${res.sent} onboarding emails`);
      setSelectedUsers(new Set());
      refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendSingle = useMutation({
    mutationFn: (user: InactiveUser) =>
      invokeAction({
        action: "send_bulk_onboarding_emails",
        users: [user],
      }),
    onSuccess: () => {
      toast.success("Onboarding email sent");
      refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const unsent = (data?.inactive_users || []).filter((u) => !u.onboarding_email_sent);
    setSelectedUsers(new Set(unsent.map((u) => u.user_id)));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const inactiveUnsent = (data?.inactive_users || []).filter((u) => !u.onboarding_email_sent);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Users className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inactive Users (15+ days)</p>
              <p className="text-2xl font-bold">{data?.total_inactive || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MailCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Marketing Emails Sent</p>
              <p className="text-2xl font-bold">{data?.total_emails_sent || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending Nudges</p>
              <p className="text-2xl font-bold">{inactiveUnsent.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inactive Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Inactive Users — No Projects
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll} disabled={inactiveUnsent.length === 0}>
                Select All Unsent
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => sendBulk.mutate()}
                disabled={selectedUsers.size === 0 || sendBulk.isPending}
              >
                <Send className="h-3.5 w-3.5" />
                {sendBulk.isPending ? "Sending..." : `Send to ${selectedUsers.size}`}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(data?.inactive_users || []).length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              🎉 All users have created projects — no inactive users!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Days Inactive</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.inactive_users || []).map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(u.user_id)}
                        onChange={() => toggleUser(u.user_id)}
                        disabled={u.onboarding_email_sent}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-sm">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={u.days_since_signup > 30 ? "destructive" : "outline"}>
                        {u.days_since_signup}d
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.onboarding_email_sent ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Sent</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!u.onboarding_email_sent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => sendSingle.mutate(u)}
                          disabled={sendSingle.isPending}
                        >
                          <Send className="h-3 w-3" /> Send
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Emails Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailCheck className="h-5 w-5" /> Recent Marketing Emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.recent_emails || []).length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No marketing emails sent yet.</p>
          ) : (
            <div className="space-y-2">
              {(data?.recent_emails || []).map((log) => (
                <div key={log.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <Badge variant="outline" className="text-xs capitalize shrink-0">
                    {log.email_type.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-sm flex-1 text-muted-foreground">
                    {(log.metadata as any)?.email || log.user_id}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(log.sent_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
