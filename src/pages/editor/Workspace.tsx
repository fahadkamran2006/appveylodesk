import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  Command, 
  FolderKanban, 
  DollarSign,
  LogOut,
  Upload,
  Clock,
  CheckCircle2
} from 'lucide-react';

const EditorWorkspace = () => {
  const { user, userRole, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'editor') {
      navigate(userRole === 'admin' ? '/admin/dashboard' : '/client/portal');
    }
  }, [user, userRole, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const tasks = [
    { name: 'Edit Intro Sequence', client: 'TechCorp', due: 'Today', priority: 'high' },
    { name: 'Color Grading - Ep3', client: 'Startup X', due: 'Tomorrow', priority: 'medium' },
    { name: 'Audio Sync Fix', client: 'SaaS Inc', due: 'Dec 30', priority: 'low' },
  ];

  const completed = [
    { name: 'Final Cut Review', client: 'BrandCo', completedAt: 'Today', earnings: '$450' },
    { name: 'Thumbnail Design', client: 'TechCorp', completedAt: 'Yesterday', earnings: '$120' },
  ];

  return (
    <>
      <Helmet>
        <title>Editor Workspace | Veylodesk</title>
        <meta name="description" content="Manage your assigned projects and track earnings." />
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
              My Tasks
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <DollarSign className="w-5 h-5" />
              Earnings
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
              <h1 className="text-2xl font-bold text-foreground">Your Tasks</h1>
              <p className="text-muted-foreground">Complete tasks and upload deliverables.</p>
            </div>
            <div className="glass-card rounded-xl px-6 py-4">
              <p className="text-sm text-muted-foreground">This month's earnings</p>
              <p className="text-2xl font-bold text-success">$1,240</p>
            </div>
          </div>

          {/* Active Tasks */}
          <div className="glass-card rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-6">Active Tasks</h2>
            <div className="space-y-4">
              {tasks.map((task) => (
                <div key={task.name} className="p-4 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${
                      task.priority === 'high' ? 'bg-destructive' :
                      task.priority === 'medium' ? 'bg-warning' : 'bg-muted-foreground'
                    }`} />
                    <div>
                      <p className="font-medium text-foreground">{task.name}</p>
                      <p className="text-sm text-muted-foreground">{task.client}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      task.due === 'Today'
                        ? 'bg-warning/10 text-warning border border-warning/20'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      <Clock className="w-3 h-3 inline mr-1" />
                      {task.due}
                    </span>
                    <Button variant="outline" size="sm">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Completed */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Recently Completed</h2>
            <div className="space-y-4">
              {completed.map((task) => (
                <div key={task.name} className="p-4 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                    <div>
                      <p className="font-medium text-foreground">{task.name}</p>
                      <p className="text-sm text-muted-foreground">{task.client} • {task.completedAt}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-success">{task.earnings}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default EditorWorkspace;
