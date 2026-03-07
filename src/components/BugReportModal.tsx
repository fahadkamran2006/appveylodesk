import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Bug, Lightbulb, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

export function BugReportModal() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"bug" | "suggestion">("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !title.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("bug_reports" as any).insert({
        user_id: user.id,
        agency_id: profile?.agency_id ?? null,
        type,
        title: title.trim(),
        description: description.trim(),
        priority,
      } as any);
      if (error) throw error;

      // Send email notification to super admin
      try {
        await supabase.functions.invoke("super-admin-actions", {
          body: {
            action: "send_custom_email",
            to_email: "m.fahadkamran0001@gmail.com",
            subject: `[Veylodesk ${type === "bug" ? "Bug" : "Suggestion"}] ${title.trim()}`,
            html_body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px;">
                <h2 style="color: #1a1a2e;">${type === "bug" ? "🐛 Bug Report" : "💡 Suggestion"}</h2>
                <p><strong>Title:</strong> ${title.trim()}</p>
                <p><strong>Description:</strong> ${description.trim()}</p>
                ${type === "bug" ? `<p><strong>Priority:</strong> ${priority}</p>` : ""}
                <p><strong>Reported by:</strong> ${user.email}</p>
                <p><strong>Agency:</strong> ${profile?.agency_id || "N/A"}</p>
                <hr style="border: none; border-top: 1px solid #eee;" />
                <p style="color: #888; font-size: 12px;">View in Super Admin → Bug Reports tab</p>
              </div>
            `,
          },
        });
      } catch (emailErr) {
        console.warn("Failed to send bug report email:", emailErr);
      }
      toast.success("Thank you! Your report has been submitted.");
      setOpen(false);
      setTitle("");
      setDescription("");
      setType("bug");
      setPriority("medium");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <Bug className="w-4 h-4" />
          <span className="hidden sm:inline">Report</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "bug" ? <Bug className="w-5 h-5 text-destructive" /> : <Lightbulb className="w-5 h-5 text-amber-400" />}
            {type === "bug" ? "Report a Bug" : "Make a Suggestion"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex gap-2">
            <Button
              variant={type === "bug" ? "default" : "outline"}
              size="sm"
              onClick={() => setType("bug")}
              className="gap-1.5"
            >
              <Bug className="w-3.5 h-3.5" /> Bug
            </Button>
            <Button
              variant={type === "suggestion" ? "default" : "outline"}
              size="sm"
              onClick={() => setType("suggestion")}
              className="gap-1.5"
            >
              <Lightbulb className="w-3.5 h-3.5" /> Suggestion
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder={type === "bug" ? "Brief description of the issue" : "Your idea in a few words"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder={type === "bug" ? "Steps to reproduce, what happened vs. expected..." : "Describe your suggestion in detail..."}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {type === "bug" && (
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !description.trim()}
            className="w-full gap-2"
          >
            <Send className="w-4 h-4" />
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
