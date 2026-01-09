import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CalendarIcon, DollarSign, Users, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { RichTextDisplay } from '@/components/ui/rich-text-editor';
import { Checkbox } from '@/components/ui/checkbox';

interface Person {
  id: string;
  name: string;
  email: string;
}

interface ProposalData {
  id: string;
  title: string;
  description: string | null;
  client_id: string | null;
  client_name?: string;
  due_date: string | null;
  created_at: string;
}

const reviewSchema = z.object({
  budget: z.string().min(1, 'Budget is required'),
  editor_rate: z.string().optional(),
  due_date: z.date().optional(),
  editor_ids: z.array(z.string()).optional(),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface ProposalReviewSheetProps {
  proposal: ProposalData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ProposalReviewSheet({
  proposal,
  open,
  onOpenChange,
  onSuccess,
}: ProposalReviewSheetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editors, setEditors] = useState<Person[]>([]);
  const [selectedEditorIds, setSelectedEditorIds] = useState<string[]>([]);
  const { toast } = useToast();

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      budget: '',
      editor_rate: '',
    },
  });

  // Fetch editors on open
  useEffect(() => {
    const fetchEditors = async () => {
      if (!proposal || !open) return;

      try {
        // Get agency_id from proposal's client
        const { data: projectData } = await supabase
          .from('projects')
          .select('agency_id')
          .eq('id', proposal.id)
          .single();

        if (!projectData?.agency_id) return;

        // Get editors
        const { data: editorRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('agency_id', projectData.agency_id)
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
              name: p.full_name || p.email,
              email: p.email,
            }))
          );
        }
      } catch (error) {
        console.error('Error fetching editors:', error);
      }
    };

    fetchEditors();
  }, [proposal, open]);

  // Reset form when proposal changes
  useEffect(() => {
    if (proposal && open) {
      form.reset({
        budget: '',
        editor_rate: '',
        due_date: proposal.due_date ? new Date(proposal.due_date) : undefined,
      });
      setSelectedEditorIds([]);
    }
  }, [proposal, open, form]);

  const handleAccept = async (data: ReviewFormData) => {
    if (!proposal) return;

    setIsSubmitting(true);
    try {
      // Update project with budget and change status to backlog
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          status: 'backlog',
          budget: Number(data.budget),
          editor_rate: data.editor_rate ? Number(data.editor_rate) : null,
          due_date: data.due_date?.toISOString() || null,
        })
        .eq('id', proposal.id);

      if (updateError) throw updateError;

      // Assign editors if any selected
      if (selectedEditorIds.length > 0) {
        const editorInserts = selectedEditorIds.map(editorId => ({
          project_id: proposal.id,
          editor_id: editorId,
        }));

        const { error: editorError } = await supabase
          .from('project_editors')
          .insert(editorInserts);

        if (editorError) {
          console.error('Error assigning editors:', editorError);
        }
      }

      toast({
        title: 'Proposal accepted',
        description: `"${proposal.title}" has been moved to Backlog.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept proposal',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!proposal) return;

    setIsSubmitting(true);
    try {
      // Delete or mark as cancelled
      const { error } = await supabase
        .from('projects')
        .update({ status: 'cancelled' })
        .eq('id', proposal.id);

      if (error) throw error;

      toast({
        title: 'Proposal rejected',
        description: `"${proposal.title}" has been declined.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject proposal',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleEditor = (editorId: string) => {
    setSelectedEditorIds(prev =>
      prev.includes(editorId)
        ? prev.filter(id => id !== editorId)
        : [...prev, editorId]
    );
  };

  if (!proposal) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
              Proposal
            </Badge>
          </div>
          <SheetTitle className="text-xl">{proposal.title}</SheetTitle>
          <SheetDescription>
            From: {proposal.client_name || 'Unknown Client'} • 
            Submitted {format(new Date(proposal.created_at), 'MMM d, yyyy')}
          </SheetDescription>
        </SheetHeader>

        {/* Project Description */}
        {proposal.description && (
          <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border/50">
            <h4 className="text-sm font-medium text-foreground mb-2">Project Requirements</h4>
            <RichTextDisplay content={proposal.description} />
          </div>
        )}

        {proposal.due_date && (
          <div className="mb-6 p-3 bg-muted/30 rounded-lg border border-border/50">
            <p className="text-sm text-muted-foreground">
              Desired completion: <span className="text-foreground font-medium">
                {format(new Date(proposal.due_date), 'MMMM d, yyyy')}
              </span>
            </p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleAccept)} className="space-y-4">
            <FormField
              control={form.control}
              name="budget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Project Price (for Client)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0.00"
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
              name="editor_rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Editor Rate <span className="text-muted-foreground">(internal)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0.00"
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
              name="due_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Final Due Date</FormLabel>
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
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Multi-Editor Assignment */}
            <div className="space-y-3">
              <FormLabel className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Assign Editors
              </FormLabel>
              <div className="space-y-2 max-h-40 overflow-y-auto p-3 bg-muted/20 rounded-lg border border-border/50">
                {editors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No editors available</p>
                ) : (
                  editors.map(editor => (
                    <label
                      key={editor.id}
                      className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <Checkbox
                        checked={selectedEditorIds.includes(editor.id)}
                        onCheckedChange={() => toggleEditor(editor.id)}
                      />
                      <span className="text-sm text-foreground">{editor.name}</span>
                      <span className="text-xs text-muted-foreground">{editor.email}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleReject}
                disabled={isSubmitting}
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-success hover:bg-success/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Accept & Set Price
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
