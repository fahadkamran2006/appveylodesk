import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Receipt, Upload, Clock, CheckCircle2, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Invoice {
  id: string;
  amount: number;
  status: string;
  due_date: string | null;
  created_at: string;
  payment_proof_url: string | null;
  project: { id: string; title: string } | null;
  container: { id: string; title: string } | null;
}

const ClientInvoices = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [uploading, setUploading] = useState(false);

  // Allow admin god mode
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'client' && userRole !== 'admin') {
      navigate('/editor/dashboard');
    }
  }, [user, userRole, loading, navigate]);

  const fetchInvoices = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          amount,
          status,
          due_date,
          created_at,
          payment_proof_url,
          project:projects(id, title),
          container:project_containers(id, title)
        `)
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: "Error loading invoices",
        description: "Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user && (userRole === 'client' || userRole === 'admin')) {
      fetchInvoices();
    }
  }, [user, userRole, fetchInvoices]);

  const handleUploadProof = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedInvoice || !user) return;

    const formData = new FormData(e.currentTarget);
    const file = formData.get('proof') as File;
    
    if (!file || file.size === 0) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${selectedInvoice.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment_proofs')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Update invoice with proof URL and status
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ 
          payment_proof_url: filePath,
          status: 'pending' 
        })
        .eq('id', selectedInvoice.id);

      if (updateError) throw updateError;

      toast({
        title: "Payment proof uploaded",
        description: "Your payment is being reviewed by the team.",
      });
      
      setUploadModalOpen(false);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (error: any) {
      console.error('Error uploading:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const stats = {
    total: invoices.reduce((sum, inv) => sum + inv.amount, 0),
    unpaid: invoices.filter(i => i.status === 'unpaid').reduce((sum, inv) => sum + inv.amount, 0),
    pending: invoices.filter(i => i.status === 'pending').length,
    paid: invoices.filter(i => i.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0),
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>My Invoices | Veylodesk</title>
        <meta name="description" content="View and pay your invoices." />
      </Helmet>

      <DashboardLayout role="client">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">My Invoices</h1>
            <p className="text-muted-foreground">View and pay your project invoices.</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Billed</p>
                  <p className="text-2xl font-bold text-foreground">${stats.total.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-2xl font-bold text-foreground">${stats.unpaid.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-2xl font-bold text-foreground">${stats.paid.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Invoices List */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">All Invoices</h2>
            
            {invoices.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No invoices yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {invoices.map((invoice) => (
                  <div 
                    key={invoice.id} 
                    className="p-4 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {invoice.container?.title || invoice.project?.title || 'Project'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.due_date 
                          ? `Due ${new Date(invoice.due_date).toLocaleDateString()}` 
                          : `Created ${new Date(invoice.created_at).toLocaleDateString()}`
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-bold text-foreground">
                        ${invoice.amount.toLocaleString()}
                      </span>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium",
                        invoice.status === 'paid' && "bg-success/10 text-success border border-success/20",
                        invoice.status === 'pending' && "bg-warning/10 text-warning border border-warning/20",
                        invoice.status === 'unpaid' && "bg-destructive/10 text-destructive border border-destructive/20"
                      )}>
                        {invoice.status === 'paid' 
                          ? 'Paid' 
                          : invoice.status === 'pending' 
                          ? 'Pending Review' 
                          : 'Unpaid'
                        }
                      </span>
                      {invoice.status === 'unpaid' && (
                        <Button 
                          variant="hero" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvoice(invoice);
                            setUploadModalOpen(true);
                          }}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Pay Now
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
      </DashboardLayout>

      {/* Upload Payment Proof Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Payment Proof</DialogTitle>
            <DialogDescription>
              Upload a screenshot or document showing your payment of ${selectedInvoice?.amount.toLocaleString()} for {selectedInvoice?.container?.title || selectedInvoice?.project?.title}.
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
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setUploadModalOpen(false)}
              >
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

export default ClientInvoices;