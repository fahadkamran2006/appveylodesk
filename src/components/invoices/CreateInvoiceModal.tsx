import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePaymentMethods, PaymentMethod } from '@/hooks/usePaymentMethods';
import { useToast } from '@/hooks/use-toast';
import { generateInvoicePDF } from '@/lib/generateInvoicePDF';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  title: string;
  client_id: string | null;
  client: { id: string; full_name: string | null; email: string } | null;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface CreateInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  onSuccess: () => void;
}

export const CreateInvoiceModal = ({
  open,
  onOpenChange,
  projects,
  onSuccess,
}: CreateInvoiceModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { methods: paymentMethods, loading: methodsLoading, getDefaultMethod } = usePaymentMethods();
  
  const [creating, setCreating] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, rate: 0, amount: 0 },
  ]);

  // Set default payment method when loaded
  useEffect(() => {
    if (!methodsLoading && paymentMethods.length > 0 && !selectedPaymentMethod) {
      const defaultMethod = getDefaultMethod();
      if (defaultMethod) {
        setSelectedPaymentMethod(defaultMethod.id);
        setPaymentLink(defaultMethod.payment_link || '');
      }
    }
  }, [methodsLoading, paymentMethods, selectedPaymentMethod, getDefaultMethod]);

  // Update payment link when method changes
  const handlePaymentMethodChange = (methodId: string) => {
    setSelectedPaymentMethod(methodId);
    const method = paymentMethods.find((m) => m.id === methodId);
    if (method) {
      setPaymentLink(method.payment_link || '');
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), description: '', quantity: 1, rate: 0, amount: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id !== id) return item;
        
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'rate') {
          updated.amount = Number(updated.quantity) * Number(updated.rate);
        }
        return updated;
      })
    );
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = subtotal * (Number(taxRate) / 100);
  const total = subtotal + taxAmount;

  const resetForm = () => {
    setSelectedProject('');
    setSelectedPaymentMethod('');
    setPaymentLink('');
    setDueDate('');
    setTaxRate('0');
    setNotes('');
    setLineItems([{ id: crypto.randomUUID(), description: '', quantity: 1, rate: 0, amount: 0 }]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProject || lineItems.every((item) => !item.description)) return;

    const validLineItems = lineItems.filter((item) => item.description && item.amount > 0);
    if (validLineItems.length === 0) {
      toast({
        title: 'No valid line items',
        description: 'Please add at least one line item with description and amount.',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const project = projects.find((p) => p.id === selectedProject);
      if (!project || !project.client_id) {
        throw new Error('Project has no client assigned');
      }

      const { data: agencyId } = await supabase.rpc('get_user_agency_id', { _user_id: user.id });

      // Fetch agency data for PDF generation
      const { data: agencyData } = await supabase
        .from('agencies')
        .select('id, name, logo_url, business_name, business_address, tax_id, invoice_footer')
        .eq('id', agencyId)
        .single();

      // Fetch client profile for PDF generation
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', project.client_id)
        .single();

      // Fetch payment method details if selected
      let paymentMethodData = null;
      if (selectedPaymentMethod) {
        const { data: pmData } = await supabase
          .from('payment_methods')
          .select('id, name, details, payment_link')
          .eq('id', selectedPaymentMethod)
          .single();
        paymentMethodData = pmData;
      }

      // Generate invoice number
      const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number', {
        _agency_id: agencyId,
      });

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          project_id: selectedProject,
          client_id: project.client_id,
          agency_id: agencyId,
          amount: total,
          subtotal: subtotal,
          tax_rate: Number(taxRate),
          tax_amount: taxAmount,
          payment_method_id: selectedPaymentMethod || null,
          payment_link: paymentLink || null,
          due_date: dueDate || null,
          notes: notes || null,
          invoice_number: invoiceNumber,
          status: 'unpaid',
        })
        .select('id, created_at')
        .single();

      if (invoiceError) throw invoiceError;

      // Create line items
      const lineItemsToInsert = validLineItems.map((item, index) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
        sort_order: index,
      }));

      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .insert(lineItemsToInsert);

      if (lineItemsError) throw lineItemsError;

      // Generate PDF for email attachment
      let pdfBase64: string | undefined;
      try {
        const pdfBlob = await generateInvoicePDF({
          invoice: {
            invoice_number: invoiceNumber,
            amount: total,
            subtotal: subtotal,
            tax_rate: Number(taxRate),
            tax_amount: taxAmount,
            due_date: dueDate || null,
            created_at: invoice.created_at,
            notes: notes || null,
          },
          agency: {
            name: agencyData?.name || 'Agency',
            logo_url: agencyData?.logo_url || null,
            business_name: agencyData?.business_name || null,
            business_address: agencyData?.business_address || null,
            tax_id: agencyData?.tax_id || null,
            invoice_footer: agencyData?.invoice_footer || null,
          },
          client: {
            full_name: clientProfile?.full_name || null,
            email: clientProfile?.email || '',
          },
          project: { title: project.title },
          paymentMethod: paymentMethodData ? {
            name: paymentMethodData.name,
            details: paymentMethodData.details,
          } : null,
          lineItems: validLineItems.map(item => ({
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
          })),
        });

        // Convert blob to base64
        const reader = new FileReader();
        pdfBase64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(pdfBlob);
        });
      } catch (pdfError) {
        console.error('Failed to generate PDF:', pdfError);
        // Continue without PDF attachment
      }

      // Send invoice email notification with PDF attachment
      try {
        await supabase.functions.invoke('send-invoice-email', {
          body: { 
            invoice_id: invoice.id,
            pdf_base64: pdfBase64,
          },
        });
      } catch (emailError) {
        console.error('Failed to send invoice email:', emailError);
        // Don't fail the entire operation if email fails
      }

      toast({
        title: 'Invoice created',
        description: `Invoice ${invoiceNumber} has been sent to the client.`,
      });

      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast({
        title: 'Failed to create invoice',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Create a professional invoice with line items for a client project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-6">
          {/* Project Selection */}
          <div>
            <Label>Project</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title} - {project.client?.full_name || project.client?.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                <div className="col-span-5">Description</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-2 text-center">Rate</div>
                <div className="col-span-2 text-right">Amount</div>
                <div className="col-span-1"></div>
              </div>

              {/* Items */}
              {lineItems.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Input
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, 'quantity', Number(e.target.value))}
                      className="text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) => updateLineItem(item.id, 'rate', Number(e.target.value))}
                      className="text-center"
                    />
                  </div>
                  <div className="col-span-2 text-right font-medium">
                    ${item.amount.toFixed(2)}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLineItem(item.id)}
                      disabled={lineItems.length === 1}
                      className="h-8 w-8"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm gap-4">
                <span className="text-muted-foreground">Tax (%)</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-20 h-8 text-center"
                />
                <span className="font-medium">${taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Payment Method</Label>
              {paymentMethods.length === 0 ? (
                <div className="mt-2 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                  <p className="text-sm text-warning">
                    No payment methods configured. Add one in Settings.
                  </p>
                </div>
              ) : (
                <Select value={selectedPaymentMethod} onValueChange={handlePaymentMethodChange}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label htmlFor="dueDate">Due Date (Optional)</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          {/* Payment Link Override */}
          <div>
            <Label htmlFor="paymentLink">Payment Link (Optional)</Label>
            <Input
              id="paymentLink"
              type="url"
              value={paymentLink}
              onChange={(e) => setPaymentLink(e.target.value)}
              placeholder="https://pay.example.com/..."
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Override the default payment link for this invoice
            </p>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for the client..."
              className="mt-2"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={creating || !selectedProject || lineItems.every((i) => !i.description)}
            >
              {creating ? 'Creating...' : 'Create & Send Invoice'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
