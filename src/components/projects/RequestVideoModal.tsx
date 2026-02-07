import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, CalendarIcon, Video } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const videoRequestSchema = z.object({
  title: z.string().min(1, 'Video title is required'),
  description: z.string().optional(),
  container_id: z.string().min(1, 'Please select a project'),
  due_date: z.date().optional(),
});

type VideoRequestFormData = z.infer<typeof videoRequestSchema>;

interface ProjectContainer {
  id: string;
  title: string;
}

interface RequestVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RequestVideoModal({
  open,
  onOpenChange,
  onSuccess,
}: RequestVideoModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containers, setContainers] = useState<ProjectContainer[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<VideoRequestFormData>({
    resolver: zodResolver(videoRequestSchema),
    defaultValues: {
      title: '',
      description: '',
      container_id: '',
    },
  });

  // Fetch project containers for the client
  useEffect(() => {
    const fetchContainers = async () => {
      if (!user || !open) return;

      setLoadingContainers(true);
      try {
        const { data, error } = await supabase
          .from('project_containers')
          .select('id, title')
          .eq('client_id', user.id)
          .order('title', { ascending: true });

        if (error) throw error;
        setContainers(data || []);
      } catch (error) {
        console.error('Error fetching containers:', error);
      } finally {
        setLoadingContainers(false);
      }
    };

    fetchContainers();
  }, [user, open]);

  const onSubmit = async (data: VideoRequestFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Get agency_id
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRole?.agency_id) {
        throw new Error('No agency found');
      }

      // Create video (project) in backlog
      const { error: projectError } = await supabase
        .from('projects')
        .insert({
          title: data.title,
          description: data.description || null,
          client_id: user.id,
          agency_id: userRole.agency_id,
          status: 'backlog',
          due_date: data.due_date?.toISOString() || null,
          container_id: data.container_id,
        });

      if (projectError) throw projectError;

      toast({
        title: 'Video requested',
        description: `"${data.title}" has been added to the backlog.`,
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to request video',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Video className="w-5 h-5 text-primary" />
            Request New Video
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Request a new video for one of your existing projects.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="container_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Project</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-surface-elevated border-border/50">
                        <SelectValue placeholder={loadingContainers ? 'Loading...' : 'Select a project'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {containers.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No projects found. Create a project first.
                        </div>
                      ) : (
                        containers.map((container) => (
                          <SelectItem key={container.id} value={container.id}>
                            {container.title}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Video Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Episode 5 - Interview with Guest"
                      className="bg-surface-elevated border-border/50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">
                    Description <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of this video..."
                      className="bg-surface-elevated border-border/50 min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-foreground">
                    Desired Due Date <span className="text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal bg-surface-elevated border-border/50',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={isSubmitting || containers.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Requesting...
                  </>
                ) : (
                  'Request Video'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
