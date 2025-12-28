import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  Command, 
  LayoutDashboard, 
  Users, 
  FolderKanban, 
  Receipt, 
  Settings,
  LogOut,
  Plus,
  TrendingUp,
  Clock,
  DollarSign
} from 'lucide-react';

const AdminDashboard = () => {
  const { user, userRole, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'admin') {
      navigate(userRole === 'client' ? '/client/portal' : '/editor/workspace');
    }
  }, [user, userRole, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const stats = [
    { label: 'Total Revenue', value: '$47,280', change: '+12%', icon: DollarSign, color: 'text-success' },
    { label: 'Active Projects', value: '12', change: '+3', icon: FolderKanban, color: 'text-primary' },
    { label: 'Pending Invoices', value: '$8,450', change: '4 unpaid', icon: Receipt, color: 'text-warning' },
    { label: 'Active Clients', value: '18', change: '+2 this month', icon: Users, color: 'text-primary' },
  ];

  const kanbanColumns = [
    { title: 'Backlog', color: 'bg-muted-foreground', items: ['Website Promo - TechCorp', 'Social Ads - StartupX'] },
    { title: 'In Progress', color: 'bg-primary', items: ['Brand Video Q4', 'Tutorial Series Ep3', 'Event Highlight Reel'] },
    { title: 'Review', color: 'bg-warning', items: ['Product Demo - SaaS Inc'] },
    { title: 'Done', color: 'bg-success', items: ['Testimonial Cut', 'Podcast Ep12'] },
  ];

  return (
    <>
      <Helmet>
        <title>Dashboard | Veylodesk</title>
        <meta name="description" content="Admin dashboard for managing your video agency." />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        {/* Sidebar */}
        <aside className="w-64 bg-surface-dark border-r border-border/50 flex flex-col">
          <div className="p-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Command className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">
                Veylo<span className="text-gradient">desk</span>
              </span>
            </Link>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/10 text-primary font-medium">
              <LayoutDashboard className="w-5 h-5" />
              Dashboard
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <FolderKanban className="w-5 h-5" />
              Projects
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <Users className="w-5 h-5" />
              Clients
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <Receipt className="w-5 h-5" />
              Invoices
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <Settings className="w-5 h-5" />
              Settings
            </a>
          </nav>

          <div className="p-4 border-t border-border/50">
            <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={signOut}>
              <LogOut className="w-5 h-5 mr-3" />
              Sign out
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Command Center</h1>
              <p className="text-muted-foreground">Welcome back! Here's your agency overview.</p>
            </div>
            <Button variant="hero">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat) => (
              <div key={stat.label} className="glass-card rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm text-success font-medium">{stat.change}</span>
                </div>
                <p className="text-2xl font-bold text-foreground mb-1">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Kanban Board */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Project Pipeline</h2>
              <span className="text-sm text-muted-foreground">This week</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {kanbanColumns.map((column) => (
                <div key={column.title} className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-2 h-2 rounded-full ${column.color}`} />
                    <span className="font-medium text-foreground">{column.title}</span>
                    <span className="text-sm text-muted-foreground ml-auto">{column.items.length}</span>
                  </div>
                  <div className="space-y-3">
                    {column.items.map((item) => (
                      <div
                        key={item}
                        className="p-3 rounded-lg bg-background border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
                      >
                        <p className="text-sm font-medium text-foreground">{item}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Due in 3 days</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default AdminDashboard;
