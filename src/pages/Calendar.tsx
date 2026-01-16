import { Helmet } from 'react-helmet-async';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
import { useAuth } from '@/hooks/useAuth';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';

export default function CalendarPage() {
  const { userRole } = useAuth();

  return (
    <>
      <Helmet>
        <title>Calendar | Veylodesk</title>
        <meta name="description" content="View your upcoming events and deadlines" />
      </Helmet>

      <div className="flex min-h-screen bg-background">
        <CollapsibleSidebar role={userRole || 'client'} />

        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground">Calendar</h1>
              <p className="text-muted-foreground mt-1">View your upcoming events and deadlines</p>
            </div>

            {/* Coming Soon Card */}
            <div className="glass-card rounded-2xl p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CalendarIcon className="w-10 h-10 text-primary" />
              </div>
              
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Coming Soon
              </h2>
              
              <p className="text-muted-foreground max-w-md mx-auto mb-8">
                We're building a powerful calendar feature to help you track project deadlines, 
                schedule meetings, and manage your workflow more efficiently.
              </p>

              <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Deadline tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  <span>Event scheduling</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
