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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CalendarIcon, Edit3, Link as LinkIcon, DollarSign, Users, User } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { RichTextEditor } from '@/components/ui/rich-text-editor';

const editProjectSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  due_date: z.date().optional().nullable(),
  reference_links: z.string().optional(),
  budget: z.string().optional(),
  editor_rate: z.string().optional(),
  client_id: z.string().optional(),
  status: z.string().optional(),
});

type EditProjectFormData = z.infer<typeof editProjectSchema>;

interface Person {
  id: string;
  name: string;
  email: string;
}

interface ProjectData {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  reference_links: string | null;
  budget: number | null;
  editor_rate: number | null;
  client_id: string | null;
  status: string;
  agency_id: string;
}

interface ProjectEditModalProps {
  project: ProjectData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const STATUS_OPTIONS = [
  { value: 'proposal', label: 'Proposal' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function ProjectEditModal({
  project,
  open,
  onOpenChange,
  onSuccess,
}: ProjectEditModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [richDescription, setRichDescription] = useState('');
  const [clients, setClients] = useState<Person[]>([]);
  const [editors, setEditors] = useState<Person[]>([]);
  const [selectedEditorIds, setSelectedEditorIds] = useState<string[]>([]);
  const [currentEditorIds, setCurrentEditorIds] = useState<string[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<EditProjectFormData>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: {
      title: '',
      description: '',
      reference_links: '',
      budget: '',
      editor_rate: '',
      client_id: '',
      status: 'backlog',
    },
  });

  // Fetch clients and editors when modal opens
  useEffect(() => {
    const fetchPeople = async () => {
      if (!open || !project) return;

      try {
        // Fetch clients
        const { data: clientRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('agency_id', project.agency_id)
          .eq('role', 'client');

        if (clientRoles && clientRoles.length > 0) {
          const clientIds = clientRoles.map(r => r.user_id);
          const { data: clientProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', clientIds);

          setClients(
            (clientProfiles || []).map(p => ({
              id: p.id,
              name: p.full_name || p.email || 'Unknown',
              email: p.email || '',
            }))
          );
        }

        // Fetch editors
        const { data: editorRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('agency_id', project.agency_id)
          .eq('role', 'editor');

        if (editorRoles && editorRoles.length > 0) {
          const editorIds = editorRoles.map(r => r.user_id);
          const { data: editorProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', editorIds);

          setEditors(
            (editorProfiles || []).map(p => ({
              id: p.id,
              name: p.full_name || p.email || 'Unknown',
              email: p.email || '',
            }))
          );
        }

        // Fetch current editors assigned to project
        const { data: projectEditors } = await supabase
          .from('project_editors')
          .select('editor_id')
          .eq('project_id', project.id);

        const editorIdList = (projectEditors || []).map(pe => pe.editor_id);
        setCurrentEditorIds(editorIdList);
        setSelectedEditorIds(editorIdList);
      } catch (error) {
        console.error('Error fetching people:', error);
      }
    };

    fetchPeople();
  }, [open, project]);

  // Reset form when project changes
  useEffect(() => {
    if (project && open) {
      form.reset({
        title: project.title,
        description: project.description || '',
        due_date: project.due_date ? new Date(project.due_date) : undefined,
        reference_links: project.reference_links || '',
        budget: project.budget?.toString() || '',
        editor_rate: project.editor_rate?.toString() || '',
        client_id: project.client_id || '',
        status: project.status,
      });
      setRichDescription(project.description || '');
    }
  }, [project, open, form]);

  const toggleEditor = (editorId: string) => {
    setSelectedEditorIds(prev =>
      prev.includes(editorId)
        ? prev.filter(id => id !== editorId)
        : [...prev, editorId]
    );
  };

  const onSubmit = async (data: EditProjectFormData) => {
    if (!user || !project) return;

    setIsSubmitting(true);
    try {
      // Parse numeric values
      const budgetValue = data.budget ? parseFloat(data.budget.replace(/[^0-9.]/g, '')) : null;
      const editorRateValue = data.editor_rate ? parseFloat(data.editor_rate.replace(/[^0-9.]/g, '')) : null;

      // Update project
      const { error: projectError } = await supabase
        .from('projects')
        .update({
          title: data.title,
          description: richDescription || data.description || null,
          due_date: data.due_date?.toISOString() || null,
          reference_links: data.reference_links || null,
          budget: budgetValue,
          editor_rate: editorRateValue,
          client_id: data.client_id || null,
          status: data.status as any,
        })
        .eq('id', project.id);

      if (projectError) throw projectError;

      // Handle editor assignments
      const editorsToRemove = currentEditorIds.filter(id => !selectedEditorIds.includes(id));
      const editorsToAdd = selectedEditorIds.filter(id => !currentEditorIds.includes(id));

      // Remove unassigned editors
      if (editorsToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('project_editors')
          .delete()
          .eq('project_id', project.id)
          .in('editor_id', editorsToRemove);

        if (removeError) throw removeError;
      }

      // Add new editors
      if (editorsToAdd.length > 0) {
        const { error: addError } = await supabase
          .from('project_editors')
          .insert(
            editorsToAdd.map(editorId => ({
              project_id: project.id,
              editor_id: editorId,
            }))
          );

        if (addError) throw addError;
      }

      toast({
        title: 'Project updated',
        description: 'Project details have been saved successfully.',
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update project',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Edit3 className="w-5 h-5 text-primary" />
            Edit Project
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update project details, assignments, and pricing.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Project Title</FormLabel>
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

            {/* Description */}
            <FormItem>
              <FormLabel className="text-foreground">Description</FormLabel>
              <RichTextEditor
                content={richDescription}
                onChange={setRichDescription}
                placeholder="Project description..."
              />
            </FormItem>

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-surface-elevated border-border/50">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_OPTIONS.map(status => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reference Links */}
            <FormField
              control={form.control}
              name="reference_links"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    Reference Links
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="External links (one per line)"
                      className="bg-surface-elevated border-border/50 min-h-[60px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Budget & Editor Rate */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Client Budget
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          type="text"
                          placeholder="0.00"
                          className="bg-surface-elevated border-border/50 pl-7"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="editor_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Editor Rate
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          type="text"
                          placeholder="0.00"
                          className="bg-surface-elevated border-border/50 pl-7"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Due Date */}
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
                          {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Client Assignment */}
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Assigned Client
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger className="bg-surface-elevated border-border/50">
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">No client assigned</SelectItem>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Editor Assignment */}
            <FormItem>
              <FormLabel className="text-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Assigned Editors
              </FormLabel>
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/30 max-h-[150px] overflow-y-auto">
                {editors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No editors available</p>
                ) : (
                  editors.map(editor => (
                    <div key={editor.id} className="flex items-center gap-3">
                      <Checkbox
                        id={`editor-${editor.id}`}
                        checked={selectedEditorIds.includes(editor.id)}
                        onCheckedChange={() => toggleEditor(editor.id)}
                      />
                      <label
                        htmlFor={`editor-${editor.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {editor.name}
                        <span className="text-xs text-muted-foreground ml-2">{editor.email}</span>
                      </label>
                    </div>
                  ))
                )}
              </div>
            </FormItem>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
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
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
