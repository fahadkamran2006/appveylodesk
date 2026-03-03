import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Link2, ExternalLink, Loader2, Trash2, Eye, MessageSquare, Download, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

interface GenerateReviewLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliverableId: string;
  deliverableName: string;
}

export function GenerateReviewLinkModal({
  open,
  onOpenChange,
  deliverableId,
  deliverableName,
}: GenerateReviewLinkModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [existingLink, setExistingLink] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);

  // Form state
  const [allowComments, setAllowComments] = useState(true);
  const [allowApproval, setAllowApproval] = useState(false);
  const [allowDownload, setAllowDownload] = useState(false);
  const [expiryOption, setExpiryOption] = useState('7d');
  const [customDays, setCustomDays] = useState('30');

  // Fetch existing link
  useEffect(() => {
    if (!open || !deliverableId) return;
    setLoading(true);
    supabase
      .from('public_review_links')
      .select('*')
      .eq('deliverable_id', deliverableId)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        setExistingLink(data);
        setLoading(false);
      });
  }, [open, deliverableId]);

  const getReviewUrl = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/review/${token}`;
  };

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);

    try {
      // Deactivate any existing links
      await supabase
        .from('public_review_links')
        .update({ is_active: false })
        .eq('deliverable_id', deliverableId);

      // Calculate expiry
      let expires_at: string | null = null;
      if (expiryOption !== 'never') {
        const days = expiryOption === 'custom' ? parseInt(customDays) || 7 : parseInt(expiryOption);
        const date = new Date();
        date.setDate(date.getDate() + days);
        expires_at = date.toISOString();
      }

      const { data, error } = await supabase
        .from('public_review_links')
        .insert({
          deliverable_id: deliverableId,
          created_by: user.id,
          allow_approval: allowApproval,
          allow_comments: allowComments,
          allow_download: allowDownload,
          expires_at,
        })
        .select()
        .single();

      if (error) throw error;
      setExistingLink(data);

      toast({ title: 'Review link created', description: 'Share it with your client for feedback' });
    } catch (err: any) {
      toast({ title: 'Failed to create link', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!existingLink) return;
    await navigator.clipboard.writeText(getReviewUrl(existingLink.token));
    setCopied(true);
    toast({ title: 'Link copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!existingLink) return;
    setRevoking(true);
    try {
      await supabase
        .from('public_review_links')
        .update({ is_active: false })
        .eq('id', existingLink.id);
      setExistingLink(null);
      toast({ title: 'Review link revoked' });
    } catch (err: any) {
      toast({ title: 'Failed to revoke', description: err.message, variant: 'destructive' });
    } finally {
      setRevoking(false);
    }
  };

  const isExpired = existingLink?.expires_at && new Date(existingLink.expires_at) < new Date();

  const permissionItems = [
    { key: 'view', label: 'View Video', description: 'Always enabled', icon: Eye, enabled: true, locked: true },
    { key: 'comments', label: 'Leave Comments', description: 'Reviewer can add time-stamped feedback', icon: MessageSquare, enabled: existingLink ? existingLink.allow_comments : allowComments },
    { key: 'download', label: 'Download Video', description: 'Reviewer can download the file', icon: Download, enabled: existingLink ? existingLink.allow_download : allowDownload },
    { key: 'approval', label: 'Approve / Reject', description: 'Reviewer can approve or request revision', icon: ShieldCheck, enabled: existingLink ? existingLink.allow_approval : allowApproval },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Share Review Link
          </DialogTitle>
          <DialogDescription>
            Share "{deliverableName}" for external review — no account needed.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : existingLink && !isExpired ? (
          <div className="space-y-4">
            {/* Active link display */}
            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  Active
                </Badge>
                {existingLink.expires_at && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    Expires {format(new Date(existingLink.expires_at), 'MMM d, yyyy')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={getReviewUrl(existingLink.token)}
                  className="text-xs bg-background"
                />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => window.open(getReviewUrl(existingLink.token), '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Permissions summary */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {permissionItems.map(item => (
                  <div key={item.key} className={`flex items-center gap-2 p-2 rounded-md border text-xs ${item.enabled ? 'border-primary/20 bg-primary/5 text-foreground' : 'border-border bg-muted/30 text-muted-foreground'}`}>
                    <item.icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    {item.enabled && <Check className="w-3 h-3 ml-auto text-primary" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Revoke */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevoke}
              disabled={revoking}
              className="w-full text-destructive hover:text-destructive"
            >
              {revoking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Revoke & Regenerate
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {isExpired && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                Previous review link has expired. Generate a new one below.
              </div>
            )}

            {/* Permissions */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Reviewer Permissions</Label>
              
              {/* View - always on */}
              <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">View Video</p>
                    <p className="text-xs text-muted-foreground">Always enabled</p>
                  </div>
                </div>
                <Switch checked disabled />
              </div>

              {/* Comments */}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Leave Comments</p>
                    <p className="text-xs text-muted-foreground">Time-stamped feedback</p>
                  </div>
                </div>
                <Switch checked={allowComments} onCheckedChange={setAllowComments} />
              </div>

              {/* Download */}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Download Video</p>
                    <p className="text-xs text-muted-foreground">Allow file download</p>
                  </div>
                </div>
                <Switch checked={allowDownload} onCheckedChange={setAllowDownload} />
              </div>

              {/* Approval */}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Approve / Reject</p>
                    <p className="text-xs text-muted-foreground">Approve or request revision</p>
                  </div>
                </div>
                <Switch checked={allowApproval} onCheckedChange={setAllowApproval} />
              </div>
            </div>

            <Separator />

            {/* Expiry */}
            <div className="space-y-2">
              <Label>Link expires after</Label>
              <Select value={expiryOption} onValueChange={setExpiryOption}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
              {expiryOption === 'custom' && (
                <Input
                  type="number"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  placeholder="Days"
                  min={1}
                  max={365}
                />
              )}
            </div>

            <Button onClick={handleGenerate} disabled={generating} className="w-full">
              {generating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Link2 className="w-4 h-4 mr-2" /> Generate Review Link</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
