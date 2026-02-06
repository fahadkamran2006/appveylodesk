import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, FolderKanban, ArrowRight } from 'lucide-react';

interface ProjectContainer {
  id: string;
  title: string;
  client_name: string;
}

interface MoveVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string;
  videoTitle: string;
  currentContainerId: string | null;
  onSuccess?: () => void;
}

export function MoveVideoModal({
  open,
  onOpenChange,
  videoId,
  videoTitle,
  currentContainerId,
  onSuccess,
}: MoveVideoModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [containers, setContainers] = useState<ProjectContainer[]>([]);
  const [selectedContainerId, setSelectedContainerId] = useState<string>('');
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch available project containers
  useEffect(() => {
    const fetchContainers = async () => {
      if (!open || !user) return;

      setIsLoading(true);
      try {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('agency_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!userRole?.agency_id) return;

        // Fetch project containers with client info
        const { data: containerData, error } = await supabase
          .from('project_containers')
          .select('id, title, client_id')
          .eq('agency_id', userRole.agency_id)
          .order('title');

        if (error) throw error;

        // Get client names
        const clientIds = [...new Set(containerData?.map(c => c.client_id).filter(Boolean) || [])];
        let clientMap = new Map();

        if (clientIds.length > 0) {
          const { data: clientProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', clientIds);

          clientMap = new Map(clientProfiles?.map(c => [c.id, c.full_name || c.email || 'Unknown']) || []);
        }

        const enrichedContainers = (containerData || [])
          .filter(c => c.id !== currentContainerId) // Exclude current container
          .map(c => ({
            id: c.id,
            title: c.title,
            client_name: clientMap.get(c.client_id) || 'No Client',
          }));

        setContainers(enrichedContainers);
      } catch (error) {
        console.error('Error fetching containers:', error);
        toast({
          title: 'Error',
          description: 'Failed to load project containers',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchContainers();
  }, [open, user, currentContainerId, toast]);

  const handleMove = async () => {
    if (!selectedContainerId) return;

    setIsMoving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ container_id: selectedContainerId })
        .eq('id', videoId);

      if (error) throw error;

      const targetContainer = containers.find(c => c.id === selectedContainerId);

      toast({
        title: 'Video moved',
        description: `"${videoTitle}" moved to ${targetContainer?.title || 'the selected project'}`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error moving video:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to move video',
        variant: 'destructive',
      });
    } finally {
      setIsMoving(false);
    }
  };

  const handleClose = () => {
    if (!isMoving) {
      setSelectedContainerId('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FolderKanban className="w-5 h-5 text-primary" />
            Move Video
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Move "{videoTitle}" to a different project container.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : containers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderKanban className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No other project containers available</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Destination Project
                </label>
                <Select value={selectedContainerId} onValueChange={setSelectedContainerId}>
                  <SelectTrigger className="bg-surface-elevated border-border/50">
                    <SelectValue placeholder="Select a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {containers.map((container) => (
                      <SelectItem key={container.id} value={container.id}>
                        <div className="flex items-center gap-2">
                          <FolderKanban className="w-4 h-4 text-primary" />
                          <span>{container.title}</span>
                          <span className="text-muted-foreground">— {container.client_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedContainerId && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                  <ArrowRight className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Moving to:</span>
                  <span className="font-medium text-foreground">
                    {containers.find(c => c.id === selectedContainerId)?.title}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleClose}
            disabled={isMoving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 bg-primary hover:bg-primary/90"
            onClick={handleMove}
            disabled={isMoving || !selectedContainerId}
          >
            {isMoving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Moving...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4 mr-2" />
                Move Video
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
