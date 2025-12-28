import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  Command, 
  FolderKanban, 
  Receipt, 
  Download,
  LogOut,
  FileCheck,
  Clock
} from 'lucide-react';

const ClientPortal = () => {
  const { user, userRole, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'client') {
      navigate(userRole === 'admin' ? '/admin/dashboard' : '/editor/workspace');
    }
  }, [user, userRole, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const projects = [
    { name: 'Brand Video Q4', status: 'In Review', progress: 90, dueDate: 'Dec 30' },
    { name: 'Social Ads Pack', status: 'In Progress', progress: 45, dueDate: 'Jan 5' },
    { name: 'Product Demo', status: 'In Progress', progress: 20, dueDate: 'Jan 12' },
  ];

  const invoices = [
    { id: 'INV-001', project: 'Brand Video Q4', amount: '$2,500', status: 'Unpaid', dueDate: 'Jan 15' },
    { id: 'INV-002', project: 'Social Ads Pack', amount: '$1,200', status: 'Paid', dueDate: 'Dec 15' },
  ];

  return (
    <>
      <Helmet>
        <title>Client Portal | Veylodesk</title>
        <meta name="description" content="View your projects and manage invoices." />
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
              <FolderKanban className="w-5 h-5" />
              Projects
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <Receipt className="w-5 h-5" />
              Invoices
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
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Your Projects</h1>
            <p className="text-muted-foreground">Track progress and download deliverables.</p>
          </div>

          {/* Projects */}
          <div className="glass-card rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-6">Active Projects</h2>
            <div className="space-y-4">
              {projects.map((project) => (
                <div key={project.name} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-foreground">{project.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      project.status === 'In Review' 
                        ? 'bg-warning/10 text-warning border border-warning/20'
                        : 'bg-primary/10 text-primary border border-primary/20'
                    }`}>
                      {project.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-indigo-soft rounded-full"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">{project.progress}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      Due {project.dueDate}
                    </div>
                    {project.progress >= 90 && (
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Invoices */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Invoices</h2>
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="p-4 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{invoice.project}</p>
                    <p className="text-sm text-muted-foreground">{invoice.id} • Due {invoice.dueDate}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-foreground">{invoice.amount}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      invoice.status === 'Paid'
                        ? 'bg-success/10 text-success border border-success/20'
                        : 'bg-warning/10 text-warning border border-warning/20'
                    }`}>
                      {invoice.status}
                    </span>
                    {invoice.status === 'Unpaid' && (
                      <Button variant="hero" size="sm">Pay Now</Button>
                    )}
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

export default ClientPortal;
