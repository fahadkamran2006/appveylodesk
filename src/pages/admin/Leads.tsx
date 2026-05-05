import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminGuard } from "@/components/super-admin/SuperAdminGuard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Lead {
  id: string;
  first_name: string;
  email: string;
  downloaded_at: string;
  email_2_sent_at: string | null;
  email_3_sent_at: string | null;
  unsubscribed_at: string | null;
}

function LeadsContent() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("lead_magnet_subscribers")
        .select("*")
        .order("downloaded_at", { ascending: false });
      setLeads((data as Lead[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Lead Magnet Subscribers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Free-guide signups and follow-up status.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Total subscribers: {leads.length}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>First Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Signup</TableHead>
                    <TableHead>Email 2</TableHead>
                    <TableHead>Email 3</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.first_name}</TableCell>
                      <TableCell>{l.email}</TableCell>
                      <TableCell>
                        {format(new Date(l.downloaded_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {l.email_2_sent_at
                          ? format(new Date(l.email_2_sent_at), "MMM d")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {l.email_3_sent_at
                          ? format(new Date(l.email_3_sent_at), "MMM d")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {l.unsubscribed_at ? (
                          <span className="text-destructive text-xs">Unsubscribed</span>
                        ) : (
                          <span className="text-xs text-primary">Active</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {leads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                        No subscribers yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminLeads() {
  return (
    <SuperAdminGuard>
      <LeadsContent />
    </SuperAdminGuard>
  );
}
