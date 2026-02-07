import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ProposalReviewSheet } from '@/components/projects/ProposalReviewSheet';
import { FileText, Calendar, DollarSign, ChevronRight, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Project } from '@/hooks/useProjects';

interface ProposalData {
  id: string;
  title: string;
  description: string | null;
  client_id: string | null;
  client_name?: string;
  due_date: string | null;
  created_at: string;
}

interface ProposalsSectionProps {
  proposals: Project[];
  loading: boolean;
  onRefresh: () => void;
}

export function ProposalsSection({ proposals, loading, onRefresh }: ProposalsSectionProps) {
  const [selectedProposal, setSelectedProposal] = useState<ProposalData | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const handleReviewClick = (proposal: Project) => {
    // Convert to ProposalData format expected by ProposalReviewSheet
    setSelectedProposal({
      id: proposal.id,
      title: proposal.title,
      description: proposal.description,
      client_id: proposal.client_id,
      client_name: proposal.client_name,
      due_date: proposal.due_date,
      created_at: proposal.created_at,
    });
    setReviewOpen(true);
  };

  const handleSuccess = () => {
    onRefresh();
  };

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Pending Proposals</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (proposals.length === 0) {
    return null; // Don't show section if no proposals
  }

  return (
    <>
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Pending Proposals</h2>
            <Badge variant="secondary" className="bg-primary/20 text-primary">
              {proposals.length}
            </Badge>
          </div>
        </div>

        <div className="space-y-3">
          {proposals.map((proposal) => {
            const initials = proposal.client_name
              ? proposal.client_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
              : '??';

            return (
              <div
                key={proposal.id}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => handleReviewClick(proposal)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{proposal.title}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{proposal.client_name || 'Unknown Client'}</span>
                      {proposal.budget && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {proposal.budget.toLocaleString()}
                        </span>
                      )}
                      {proposal.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(proposal.due_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Review
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <ProposalReviewSheet
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        proposal={selectedProposal}
        onSuccess={handleSuccess}
      />
    </>
  );
}
