import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lock, Unlock, FileText, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface DeliverVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  onSuccess: () => void;
}

interface UnpaidInvoice {
  id: string;
  invoice_number: string | null;
  amount: number;
  status: string;
}

export function DeliverVideoModal({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  onSuccess,
}: DeliverVideoModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLocked, setIsLocked] = useState(false);
  const [invoiceMode, setInvoiceMode] = useState<'new' | 'existing'>('new');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch unpaid invoices for this project
  useEffect(() => {
    if (!open || !projectId) return;

    const fetchInvoices = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount, status')
        .eq('project_id', projectId)
        .in('status', ['unpaid', 'pending', 'overdue']);
      
      setUnpaidInvoices(data || []);
      setLoading(false);
    };

    fetchInvoices();
  }, [open, projectId]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setIsLocked(false);
      setInvoiceMode('new');
      setSelectedInvoiceId(null);
      setInvoiceAmount('');
      setInvoiceDueDate('');
      setInvoiceNotes('');
    }
  }, [open]);

  const handleDeliver = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // 1. Get project details for agency_id and client_id
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('agency_id, client_id')
        .eq('id', projectId)
        .single();

      if (projectError || !project) throw new Error('Failed to fetch project');

      let linkedInvoiceId: string | null = null;

      // 2. If locked, handle invoice creation/linking
      if (isLocked) {
        if (invoiceMode === 'existing' && selectedInvoiceId) {
          linkedInvoiceId = selectedInvoiceId;
        } else if (invoiceMode === 'new' && invoiceAmount) {
          // Generate invoice number
          const { data: invoiceNumData } = await supabase
            .rpc('generate_invoice_number', { _agency_id: project.agency_id });

          const amount = parseFloat(invoiceAmount);

          // Create new invoice
          const { data: newInvoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert({
              project_id: projectId,
              agency_id: project.agency_id,
              client_id: project.client_id!,
              amount,
              subtotal: amount,
              invoice_number: invoiceNumData || null,
              due_date: invoiceDueDate || null,
              notes: invoiceNotes || null,
              status: 'unpaid',
            })
            .select('id')
            .single();

          if (invoiceError) throw invoiceError;
          linkedInvoiceId = newInvoice.id;
        }

        // 3. Lock all deliverables in this project and link to invoice
        const updateData: Record<string, any> = { is_locked: true };
        if (linkedInvoiceId) {
          updateData.linked_invoice_id = linkedInvoiceId;
        }

        const { error: lockError } = await supabase
          .from('deliverables')
          .update(updateData)
          .eq('project_id', projectId)
          .eq('file_type', 'deliverable');

        if (lockError) throw lockError;
      }

      // 4. Move project to 'review' status (client can now see and comment)
      const { error: statusError } = await supabase
        .from('projects')
        .update({ status: 'review' })
        .eq('id', projectId);

      if (statusError) throw statusError;

      toast({
        title: 'Video delivered',
        description: isLocked
          ? 'Video delivered and locked. Client must pay to download.'
          : 'Video delivered to client successfully.',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error delivering video:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to deliver video',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send to Review</DialogTitle>
          <DialogDescription>
            Moving "{projectTitle}" from Quality Check to Review. Client will be able to view and comment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Lock Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              {isLocked ? (
                <Lock className="w-5 h-5 text-warning" />
              ) : (
                <Unlock className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-sm">Lock video downloads</p>
                <p className="text-xs text-muted-foreground">
                  Client can view but not download until invoice is paid
                </p>
              </div>
            </div>
            <Switch checked={isLocked} onCheckedChange={setIsLocked} />
          </div>

          {/* Invoice Section (only when locked) */}
          {isLocked && (
            <div className="space-y-4 p-4 rounded-lg border border-border">
              <Label className="text-sm font-medium">Link Invoice</Label>

              {/* Toggle between new and existing */}
              <div className="flex gap-2">
                <Button
                  variant={invoiceMode === 'new' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setInvoiceMode('new')}
                  className="flex-1"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  New Invoice
                </Button>
                <Button
                  variant={invoiceMode === 'existing' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setInvoiceMode('existing')}
                  className="flex-1"
                  disabled={unpaidInvoices.length === 0}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Existing ({unpaidInvoices.length})
                </Button>
              </div>

              {invoiceMode === 'new' ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Amount ($)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={invoiceAmount}
                      onChange={(e) => setInvoiceAmount(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Due Date (optional)</Label>
                    <Input
                      type="date"
                      value={invoiceDueDate}
                      onChange={(e) => setInvoiceDueDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Notes (optional)</Label>
                    <Textarea
                      placeholder="Invoice notes..."
                      value={invoiceNotes}
                      onChange={(e) => setInvoiceNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : unpaidInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No unpaid invoices found
                    </p>
                  ) : (
                    unpaidInvoices.map((inv) => (
                      <button
                        key={inv.id}
                        onClick={() => setSelectedInvoiceId(inv.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                          selectedInvoiceId === inv.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/30'
                        }`}
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {inv.invoice_number || 'No number'}
                          </p>
                          <Badge variant="outline" className="text-[10px]">
                            {inv.status}
                          </Badge>
                        </div>
                        <span className="font-semibold text-sm">
                          ${inv.amount.toLocaleString()}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeliver}
            disabled={isSubmitting || (isLocked && invoiceMode === 'new' && !invoiceAmount)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Delivering...
              </>
            ) : (
              <>
                {isLocked ? <Lock className="w-4 h-4 mr-2" /> : null}
                Deliver {isLocked ? '& Lock' : 'Video'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
