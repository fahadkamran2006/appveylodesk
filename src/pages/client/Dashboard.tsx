import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Clock, Download, FolderKanban, Receipt, Video, Eye, 
  ArrowRight, Sparkles, CheckCircle2, CircleDot,
  ChevronRight, TrendingUp, FileVideo, Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/useProfile';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClientRequestVideoModal } from '@/components/projects/ClientRequestVideoModal';
import { cn } from '@/lib/utils';
import { useBranding } from '@/contexts/BrandingContext';
import { format, formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

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
  latestActivity: string | null;
}

interface Invoice {
  id: string;
  amount: number;
  status: string;
  due_date: string | null;
  invoice_number: string | null;
  project: { title: string } | null;
  created_at: string;
}

interface RecentVideo {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  container_title?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CircleDot }> = {
  in_progress: { label: 'In Progress', color: 'bg-blue-500/15 text-blue-500 border-blue-500/20', icon: CircleDot },
  review: { label: 'In Review', color: 'bg-amber-500/15 text-amber-500 border-amber-500/20', icon: Eye },
  done: { label: 'Delivered', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20', icon: CheckCircle2 },
  backlog: { label: 'Queued', color: 'bg-muted text-muted-foreground border-border/50', icon: Clock },
  proposal: { label: 'Proposal', color: 'bg-purple-500/15 text-purple-500 border-purple-500/20', icon: Sparkles },
  request: { label: 'Requested', color: 'bg-primary/15 text-primary border-primary/20', icon: Sparkles },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
};

function ProfileAvatar() {
  const { profile } = useProfile();
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';
  return (
    <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-border">
      <div className="text-right hidden md:block">
        <p className="text-sm font-medium text-foreground truncate max-w-[120px]">{profile?.full_name || 'User'}</p>
        <p className="text-xs text-muted-foreground truncate max-w-[120px]">{profile?.email}</p>
      </div>
      <Avatar className="h-9 w-9 ring-2 ring-primary/10">
        <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'User'} />
        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">{initials}</AvatarFallback>
      </Avatar>
    </div>
  );
}

const ClientDashboard = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { branding, isCustomBrandingActive } = useBranding();
  
  const [projectContainers, setProjectContainers] = useState<ProjectContainerStats[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [uploading, setUploading] = useState(false);
  const [requestVideoModalOpen, setRequestVideoModalOpen] = useState(false);
  const [userName, setUserName] = useState('');

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
      // Fetch user name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      
      if (profile?.full_name) {
        setUserName(profile.full_name.split(' ')[0]);
      }

      // Fetch project containers
      const { data: containersData, error: containersError } = await supabase
        .from('project_containers')
        .select('id, title, description, created_at')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (containersError) throw containersError;

      // Fetch videos (projects table) to calculate stats per container
      const { data: videosData, error: videosError } = await supabase
        .from('projects')
        .select('id, container_id, status, title, updated_at')
        .eq('client_id', user.id)
        .order('updated_at', { ascending: false });

      if (videosError) throw videosError;

      // Build recent videos list
      const recent: RecentVideo[] = (videosData || []).slice(0, 6).map(v => {
        const container = (containersData || []).find(c => c.id === v.container_id);
        return {
          id: v.id,
          title: v.title,
          status: v.status,
          updated_at: v.updated_at,
          container_title: container?.title,
        };
      });
      setRecentVideos(recent);

      // Build stats for each container
      const containerStats: ProjectContainerStats[] = (containersData || []).map(container => {
        const containerVideos = (videosData || []).filter(v => v.container_id === container.id);
        const latestVideo = containerVideos[0];
        return {
          ...container,
          videoCount: containerVideos.length,
          activeCount: containerVideos.filter(v => ['in_progress', 'review', 'backlog', 'proposal', 'request'].includes(v.status)).length,
          completedCount: containerVideos.filter(v => v.status === 'done').length,
          latestActivity: latestVideo?.updated_at || null,
        };
      });

      setProjectContainers(containerStats);

      // Fetch invoices for this client
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, amount, status, due_date, invoice_number, created_at, project:projects(title)')
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
      toast({ title: "No file selected", description: "Please select a file to upload.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ payment_proof_url: `payment-proof-${selectedInvoice.id}`, status: 'pending' })
        .eq('id', selectedInvoice.id);

      if (error) throw error;
      toast({ title: "Payment proof uploaded", description: "Your payment is being reviewed." });
      setUploadModalOpen(false);
      setSelectedInvoice(null);
      fetchData();
    } catch (error) {
      console.error('Error uploading:', error);
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleProjectClick = (containerId: string) => {
    navigate(`/client/projects?project=${containerId}`);
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Calculate stats
  const totalVideos = projectContainers.reduce((acc, c) => acc + c.videoCount, 0);
  const activeVideos = projectContainers.reduce((acc, c) => acc + c.activeCount, 0);
  const completedVideos = projectContainers.reduce((acc, c) => acc + c.completedCount, 0);
  const unpaidInvoices = invoices.filter(i => i.status === 'unpaid' || i.status === 'overdue');
  const totalOwed = unpaidInvoices.reduce((acc, i) => acc + i.amount, 0);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <>
      <Helmet>
        <title>Dashboard | {isCustomBrandingActive && branding?.agency_name ? branding.agency_name : 'Veylodesk'}</title>
        <meta name="description" content="View your projects, track video progress, and manage invoices." />
      </Helmet>

      <DashboardLayout role="client" hideHeader>
        <motion.div 
          variants={containerVariants} 
          initial="hidden" 
          animate="visible"
          className="space-y-6 md:space-y-8 [&>*+*]:pt-6 md:[&>*+*]:pt-8"
        >
          {/* Hero Section with Notification Bell & Profile */}
          <motion.div variants={itemVariants} className="flex items-start sm:items-center justify-between gap-4 pb-5 border-b border-border/40">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                {getGreeting()}, {userName || 'there'} 👋
              </h1>
              <p className="text-muted-foreground mt-1">
                Here's what's happening with your projects.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Desktop CTA removed — unified card below */}
              <NotificationBell />
              <ProfileAvatar />
            </div>
          </motion.div>

          {/* Request CTA Card — works on mobile & desktop */}
          <motion.div variants={itemVariants}>
            <div 
              onClick={() => setRequestVideoModalOpen(true)}
              className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 p-4 md:p-5 flex items-center gap-4 cursor-pointer active:scale-[0.98] hover:border-primary/60 transition-all duration-200"
            >
              <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm md:text-base font-semibold text-foreground">Start a New Project ✨</h3>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Submit a request and we'll get back to you</p>
              </div>
              <Button 
                className="bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20 flex-shrink-0 h-10 px-5 text-sm font-semibold"
              >
                <Video className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 pb-5 border-b border-border/40">
            {[
              { 
                label: 'Active Projects', 
                value: projectContainers.length, 
                icon: FolderKanban, 
                gradient: 'from-primary/10 to-primary/5',
                iconColor: 'text-primary',
                suffix: projectContainers.length === 1 ? 'project' : 'projects'
              },
              { 
                label: 'Videos In Progress', 
                value: activeVideos, 
                icon: FileVideo, 
                gradient: 'from-blue-500/10 to-blue-500/5',
                iconColor: 'text-blue-500',
                suffix: 'active'
              },
              { 
                label: 'Delivered', 
                value: completedVideos, 
                icon: CheckCircle2, 
                gradient: 'from-emerald-500/10 to-emerald-500/5',
                iconColor: 'text-emerald-500',
                suffix: 'completed'
              },
              { 
                label: 'Outstanding', 
                value: `$${totalOwed.toLocaleString()}`, 
                icon: Receipt, 
                gradient: unpaidInvoices.length > 0 ? 'from-amber-500/10 to-amber-500/5' : 'from-muted/50 to-muted/30',
                iconColor: unpaidInvoices.length > 0 ? 'text-amber-500' : 'text-muted-foreground',
                suffix: `${unpaidInvoices.length} invoice${unpaidInvoices.length !== 1 ? 's' : ''}`
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  'relative overflow-hidden rounded-2xl border border-border/50 p-4 md:p-5',
                  'bg-gradient-to-br',
                  stat.gradient,
                  'transition-all duration-300 hover:border-border'
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <stat.icon className={cn('w-5 h-5', stat.iconColor)} />
                </div>
                <p className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.suffix}</p>
              </div>
            ))}
          </motion.div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Projects Column */}
            <motion.div variants={itemVariants} className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Your Projects</h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate('/client/projects?view=all')}
                  className="text-muted-foreground hover:text-foreground group"
                >
                  View All
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </div>

              {projectContainers.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-border/50 p-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <FolderKanban className="w-7 h-7 text-muted-foreground/50" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">No projects yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Your admin will create projects for you. Once you have projects, you can request videos and track progress here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projectContainers.slice(0, 6).map((project) => {
                    const completionRate = project.videoCount > 0 
                      ? Math.round((project.completedCount / project.videoCount) * 100) 
                      : 0;
                    
                    return (
                      <div
                        key={project.id}
                        onClick={() => handleProjectClick(project.id)}
                        className={cn(
                          'group rounded-xl border border-border/50 bg-card p-4 md:p-5',
                          'cursor-pointer transition-all duration-200',
                          'hover:border-primary/30 hover:shadow-md hover:shadow-primary/5',
                          'active:scale-[0.995]'
                        )}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                              <FolderKanban className="w-5 h-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                {project.title}
                              </h3>
                              {project.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                  {project.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-2" />
                        </div>

                        {/* Progress bar */}
                        <div className="flex items-center gap-3 mt-3">
                          <Progress value={completionRate} className="h-1.5 flex-1 bg-muted/50" />
                          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                            {project.completedCount}/{project.videoCount}
                          </span>
                        </div>

                        {/* Bottom stats */}
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          {project.activeCount > 0 && (
                            <span className="flex items-center gap-1 text-blue-500">
                              <CircleDot className="w-3 h-3" />
                              {project.activeCount} active
                            </span>
                          )}
                          {project.completedCount > 0 && (
                            <span className="flex items-center gap-1 text-emerald-500">
                              <CheckCircle2 className="w-3 h-3" />
                              {project.completedCount} done
                            </span>
                          )}
                          {project.latestActivity && (
                            <span className="ml-auto text-muted-foreground/70">
                              Updated {formatDistanceToNow(new Date(project.latestActivity), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Right Sidebar */}
            <motion.div variants={itemVariants} className="space-y-6">
              {/* Recent Activity */}
              {recentVideos.length > 0 && (
                <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border/50">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Recent Activity
                    </h3>
                  </div>
                  <div className="divide-y divide-border/30">
                    {recentVideos.slice(0, 5).map((video) => {
                      const config = statusConfig[video.status] || statusConfig.backlog;
                      const StatusIcon = config.icon;
                      return (
                        <div key={video.id} className="px-5 py-3 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start gap-3">
                            <StatusIcon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', config.color.split(' ')[1])} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {video.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge 
                                  variant="outline" 
                                  className={cn('text-[10px] px-1.5 py-0 h-4 border', config.color)}
                                >
                                  {config.label}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground/70">
                                  {formatDistanceToNow(new Date(video.updated_at), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Invoices */}
              <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-primary" />
                    Recent Invoices
                  </h3>
                  {invoices.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-7" 
                      onClick={() => navigate('/client/invoices')}
                    >
                      View All
                    </Button>
                  )}
                </div>
                {invoices.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <Receipt className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No invoices yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {invoices.slice(0, 4).map((invoice) => (
                      <div 
                        key={invoice.id} 
                        className="px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">
                              {invoice.project?.title || 'Invoice'}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {invoice.invoice_number || format(new Date(invoice.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                            <span className="text-sm font-semibold text-foreground">
                              ${invoice.amount.toLocaleString()}
                            </span>
                            <Badge 
                              variant="outline"
                              className={cn('text-[10px] px-1.5 py-0 h-4 border', {
                                'bg-emerald-500/15 text-emerald-500 border-emerald-500/20': invoice.status === 'paid',
                                'bg-amber-500/15 text-amber-500 border-amber-500/20': invoice.status === 'pending',
                                'bg-red-500/15 text-red-500 border-red-500/20': invoice.status === 'unpaid' || invoice.status === 'overdue',
                              })}
                            >
                              {invoice.status === 'paid' ? 'Paid' : invoice.status === 'pending' ? 'Pending' : 'Unpaid'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Links */}
              <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-2">
                <h3 className="font-semibold text-foreground text-sm mb-3">Quick Actions</h3>
                {[
                  { label: 'View All Videos', icon: FileVideo, href: '/client/projects?view=all' },
                  { label: 'View Invoices', icon: Receipt, href: '/client/invoices' },
                  { label: 'Messages', icon: Calendar, href: '/client/messages' },
                ].map((action) => (
                  <Button
                    key={action.label}
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground hover:text-foreground h-9"
                    onClick={() => navigate(action.href)}
                  >
                    <action.icon className="w-4 h-4 mr-2" />
                    {action.label}
                    <ChevronRight className="w-3 h-3 ml-auto" />
                  </Button>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>
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
              <Input id="proof" name="proof" type="file" accept="image/*,.pdf" className="mt-2" />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setUploadModalOpen(false)}>Cancel</Button>
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
