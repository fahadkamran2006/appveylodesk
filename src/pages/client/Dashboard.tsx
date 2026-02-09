import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Clock, Download, FolderKanban, Receipt, Video, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClientRequestVideoModal } from '@/components/projects/ClientRequestVideoModal';
import { cn } from '@/lib/utils';

interface ProjectContainer {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

interface ProjectContainerStats extends ProjectContainer {
  videoCount: number;
  activeCount: number;
  completedCount: number;
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
  
  const [projectContainers, setProjectContainers] = useState<ProjectContainerStats[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [uploading, setUploading] = useState(false);
  const [requestVideoModalOpen, setRequestVideoModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'client' && userRole !== 'admin') {
      navigate('/editor/dashboard');
    }
  }, [user, userRole, loading, navigate]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch project containers (the actual "Projects" in 2-tier client view)
      const { data: containersData, error: containersError } = await supabase
        .from('project_containers')
        .select('id, title, description, created_at')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (containersError) throw containersError;

      // Fetch videos (projects table) to calculate stats per container
      const { data: videosData, error: videosError } = await supabase
        .from('projects')
        .select('id, container_id, status')
        .eq('client_id', user.id);

      if (videosError) throw videosError;

      // Build stats for each container
      const containerStats: ProjectContainerStats[] = (containersData || []).map(container => {
        const containerVideos = (videosData || []).filter(v => v.container_id === container.id);
        return {
          ...container,
          videoCount: containerVideos.length,
          activeCount: containerVideos.filter(v => ['in_progress', 'review', 'backlog', 'proposal'].includes(v.status)).length,
          completedCount: containerVideos.filter(v => v.status === 'done').length,
        };
      });

      setProjectContainers(containerStats);

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
      const { error } = await supabase
        .from('invoices')
        .update({ 
          payment_proof_url: `payment-proof-${selectedInvoice.id}`,
          status: 'pending'
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

  const handleProjectClick = (containerId: string) => {
    // Navigate to the project board for this container
    navigate(`/client/projects?project=${containerId}`);
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Calculate stats from all videos across all containers
  const totalVideos = projectContainers.reduce((acc, c) => acc + c.videoCount, 0);
  const activeVideos = projectContainers.reduce((acc, c) => acc + c.activeCount, 0);
  const completedVideos = projectContainers.reduce((acc, c) => acc + c.completedCount, 0);

  return (
    <>
      <Helmet>
        <title>Client Dashboard | Veylodesk</title>
        <meta name="description" content="View your projects and manage invoices." />
      </Helmet>

      <DashboardLayout role="client">
        <div className="mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-sm md:text-base text-muted-foreground">Track your projects and manage invoices.</p>
        </div>

        {/* Hero: Request Video Card */}
        <div className="mb-6 md:mb-8">
          {/* Request New Video */}
          <div 
            onClick={() => setRequestVideoModalOpen(true)}
            className="p-4 md:p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/10 cursor-pointer transition-all duration-300 group max-w-lg"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                <Video className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  Request New Video
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Submit a video request for your agency to review and start working on
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderKanban className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projects</p>
                <p className="text-2xl font-bold text-foreground">{projectContainers.length}</p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Video className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Videos</p>
                <p className="text-2xl font-bold text-foreground">{activeVideos}</p>
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
                <p className="text-2xl font-bold text-foreground">{completedVideos}</p>
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
        </div>

        {/* Projects Grid - Shows project containers */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">Your Projects</h2>
            <Button variant="outline" size="sm" onClick={() => navigate('/client/projects?view=all')}>
              <Eye className="w-4 h-4 mr-2" />
              View All Videos
            </Button>
          </div>

          {projectContainers.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-border">
              <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-2">No projects yet.</p>
              <p className="text-sm text-muted-foreground">
                Your admin will create projects for you. Once you have projects, you can request videos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {projectContainers.slice(0, 8).map((project) => (
                <div
                  key={project.id}
                  onClick={() => handleProjectClick(project.id)}
                  className={cn(
                    'glass-card rounded-xl p-5 cursor-pointer transition-all duration-200',
                    'hover:border-primary/30 hover:shadow-glow-sm',
                    'active:scale-[0.98]'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FolderKanban className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      {project.videoCount}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-foreground mb-1 line-clamp-1">
                    {project.title}
                  </h3>
                  
                  {project.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {project.activeCount > 0 && (
                      <span className="text-primary">{project.activeCount} active</span>
                    )}
                    {project.completedCount > 0 && (
                      <span className="text-success">{project.completedCount} done</span>
                    )}
                    {project.videoCount === 0 && (
                      <span className="text-muted-foreground">No videos yet</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invoices Section */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Recent Invoices</h2>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No invoices yet.</p>
          ) : (
            <div className="space-y-4">
              {invoices.slice(0, 5).map((invoice) => (
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
                      {invoice.status === 'paid' ? 'Paid' : invoice.status === 'pending' ? 'Pending' : 'Unpaid'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>

      {/* Upload Payment Proof Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Upload Payment Proof
            </DialogTitle>
            <DialogDescription>
              Upload a screenshot or document showing your payment.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUploadPaymentProof} className="space-y-4">
            <div className="border-2 border-dashed border-primary/30 rounded-xl p-8 text-center">
              <Label htmlFor="proof" className="text-foreground font-medium block mb-2">
                Click to select file
              </Label>
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

      {/* Request Video Modal */}
      <ClientRequestVideoModal
        open={requestVideoModalOpen}
        onOpenChange={setRequestVideoModalOpen}
        onSuccess={fetchData}
      />
    </>
  );
};

export default ClientDashboard;
