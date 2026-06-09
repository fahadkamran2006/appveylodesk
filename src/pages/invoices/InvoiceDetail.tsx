import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { generateInvoicePDF, downloadInvoicePDF } from '@/lib/generateInvoicePDF';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  Download, 
  Upload, 
  ExternalLink, 
  CheckCircle2, 
  Clock,
  Building2,
  User,
  Calendar,
  Receipt,
  Loader2,
  FileDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  sort_order: number;
}

interface Invoice {
  id: string;
  invoice_number: string | null;
  amount: number;
  subtotal: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  status: string;
  due_date: string | null;
  created_at: string;
  paid_at: string | null;
  payment_proof_url: string | null;
  payment_link: string | null;
  notes: string | null;
  project: { id: string; title: string } | null;
  container: { id: string; title: string } | null;
  client: { id: string; full_name: string | null; email: string } | null;
  agency: { 
    id: string; 
    name: string; 
    logo_url: string | null; 
    branding: any;
    business_name: string | null;
    business_address: string | null;
    tax_id: string | null;
    invoice_footer: string | null;
  } | null;
  payment_method: { id: string; name: string; details: string; payment_link: string | null } | null;
}

const InvoiceDetailPage = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/login');
    }
  }, [user, authLoading, navigate]);

  const fetchInvoice = useCallback(async () => {
    if (!invoiceId || !user) return;

    try {
      // Fetch invoice with related data
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          subtotal,
          tax_rate,
          tax_amount,
          status,
          due_date,
          created_at,
          paid_at,
          payment_proof_url,
          payment_link,
          notes,
          client_id,
          agency_id,
          payment_method_id,
          project:projects(id, title)
        `)
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      // Fetch client profile
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', invoiceData.client_id)
        .single();

      // Fetch agency
      const { data: agencyData } = await supabase
        .from('agencies')
        .select('id, name, logo_url, branding, business_name, business_address, tax_id, invoice_footer')
        .eq('id', invoiceData.agency_id)
        .single();

      // Fetch payment method if exists
      let paymentMethodData = null;
      if (invoiceData.payment_method_id) {
        const { data: pmData } = await supabase
          .from('payment_methods')
          .select('id, name, details, payment_link')
          .eq('id', invoiceData.payment_method_id)
          .single();
        paymentMethodData = pmData;
      }

      // Fetch line items
      const { data: itemsData, error: itemsError } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sort_order', { ascending: true });

      if (itemsError) throw itemsError;

      setInvoice({
        ...invoiceData,
        client: clientProfile,
        agency: agencyData,
        payment_method: paymentMethodData,
      } as Invoice);
      setLineItems(itemsData || []);
    } catch (error) {
      console.error('Error fetching invoice:', error);
      toast({
        title: 'Error loading invoice',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [invoiceId, user, toast]);

  useEffect(() => {
    if (user) {
      fetchInvoice();
    }
  }, [user, fetchInvoice]);

  const handleUploadProof = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!invoice || !user) return;

    const formData = new FormData(e.currentTarget);
    const file = formData.get('proof') as File;

    if (!file || file.size === 0) {
      toast({
        title: 'No file selected',
        description: 'Please select a file to upload.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${invoice.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment_proofs')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          payment_proof_url: filePath,
          status: 'pending',
        })
        .eq('id', invoice.id);

      if (updateError) throw updateError;

      toast({
        title: 'Payment proof uploaded',
        description: 'Your payment is being reviewed by the team.',
      });

      setUploadModalOpen(false);
      fetchInvoice();
    } catch (error: any) {
      console.error('Error uploading:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;
    
    setDownloadingPdf(true);
    try {
      const pdfBlob = await generateInvoicePDF({
        invoice: {
          invoice_number: invoice.invoice_number,
          amount: invoice.amount,
          subtotal: invoice.subtotal,
          tax_rate: invoice.tax_rate,
          tax_amount: invoice.tax_amount,
          due_date: invoice.due_date,
          created_at: invoice.created_at,
          notes: invoice.notes,
        },
        agency: {
          name: invoice.agency?.name || 'Agency',
          logo_url: invoice.agency?.logo_url || null,
          business_name: invoice.agency?.business_name || null,
          business_address: invoice.agency?.business_address || null,
          tax_id: invoice.agency?.tax_id || null,
          invoice_footer: invoice.agency?.invoice_footer || null,
        },
        client: {
          full_name: invoice.client?.full_name || null,
          email: invoice.client?.email || '',
        },
        project: invoice.project ? { title: invoice.project.title } : null,
        paymentMethod: invoice.payment_method ? {
          name: invoice.payment_method.name,
          details: invoice.payment_method.details,
        } : null,
        lineItems: lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
        })),
      });

      downloadInvoicePDF(pdfBlob, invoice.invoice_number);
      
      toast({
        title: 'PDF Downloaded',
        description: 'Invoice PDF has been saved to your device.',
      });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const paymentLink = invoice?.payment_link || invoice?.payment_method?.payment_link;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading invoice...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Invoice not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const isClient = userRole === 'client' || invoice.client?.id === user?.id;

  return (
    <>
      <Helmet>
        <title>{invoice.invoice_number || 'Invoice'} | Veylodesk</title>
      </Helmet>

      <div className="min-h-screen bg-muted/30 p-4 md:p-8">
        {/* Header */}
        <div className="max-w-4xl mx-auto mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Invoice Document */}
        <div className="max-w-4xl mx-auto bg-background rounded-xl shadow-lg border border-border overflow-hidden">
          {/* Invoice Header */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 md:p-8 border-b border-border">
            <div className="flex flex-col md:flex-row justify-between gap-6">
              {/* Agency Info */}
              <div className="flex items-start gap-4">
                {invoice.agency?.logo_url ? (
                  <img
                    src={invoice.agency.logo_url}
                    alt={invoice.agency.name}
                    className="w-16 h-16 rounded-lg object-contain bg-background"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-primary" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold text-foreground">{invoice.agency?.name}</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {invoice.project?.title}
                  </p>
                </div>
              </div>

              {/* Invoice Meta */}
              <div className="text-right">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-background border border-border">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      invoice.status === 'paid' && 'bg-success',
                      invoice.status === 'pending' && 'bg-warning',
                      invoice.status === 'unpaid' && 'bg-destructive'
                    )}
                  />
                  {invoice.status === 'paid'
                    ? 'Paid'
                    : invoice.status === 'pending'
                    ? 'Pending Review'
                    : 'Unpaid'}
                </div>
                <p className="text-2xl font-bold text-foreground mt-3">
                  {invoice.invoice_number || 'INVOICE'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Issued: {new Date(invoice.created_at).toLocaleDateString()}
                </p>
                {invoice.due_date && (
                  <p className="text-sm text-muted-foreground">
                    Due: {new Date(invoice.due_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div className="p-6 md:p-8 border-b border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <User className="w-4 h-4" />
              Bill To
            </div>
            <p className="font-medium text-foreground">
              {invoice.client?.full_name || invoice.client?.email}
            </p>
            {invoice.client?.email && invoice.client?.full_name && (
              <p className="text-sm text-muted-foreground">{invoice.client.email}</p>
            )}
          </div>

          {/* Line Items */}
          <div className="p-6 md:p-8">
            {lineItems.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b border-border">
                    <th className="pb-3 font-medium">Description</th>
                    <th className="pb-3 font-medium text-center">Qty</th>
                    <th className="pb-3 font-medium text-right">Rate</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {lineItems.map((item) => (
                    <tr key={item.id}>
                      <td className="py-4 text-foreground">{item.description}</td>
                      <td className="py-4 text-center text-muted-foreground">{item.quantity}</td>
                      <td className="py-4 text-right text-muted-foreground">
                        ${Number(item.rate).toFixed(2)}
                      </td>
                      <td className="py-4 text-right font-medium text-foreground">
                        ${Number(item.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No line items (legacy invoice)</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  Total: ${invoice.amount.toLocaleString()}
                </p>
              </div>
            )}

            {/* Totals */}
            {lineItems.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${Number(invoice.subtotal || 0).toFixed(2)}</span>
                    </div>
                    {Number(invoice.tax_rate) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Tax ({invoice.tax_rate}%)
                        </span>
                        <span>${Number(invoice.tax_amount || 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                      <span>Total</span>
                      <span>${Number(invoice.amount).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Method & Notes */}
          {(invoice.payment_method || invoice.notes) && (
            <div className="p-6 md:p-8 bg-muted/30 border-t border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {invoice.payment_method && (
                  <div>
                    <h3 className="font-medium text-foreground mb-2">
                      Payment Method: {invoice.payment_method.name}
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {invoice.payment_method.details}
                    </p>
                  </div>
                )}
                {invoice.notes && (
                  <div>
                    <h3 className="font-medium text-foreground mb-2">Notes</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {invoice.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="p-6 md:p-8 border-t border-border bg-background">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
              {/* Status Info */}
              <div className="flex items-center gap-2 text-sm">
                {invoice.status === 'paid' && (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-success" />
                    <span className="text-success font-medium">
                      Paid on {new Date(invoice.paid_at!).toLocaleDateString()}
                    </span>
                  </>
                )}
                {invoice.status === 'pending' && (
                  <>
                    <Clock className="w-5 h-5 text-warning" />
                    <span className="text-warning font-medium">Payment under review</span>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                {/* Download PDF Button - Always visible */}
                <Button 
                  variant="outline" 
                  onClick={handleDownloadPDF}
                  disabled={downloadingPdf}
                >
                  {downloadingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4 mr-2" />
                      Download PDF
                    </>
                  )}
                </Button>
                
                {paymentLink && invoice.status === 'unpaid' && (
                  <Button
                    variant="hero"
                    onClick={() => window.open(paymentLink, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Pay Now
                  </Button>
                )}
                {isClient && invoice.status === 'unpaid' && (
                  <Button variant="outline" onClick={() => setUploadModalOpen(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Payment Proof
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Payment Proof Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Payment Proof</DialogTitle>
            <DialogDescription>
              Upload a screenshot or document showing your payment of ${invoice.amount.toLocaleString()}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUploadProof} className="space-y-4">
            <div>
              <Label htmlFor="proof">Payment Proof (Screenshot/PDF)</Label>
              <Input
                id="proof"
                name="proof"
                type="file"
                accept="image/*,.pdf"
                className="mt-2"
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setUploadModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Submit Payment Proof'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InvoiceDetailPage;
