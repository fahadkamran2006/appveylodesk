import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, User, DollarSign, Briefcase } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type EmploymentType = Database['public']['Enums']['employment_type'];

const editorSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  employment_type: z.enum(['freelance', 'salaried']),
  monthly_salary: z.string().optional(),
});

type EditorFormData = z.infer<typeof editorSchema>;

interface EditEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor: {
    id: string;
    full_name: string | null;
    email: string;
    employment_type: EmploymentType;
    monthly_salary: number | null;
  } | null;
  onSuccess?: () => void;
}

export function EditEditorModal({
  open,
  onOpenChange,
  editor,
  onSuccess,
}: EditEditorModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<EditorFormData>({
    resolver: zodResolver(editorSchema),
    defaultValues: {
      full_name: '',
      employment_type: 'freelance',
      monthly_salary: '',
    },
  });

  const employmentType = form.watch('employment_type');

  // Update form when editor changes
  useEffect(() => {
    if (editor) {
      form.reset({
        full_name: editor.full_name || '',
        employment_type: editor.employment_type || 'freelance',
        monthly_salary: editor.monthly_salary?.toString() || '',
      });
    }
  }, [editor, form]);

  const onSubmit = async (data: EditorFormData) => {
    if (!editor) return;

    setIsSubmitting(true);
    try {
      const salaryValue = data.employment_type === 'salaried' && data.monthly_salary
        ? parseFloat(data.monthly_salary.replace(/[^0-9.]/g, ''))
        : null;

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          employment_type: data.employment_type as EmploymentType,
          monthly_salary: salaryValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editor.id);

      if (error) throw error;

      toast({
        title: 'Editor updated',
        description: 'Compensation settings have been saved.',
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update editor',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <User className="w-5 h-5 text-primary" />
            Edit Editor
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update editor profile and compensation settings.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Full Name */}
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Editor name"
                      className="bg-surface-elevated border-border/50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Compensation Mode */}
            <FormField
              control={form.control}
              name="employment_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Compensation Mode
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-surface-elevated border-border/50">
                        <SelectValue placeholder="Select compensation type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="freelance">
                        <div className="flex flex-col">
                          <span>Freelance</span>
                          <span className="text-xs text-muted-foreground">Paid per video/project</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="salaried">
                        <div className="flex flex-col">
                          <span>Salaried</span>
                          <span className="text-xs text-muted-foreground">Fixed monthly rate + bonuses</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Monthly Salary (only for salaried) */}
            {employmentType === 'salaried' && (
              <FormField
                control={form.control}
                name="monthly_salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Monthly Base Salary
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          type="text"
                          placeholder="e.g., 3000"
                          className="bg-surface-elevated border-border/50 pl-7"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
