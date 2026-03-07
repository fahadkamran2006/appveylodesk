import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Ban, AlertTriangle, Eye, ShieldOff, Mail, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { AgencyStat } from "@/hooks/useSuperAdminStats";

interface AgencyManagementProps {
  agency: AgencyStat;
  onClose: () => void;
}

export default function AgencyManagement({ agency, onClose }: AgencyManagementProps) {
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [cancelSubConfirm, setCancelSubConfirm] = useState(false);
  const [restrictionModal, setRestrictionModal] = useState(false);
  const [emailModal, setEmailModal] = useState(false);

  const [restrictionType, setRestrictionType] = useState<string>("warning");
  const [restrictionMessage, setRestrictionMessage] = useState("");
  const [restrictionExpiry, setRestrictionExpiry] = useState("");

  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const invokeAction = async (body: Record<string, unknown>) => {
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
  };

  const deleteAgency = useMutation({
    mutationFn: () => invokeAction({ action: "delete_agency", agency_id: agency.id }),
    onSuccess: () => {
      toast.success(`Agency "${agency.name}" deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ["super-admin-stats"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelSubscription = useMutation({
    mutationFn: () => invokeAction({ action: "cancel_subscription", agency_id: agency.id }),
    onSuccess: () => {
      toast.success("Subscription cancelled");
      queryClient.invalidateQueries({ queryKey: ["super-admin-stats"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addRestriction = useMutation({
    mutationFn: () =>
      invokeAction({
        action: "add_restriction",
        agency_id: agency.id,
        restriction_type: restrictionType,
        message: restrictionMessage,
        expires_at: restrictionExpiry || null,
      }),
    onSuccess: () => {
      toast.success(`${restrictionType} restriction applied`);
      setRestrictionModal(false);
      setRestrictionMessage("");
      setRestrictionExpiry("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeRestriction = useMutation({
    mutationFn: (type: string) =>
      invokeAction({ action: "remove_restriction", agency_id: agency.id, restriction_type: type }),
    onSuccess: () => toast.success("Restriction removed"),
    onError: (err: Error) => toast.error(err.message),
  });

  const sendEmail = useMutation({
    mutationFn: () =>
      invokeAction({
        action: "send_custom_email",
        to_email: emailTo,
        subject: emailSubject,
        html_body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px;">${emailBody.replace(/\n/g, "<br/>")}</div>`,
      }),
    onSuccess: () => {
      toast.success("Email sent!");
      setEmailModal(false);
      setEmailTo("");
      setEmailSubject("");
      setEmailBody("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldOff className="h-4 w-4" /> Super Admin Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => { setRestrictionType("warning"); setRestrictionModal(true); }}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Warning
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
              onClick={() => { setRestrictionType("read_only"); setRestrictionModal(true); }}
            >
              <Eye className="h-3.5 w-3.5" /> Read-Only
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => { setRestrictionType("blocked"); setRestrictionModal(true); }}
            >
              <Ban className="h-3.5 w-3.5" /> Block Login
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setEmailModal(true)}
            >
              <Mail className="h-3.5 w-3.5" /> Send Email
            </Button>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-orange-600 border-orange-300"
              onClick={() => setCancelSubConfirm(true)}
              disabled={!agency.is_active}
            >
              <XCircle className="h-3.5 w-3.5" /> Cancel Subscription
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Agency
            </Button>
          </div>

          <div className="flex gap-1 flex-wrap pt-2">
            {["warning", "read_only", "blocked"].map((type) => (
              <Badge
                key={type}
                variant="outline"
                className="text-xs cursor-pointer hover:bg-destructive/10"
                onClick={() => removeRestriction.mutate(type)}
              >
                Remove {type.replace("_", " ")} ×
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agency: {agency.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the agency, all projects, members, invoices, channels, and data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteAgency.mutate()}
              disabled={deleteAgency.isPending}
            >
              {deleteAgency.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Subscription Confirmation */}
      <AlertDialog open={cancelSubConfirm} onOpenChange={setCancelSubConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately cancel the subscription for "{agency.name}" and set their plan to free.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 text-white hover:bg-orange-700"
              onClick={() => cancelSubscription.mutate()}
              disabled={cancelSubscription.isPending}
            >
              {cancelSubscription.isPending ? "Cancelling..." : "Cancel Subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restriction Modal */}
      <Dialog open={restrictionModal} onOpenChange={setRestrictionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {restrictionType === "warning" && "⚠️ Send Warning"}
              {restrictionType === "read_only" && "👁️ Set Read-Only Mode"}
              {restrictionType === "blocked" && "🚫 Block Login"}
            </DialogTitle>
            <DialogDescription>
              Apply a {restrictionType.replace("_", " ")} restriction to "{agency.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Message to display</Label>
              <Textarea
                placeholder="Reason for this action..."
                value={restrictionMessage}
                onChange={(e) => setRestrictionMessage(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Expires at (optional)</Label>
              <Input
                type="datetime-local"
                value={restrictionExpiry}
                onChange={(e) => setRestrictionExpiry(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave empty for permanent restriction</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestrictionModal(false)}>Cancel</Button>
            <Button
              onClick={() => addRestriction.mutate()}
              disabled={addRestriction.isPending}
              variant={restrictionType === "blocked" ? "destructive" : "default"}
            >
              {addRestriction.isPending ? "Applying..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Email Modal */}
      <Dialog open={emailModal} onOpenChange={setEmailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>📧 Send Custom Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>To Email</Label>
              <Input
                placeholder="user@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                placeholder="Email subject..."
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                placeholder="Email content (supports plain text, newlines will be converted to HTML)..."
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailModal(false)}>Cancel</Button>
            <Button
              onClick={() => sendEmail.mutate()}
              disabled={sendEmail.isPending || !emailTo || !emailSubject || !emailBody}
            >
              {sendEmail.isPending ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
