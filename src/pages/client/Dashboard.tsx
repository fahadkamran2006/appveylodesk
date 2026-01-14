import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
import { Button } from '@/components/ui/button';
import { Clock, Download, FolderKanban, Receipt, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Project {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
}

interface Invoice {
  id: string;
  amount: number;
  status: string;
  due_date: string | null;
  project: { title: string } | null;
}

const ClientDashboard = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [uploading, setUploading] = useState(false);

  // Allow admin god mode - only redirect non-admins away
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    // Allow admins to view this page for testing
    if (!loading && userRole && userRole !== 'client' && userRole !== 'admin') {
      navigate('/editor/dashboard');
    }
  }, [user, userRole, loading, navigate]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch projects where client_id matches user
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, title, status, due_date')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

      // Fetch invoices for this client
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, amount, status, due_date, project:projects(title)')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error loading data",
        description: "Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  }, [user, toast]);

  useEffect(() => {
    // Allow admins to test the client dashboard
    if (user && (userRole === 'client' || userRole === 'admin')) {
      fetchData();
    }
  }, [user, userRole, fetchData]);

  const handleUploadPaymentProof = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedInvoice) return;

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
      // Update invoice with payment proof URL (in production, upload file to storage first)
      const { error } = await supabase
        .from('invoices')
        .update({ 
          payment_proof_url: `payment-proof-${selectedInvoice.id}` 
        })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      toast({
        title: "Payment proof uploaded",
        description: "Your payment is being reviewed.",
      });
      
      setUploadModalOpen(false);
      setSelectedInvoice(null);
      fetchData();
    } catch (error) {
      console.error('Error uploading:', error);
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      backlog: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
      in_progress: { label: 'In Progress', className: 'bg-primary/10 text-primary border border-primary/20' },
      review: { label: 'In Review', className: 'bg-warning/10 text-warning border border-warning/20' },
      done: { label: 'Delivered', className: 'bg-success/10 text-success border border-success/20' },
    };
    return statusMap[status] || { label: status, className: 'bg-muted text-muted-foreground' };
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
        <title>Client Dashboard | Veylodesk</title>
        <meta name="description" content="View your projects and manage invoices." />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        <CollapsibleSidebar role="client" />

        <main className="flex-1 p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="text-muted-foreground">Track your projects and manage invoices.</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderKanban className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Projects</p>
                  <p className="text-2xl font-bold text-foreground">
                    {projects.filter(p => p.status !== 'done').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <Download className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivered</p>
                  <p className="text-2xl font-bold text-foreground">
                    {projects.filter(p => p.status === 'done').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unpaid Invoices</p>
                  <p className="text-2xl font-bold text-foreground">
                    {invoices.filter(i => i.status === 'unpaid').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Soon</p>
                  <p className="text-2xl font-bold text-foreground">
                    {projects.filter(p => {
                      if (!p.due_date) return false;
                      const dueDate = new Date(p.due_date);
                      const now = new Date();
                      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      return diffDays <= 7 && diffDays >= 0 && p.status !== 'done';
                    }).length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Projects - No editor info shown */}
          <div className="glass-card rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-6">Your Projects</h2>
            {projects.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No projects yet.</p>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => {
                  const statusInfo = getStatusDisplay(project.status);
                  return (
                    <div key={project.id} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-foreground">{project.title}</h3>
                          {project.due_date && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Due {new Date(project.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.className}`}>
                            {statusInfo.label}
                          </span>
                          {project.status === 'done' && (
                            <Button variant="outline" size="sm">
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Invoices */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Invoices</h2>
            {invoices.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No invoices yet.</p>
            ) : (
              <div className="space-y-4">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="p-4 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{invoice.project?.title || 'Project'}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.due_date && `Due ${new Date(invoice.due_date).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-foreground">
                        ${invoice.amount.toLocaleString()}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        invoice.status === 'paid'
                          ? 'bg-success/10 text-success border border-success/20'
                          : invoice.status === 'pending'
                          ? 'bg-warning/10 text-warning border border-warning/20'
                          : 'bg-destructive/10 text-destructive border border-destructive/20'
                      }`}>
                        {invoice.status === 'paid' ? 'Paid' : invoice.status === 'pending' ? 'Pending Review' : 'Unpaid'}
                      </span>
                      {invoice.status === 'unpaid' && (
                        <Button 
                          variant="hero" 
                          size="sm"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setUploadModalOpen(true);
                          }}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Mark as Paid
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Upload Payment Proof Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Payment Proof</DialogTitle>
            <DialogDescription>
              Upload a screenshot or document showing your payment for this invoice.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUploadPaymentProof} className="space-y-4">
            <div>
              <Label htmlFor="proof">Payment Proof</Label>
              <Input
                id="proof"
                name="proof"
                type="file"
                accept="image/*,.pdf"
                className="mt-2"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setUploadModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientDashboard;
