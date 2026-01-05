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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, CalendarIcon, FolderPlus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const projectSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  client_id: z.string().optional(),
  editor_id: z.string().optional(),
  due_date: z.date().optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface Person {
  id: string;
  name: string;
  email: string;
}

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateProjectModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateProjectModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Person[]>([]);
  const [editors, setEditors] = useState<Person[]>([]);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  });

  // Fetch clients and editors
  useEffect(() => {
    const fetchPeople = async () => {
      if (!user) return;

      try {
        // Get agency_id
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('agency_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!userRole?.agency_id) return;
        setAgencyId(userRole.agency_id);

        // Get clients
        const { data: clientRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('agency_id', userRole.agency_id)
          .eq('role', 'client');

        if (clientRoles && clientRoles.length > 0) {
          const clientIds = clientRoles.map((r) => r.user_id);
          const { data: clientProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', clientIds);

          setClients(
            (clientProfiles || []).map((p) => ({
              id: p.id,
              name: p.full_name || p.email,
              email: p.email,
            }))
          );
        }

        // Get editors
        const { data: editorRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('agency_id', userRole.agency_id)
          .eq('role', 'editor');

        if (editorRoles && editorRoles.length > 0) {
          const editorIds = editorRoles.map((r) => r.user_id);
          const { data: editorProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', editorIds);

          setEditors(
            (editorProfiles || []).map((p) => ({
              id: p.id,
              name: p.full_name || p.email,
              email: p.email,
            }))
          );
        }
      } catch (error) {
        console.error('Error fetching people:', error);
      }
    };

    if (open) {
      fetchPeople();
    }
  }, [user, open]);

  const onSubmit = async (data: ProjectFormData) => {
    if (!user || !agencyId) return;

    setIsSubmitting(true);
    try {
      // Insert project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          title: data.title,
          description: data.description || null,
          client_id: data.client_id || null,
          agency_id: agencyId,
          status: 'backlog',
          due_date: data.due_date?.toISOString() || null,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // If editor is assigned, add to project_editors
      if (data.editor_id && project) {
        const { error: editorError } = await supabase
          .from('project_editors')
          .insert({
            project_id: project.id,
            editor_id: data.editor_id,
          });

        if (editorError) {
          console.error('Error assigning editor:', editorError);
        }
      }

      toast({
        title: 'Project created',
        description: `"${data.title}" has been added to Backlog`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FolderPlus className="w-5 h-5 text-primary" />
            New Project
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a new project and assign it to your team.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Project title"
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
                    Description{' '}
                    <span className="text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief project description..."
                      className="bg-surface-elevated border-border/50 resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">
                      Assigned Client
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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

              <FormField
                control={form.control}
                name="editor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">
                      Assigned Editor
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-surface-elevated border-border/50">
                          <SelectValue placeholder="Select editor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {editors.map((editor) => (
                          <SelectItem key={editor.id} value={editor.id}>
                            {editor.name}
                          </SelectItem>
                        ))}
                        {editors.length === 0 && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No editors found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-foreground">Due Date</FormLabel>
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
                          {field.value
                            ? format(field.value, 'PPP')
                            : 'Pick a date'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
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
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Project'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}