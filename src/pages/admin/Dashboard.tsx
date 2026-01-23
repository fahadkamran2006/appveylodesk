import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardStats, useProjects } from '@/hooks/useProjects';
import { useAdminAnalytics } from '@/hooks/useAdminAnalytics';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { EarningsChart } from '@/components/dashboard/EarningsChart';
import { ClientAcquisitionChart } from '@/components/dashboard/ClientAcquisitionChart';
import { PerformanceCard } from '@/components/dashboard/PerformanceCard';
import { Plus, Clock, DollarSign, FolderKanban, Receipt, Users, Loader2 } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
const AdminDashboard = () => {
  const {
    user,
    userRole,
    loading
  } = useAuth();
  const navigate = useNavigate();
  const {
    stats,
    loading: statsLoading,
    refetch: refetchStats
  } = useDashboardStats();
  const {
    projects,
    loading: projectsLoading,
    fetchProjects
  } = useProjects('admin');
  const {
    performanceMetrics,
    monthlyEarnings,
    clientAcquisition,
    loading: analyticsLoading
  } = useAdminAnalytics();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'admin') {
      navigate(userRole === 'client' ? '/client/dashboard' : '/editor/dashboard');
    }
  }, [user, userRole, loading, navigate]);
  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>;
  }
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  const statCards = [{
    label: 'Total Revenue',
    value: formatCurrency(stats.totalRevenue),
    change: stats.totalRevenue > 0 ? 'From paid invoices' : 'No revenue yet',
    icon: DollarSign,
    color: 'text-success'
  }, {
    label: 'Active Projects',
    value: stats.activeProjects.toString(),
    change: `${stats.proposalsCount} proposals pending`,
    icon: FolderKanban,
    color: 'text-primary'
  }, {
    label: 'Pending Invoices',
    value: formatCurrency(stats.pendingInvoices),
    change: `${stats.pendingInvoiceCount} unpaid`,
    icon: Receipt,
    color: 'text-warning'
  }, {
    label: 'Active Clients',
    value: stats.activeClients.toString(),
    change: `${stats.totalClients} total clients`,
    icon: Users,
    color: 'text-primary'
  }];
  const kanbanColumns = [{
    id: 'proposal',
    title: 'Proposals',
    color: 'bg-purple-500'
  }, {
    id: 'backlog',
    title: 'Backlog',
    color: 'bg-muted-foreground'
  }, {
    id: 'in_progress',
    title: 'In Progress',
    color: 'bg-primary'
  }, {
    id: 'review',
    title: 'Review',
    color: 'bg-warning'
  }, {
    id: 'done',
    title: 'Done',
    color: 'bg-success'
  }];
  const getProjectsByStatus = (status: string) => projects.filter(p => p.status === status);
  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return isPast(parseISO(dueDate));
  };
  const handleProjectSuccess = () => {
    fetchProjects();
    refetchStats();
  };
  return <>
      <Helmet>
        <title>Dashboard | Veylodesk</title>
        <meta name="description" content="Admin dashboard for managing your video agency." />
      </Helmet>

      <DashboardLayout role="admin">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Command Center</h1>
            <p className="text-sm md:text-base text-muted-foreground">Welcome back! Here's your agency overview.</p>
          </div>
          <Button variant="hero" onClick={() => setCreateModalOpen(true)} className="w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>

        {/* Stats Grid - Single column on mobile, 2 on tablet, 4 on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
            {statsLoading ? Array.from({
          length: 4
        }).map((_, i) => <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
                  <div className="h-10 w-10 bg-muted/50 rounded-lg mb-4" />
                  <div className="h-8 w-24 bg-muted/50 rounded mb-2" />
                  <div className="h-4 w-20 bg-muted/50 rounded" />
                </div>) : statCards.map(stat => <div key={stat.label} className="glass-card rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center ${stat.color}`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <span className="text-sm text-muted-foreground font-medium">{stat.change}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground mb-1">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>)}
          </div>

          {/* Performance & Analytics Section */}
          

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
            <EarningsChart data={monthlyEarnings} loading={analyticsLoading} />
            <ClientAcquisitionChart data={clientAcquisition} loading={analyticsLoading} />
          </div>

          {/* Kanban Board Preview */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Project Pipeline</h2>
              <Link to="/admin/projects" className="text-sm text-primary hover:underline">
                View full board →
              </Link>
            </div>

            {projectsLoading ? <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div> : <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4 overflow-x-auto">
                {kanbanColumns.map(column => {
            const columnProjects = getProjectsByStatus(column.id);
            return <div key={column.id} className="bg-muted/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <div className={`w-2 h-2 rounded-full ${column.color}`} />
                        <span className="font-medium text-foreground text-sm">{column.title}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {columnProjects.length}
                        </span>
                      </div>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {columnProjects.slice(0, 3).map(project => <Link key={project.id} to="/admin/projects" className="block p-3 rounded-lg bg-background border border-border/50 hover:border-primary/30 transition-colors">
                            <p className="text-sm font-medium text-foreground truncate">
                              {project.title}
                            </p>
                            {project.client_name && <p className="text-xs text-muted-foreground mt-1 truncate">
                                {project.client_name}
                              </p>}
                            {project.due_date && <div className="flex items-center gap-1.5 mt-2">
                                <Clock className={`w-3 h-3 ${isOverdue(project.due_date) ? 'text-destructive' : 'text-muted-foreground'}`} />
                                <span className={`text-xs ${isOverdue(project.due_date) ? 'text-destructive' : 'text-muted-foreground'}`}>
                                  {format(parseISO(project.due_date), 'MMM d')}
                                </span>
                              </div>}
                          </Link>)}
                        {columnProjects.length > 3 && <p className="text-xs text-muted-foreground text-center py-1">
                            +{columnProjects.length - 3} more
                          </p>}
                        {columnProjects.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">
                            No projects
                          </p>}
                      </div>
                    </div>;
          })}
              </div>}
          </div>
        </DashboardLayout>

      {/* Create Project Modal */}
      <CreateProjectModal open={createModalOpen} onOpenChange={setCreateModalOpen} onSuccess={handleProjectSuccess} />
    </>;
};
export default AdminDashboard;