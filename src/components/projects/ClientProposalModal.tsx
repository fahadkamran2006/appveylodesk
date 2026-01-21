import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useStorage } from '@/hooks/useStorage';
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
import { Progress } from '@/components/ui/progress';
import { Loader2, CalendarIcon, FileText, Upload, X, Link as LinkIcon, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { RichTextEditor } from '@/components/ui/rich-text-editor';

const proposalSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  due_date: z.date().optional(),
  reference_links: z.string().optional(),
  proposed_budget: z.string().optional(),
});

type ProposalFormData = z.infer<typeof proposalSchema>;

interface UploadedFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface ClientProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ClientProposalModal({
  open,
  onOpenChange,
  onSuccess,
}: ClientProposalModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [richDescription, setRichDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<UploadedFile[]>([]);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, session } = useAuth();
  const { toast } = useToast();
  const { uploadDeliverable } = useStorage();

  const form = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      title: '',
      description: '',
      reference_links: '',
      proposed_budget: '',
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles = files.map(file => ({
      file,
      progress: 0,
      status: 'pending' as const,
    }));
    setSelectedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFilesToProject = async (projectId: string) => {
    for (let i = 0; i < selectedFiles.length; i++) {
      const fileItem = selectedFiles[i];
      
      // Update status to uploading
      setSelectedFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'uploading' as const } : f
      ));

      try {
        await uploadDeliverable(
          projectId,
          fileItem.file,
          (progress) => {
            setSelectedFiles(prev => prev.map((f, idx) => 
              idx === i ? { ...f, progress } : f
            ));
          }
        );
        
        // Update status to complete
        setSelectedFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'complete' as const, progress: 100 } : f
        ));
      } catch (error: any) {
        setSelectedFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'error' as const, error: error.message } : f
        ));
      }
    }
  };

  const onSubmit = async (data: ProposalFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Get agency_id for this client
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRole?.agency_id) {
        throw new Error('No agency found');
      }

      // Parse budget if provided
      const budgetValue = data.proposed_budget 
        ? parseFloat(data.proposed_budget.replace(/[^0-9.]/g, ''))
        : null;

      // Create project as proposal
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          title: data.title,
          description: richDescription || data.description || null,
          client_id: user.id,
          agency_id: userRole.agency_id,
          status: 'proposal',
          due_date: data.due_date?.toISOString() || null,
          reference_links: data.reference_links || null,
          budget: budgetValue,
        })
        .select('id')
        .single();

      if (projectError) throw projectError;

      setCreatedProjectId(newProject.id);

      // Upload files if any selected
      if (selectedFiles.length > 0) {
        await uploadFilesToProject(newProject.id);
      }

      toast({
        title: 'Proposal submitted',
        description: 'Your project proposal has been sent to the agency for review.',
      });

      form.reset();
      setRichDescription('');
      setSelectedFiles([]);
      setCreatedProjectId(null);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit proposal',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset();
      setRichDescription('');
      setSelectedFiles([]);
      setCreatedProjectId(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-border/50 sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileText className="w-5 h-5 text-primary" />
            Submit Project Proposal
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Describe your project requirements. The agency will review and provide a quote.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Project Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Product Launch Video"
                      className="bg-surface-elevated border-border/50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel className="text-foreground">Project Details</FormLabel>
              <RichTextEditor
                content={richDescription}
                onChange={setRichDescription}
                placeholder="Describe your project requirements, goals, and any specific details..."
              />
            </FormItem>

            {/* Reference Links */}
            <FormField
              control={form.control}
              name="reference_links"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    Reference Links <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paste external links here (one per line)&#10;e.g., Google Drive folder, reference videos, mood boards..."
                      className="bg-surface-elevated border-border/50 min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File Uploads */}
            <FormItem>
              <FormLabel className="text-foreground flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Project Assets <span className="text-muted-foreground font-normal">(optional)</span>
              </FormLabel>
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border/50 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                >
                  <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload raw footage, scripts, voiceovers, or other assets
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports video, audio, images, PDFs, and documents
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="video/*,audio/*,image/*,.pdf,.doc,.docx,.txt"
                />
                
                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    {selectedFiles.map((fileItem, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/30"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(fileItem.file.size)}
                            {fileItem.status === 'uploading' && ` • Uploading ${fileItem.progress}%`}
                            {fileItem.status === 'complete' && ' • Uploaded'}
                            {fileItem.status === 'error' && ` • ${fileItem.error}`}
                          </p>
                          {fileItem.status === 'uploading' && (
                            <Progress value={fileItem.progress} className="h-1 mt-1" />
                          )}
                        </div>
                        {fileItem.status === 'pending' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeFile(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FormItem>

            {/* Proposed Budget */}
            <FormField
              control={form.control}
              name="proposed_budget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Proposed Budget <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        type="text"
                        placeholder="e.g., 500"
                        className="bg-surface-elevated border-border/50 pl-7"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Enter your budget offer. The agency may adjust this in their quote.
                  </p>
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
                    Desired Completion Date <span className="text-muted-foreground">(optional)</span>
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
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {selectedFiles.length > 0 ? 'Uploading...' : 'Submitting...'}
                  </>
                ) : (
                  'Submit Proposal'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
