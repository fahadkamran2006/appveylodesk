import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Receipt, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Eye,
  Clock,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Invoice {
  id: string;
  amount: number;
  status: string;
  due_date: string | null;
  created_at: string;
  payment_proof_url: string | null;
  project: { id: string; title: string } | null;
  client: { id: string; full_name: string | null; email: string } | null;
}

interface Project {
  id: string;
  title: string;
  client_id: string | null;
  client: { id: string; full_name: string | null; email: string } | null;
}

const AdminInvoices = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'pending' | 'paid'>('all');

  // Form state
  const [selectedProject, setSelectedProject] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'admin') {
      navigate(userRole === 'client' ? '/client/dashboard' : '/editor/dashboard');
    }
  }, [user, userRole, loading, navigate]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch invoices with project info
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          id,
          amount,
          status,
          due_date,
          created_at,
          payment_proof_url,
          client_id,
          project:projects(id, title)
        `)
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      // Fetch client profiles separately
      const clientIds = [...new Set(invoicesData?.map(i => i.client_id).filter(Boolean) || [])];
      const { data: clientProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', clientIds);

      const clientMap = new Map(clientProfiles?.map(c => [c.id, c]) || []);
      
      const mappedInvoices = (invoicesData || []).map(inv => ({
        ...inv,
        client: clientMap.get(inv.client_id) || null
      }));

      setInvoices(mappedInvoices as Invoice[]);

      // Fetch projects with clients for create modal
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, title, client_id')
        .not('client_id', 'is', null);

      if (projectsError) throw projectsError;

      // Fetch client profiles for projects
      const projectClientIds = [...new Set(projectsData?.map(p => p.client_id).filter(Boolean) || [])];
      const { data: projectClientProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', projectClientIds);

      const projectClientMap = new Map(projectClientProfiles?.map(c => [c.id, c]) || []);
      
      const mappedProjects = (projectsData || []).map(proj => ({
        ...proj,
        client: projectClientMap.get(proj.client_id!) || null
      }));

      setProjects(mappedProjects as Project[]);
    } catch (error) {
      console.error('Error fetching data:', error);
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
    if (user && userRole === 'admin') {
      fetchData();
    }
  }, [user, userRole, fetchData]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !amount) return;

    setCreating(true);
    try {
      const project = projects.find(p => p.id === selectedProject);
      if (!project || !project.client_id) {
        throw new Error('Project has no client assigned');
      }

      // Get agency ID
      const { data: agencyData } = await supabase.rpc('get_user_agency_id', { _user_id: user!.id });

      const { error } = await supabase
        .from('invoices')
        .insert({
          project_id: selectedProject,
          client_id: project.client_id,
          agency_id: agencyData,
          amount: parseFloat(amount),
          due_date: dueDate || null,
          status: 'unpaid',
        });

      if (error) throw error;

      toast({
        title: "Invoice created",
        description: "The invoice has been sent to the client.",
      });

      setCreateModalOpen(false);
      setSelectedProject('');
      setAmount('');
      setDueDate('');
      fetchData();
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Failed to create invoice",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleViewProof = async (invoice: Invoice) => {
    if (!invoice.payment_proof_url) return;
    
    setSelectedInvoice(invoice);
    
    // Get signed URL for the proof
    const { data } = await supabase.storage
      .from('payment_proofs')
      .createSignedUrl(invoice.payment_proof_url, 3600);
    
    setProofUrl(data?.signedUrl || null);
    setProofModalOpen(true);
  };

  const handleApprovePayment = async () => {
    if (!selectedInvoice) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      toast({
        title: "Payment approved",
        description: "Invoice marked as paid.",
      });

      setProofModalOpen(false);
      setSelectedInvoice(null);
      fetchData();
    } catch (error) {
      console.error('Error approving payment:', error);
      toast({
        title: "Failed to approve",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedInvoice) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'unpaid', payment_proof_url: null })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      toast({
        title: "Payment rejected",
        description: "Client will need to resubmit proof.",
      });

      setProofModalOpen(false);
      setSelectedInvoice(null);
      fetchData();
    } catch (error) {
      console.error('Error rejecting payment:', error);
      toast({
        title: "Failed to reject",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    if (filter === 'all') return true;
    if (filter === 'pending') return inv.status === 'pending';
    return inv.status === filter;
  });

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
        <title>Invoices | Veylodesk</title>
        <meta name="description" content="Manage your agency invoices." />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <CollapsibleSidebar role="admin" />
        </div>

        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Invoices</h1>
              <p className="text-muted-foreground">Create and manage client invoices.</p>
            </div>
            <Button variant="hero" onClick={() => setCreateModalOpen(true)} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
          </div>

          {/* Stats Cards - Stack on mobile, grid on desktop */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8">
            <div className="glass-card rounded-xl p-4 md:p-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-muted-foreground truncate">Total Billed</p>
                  <p className="text-lg md:text-2xl font-bold text-foreground">${stats.total.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4 md:p-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-destructive" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-muted-foreground truncate">Unpaid</p>
                  <p className="text-lg md:text-2xl font-bold text-foreground">${stats.unpaid.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4 md:p-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 md:w-6 md:h-6 text-warning" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-muted-foreground truncate">Pending</p>
                  <p className="text-lg md:text-2xl font-bold text-foreground">{stats.pending}</p>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4 md:p-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-success" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-muted-foreground truncate">Collected</p>
                  <p className="text-lg md:text-2xl font-bold text-foreground">${stats.paid.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs - Scrollable on mobile */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {(['all', 'unpaid', 'pending', 'paid'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
                className="shrink-0"
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>

          {/* Invoices - Cards on mobile, Table on desktop */}
          <div className="glass-card rounded-xl overflow-hidden">
            {filteredInvoices.length === 0 ? (
              <div className="p-12 text-center">
                <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No invoices found.</p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-border/50">
                  {filteredInvoices.map((invoice) => (
                    <div key={invoice.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">
                            {invoice.project?.title || 'Unknown Project'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {invoice.client?.full_name || invoice.client?.email || 'Unknown'}
                          </p>
                        </div>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium shrink-0 ml-2",
                          invoice.status === 'paid' && "bg-success/10 text-success border border-success/20",
                          invoice.status === 'pending' && "bg-warning/10 text-warning border border-warning/20",
                          invoice.status === 'unpaid' && "bg-destructive/10 text-destructive border border-destructive/20"
                        )}>
                          {invoice.status === 'paid' ? 'Paid' : invoice.status === 'pending' ? 'Review' : 'Unpaid'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-semibold text-foreground">${invoice.amount.toLocaleString()}</span>
                          {invoice.due_date && (
                            <span className="text-muted-foreground">
                              Due {new Date(invoice.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {invoice.status === 'pending' && invoice.payment_proof_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewProof(invoice)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Review
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <table className="w-full hidden md:table">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Project</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Client</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Amount</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Due Date</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredInvoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-muted/20">
                        <td className="p-4 font-medium text-foreground">
                          {invoice.project?.title || 'Unknown Project'}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {invoice.client?.full_name || invoice.client?.email || 'Unknown'}
                        </td>
                        <td className="p-4 font-semibold text-foreground">
                          ${invoice.amount.toLocaleString()}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="p-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium",
                            invoice.status === 'paid' && "bg-success/10 text-success border border-success/20",
                            invoice.status === 'pending' && "bg-warning/10 text-warning border border-warning/20",
                            invoice.status === 'unpaid' && "bg-destructive/10 text-destructive border border-destructive/20"
                          )}>
                            {invoice.status === 'paid' ? 'Paid' : invoice.status === 'pending' ? 'Pending Review' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="p-4">
                          {invoice.status === 'pending' && invoice.payment_proof_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewProof(invoice)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Review Proof
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Create Invoice Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>
              Create a new invoice for a client project.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateInvoice} className="space-y-4">
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
            <div>
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="mt-2"
                required
              />
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
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !selectedProject || !amount}>
                {creating ? 'Creating...' : 'Create Invoice'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Proof Review Modal */}
      <Dialog open={proofModalOpen} onOpenChange={setProofModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Payment Proof</DialogTitle>
            <DialogDescription>
              {selectedInvoice?.project?.title} - ${selectedInvoice?.amount.toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          
          {proofUrl ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border overflow-hidden bg-muted/30">
                <img 
                  src={proofUrl} 
                  alt="Payment proof" 
                  className="w-full max-h-96 object-contain"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="destructive" onClick={handleRejectPayment}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button variant="hero" onClick={handleApprovePayment}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve Payment
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Loading proof...</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminInvoices;