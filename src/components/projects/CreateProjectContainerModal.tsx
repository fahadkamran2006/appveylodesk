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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, FolderPlus } from 'lucide-react';

const containerSchema = z.object({
  title: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  client_id: z.string().min(1, 'Client is required'),
});

type ContainerFormData = z.infer<typeof containerSchema>;

interface Client {
  id: string;
  name: string;
  email: string;
  isManaged?: boolean;
}

interface CreateProjectContainerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preselectedClientId?: string;
}

export function CreateProjectContainerModal({
  open,
  onOpenChange,
  onSuccess,
  preselectedClientId,
}: CreateProjectContainerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients, agencyId, loading: clientsLoading } = useAgencyClients(open);

  const form = useForm<ContainerFormData>({
    resolver: zodResolver(containerSchema),
    defaultValues: {
      title: '',
      description: '',
      client_id: preselectedClientId || '',
    },
  });

  // Update client_id when preselectedClientId changes
  useEffect(() => {
    if (preselectedClientId) {
      form.setValue('client_id', preselectedClientId);
    }
  }, [preselectedClientId, form]);


  const onSubmit = async (data: ContainerFormData) => {
    if (!user || !agencyId) return;

    setIsSubmitting(true);
    try {
      const isManaged = data.client_id.startsWith('mc:');
      const realId = isManaged ? data.client_id.slice(3) : data.client_id;

      const { error } = await supabase
        .from('project_containers')
        .insert({
          title: data.title,
          description: data.description || null,
          client_id: isManaged ? null : realId,
          managed_client_id: isManaged ? realId : null,
          agency_id: agencyId,
        });

      if (error) throw error;

      toast({
        title: 'Project created',
        description: `"${data.title}" has been created. Add videos to start working.`,
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create project',
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
            <FolderPlus className="w-5 h-5 text-primary" />
            New Project
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a project container to organize videos (e.g., "Main Channel", "Shorts").
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Project Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Main Channel, Podcast Episodes"
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
                      placeholder="Brief description of this project category..."
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
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Client</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!!preselectedClientId}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-surface-elevated border-border/50">
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                      {clients.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No clients found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Project
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
