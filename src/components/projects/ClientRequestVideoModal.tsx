import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useUploadContext } from '@/contexts/UploadContext';
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
import { Loader2, Video, Upload, X, FileVideo, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const videoRequestSchema = z.object({
  title: z.string().min(1, 'Video title is required'),
  description: z.string().optional(),
  container_id: z.string().min(1, 'Please select a project'),
  reference_links: z.string().optional(),
});

type VideoRequestFormData = z.infer<typeof videoRequestSchema>;

interface ProjectContainer {
  id: string;
  title: string;
}

interface ClientRequestVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ClientRequestVideoModal({
  open,
  onOpenChange,
  onSuccess,
}: ClientRequestVideoModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [containers, setContainers] = useState<ProjectContainer[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const { addToQueue } = useUploadContext();

  const form = useForm<VideoRequestFormData>({
    resolver: zodResolver(videoRequestSchema),
    defaultValues: {
      title: '',
      description: '',
      container_id: '',
      reference_links: '',
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setSelectedFiles(prev => [...prev, ...Array.from(files)]);
    }
    e.target.value = ''; // Reset input
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

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

      // Create video (project) with 'request' status for admin approval
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          title: data.title,
          description: data.description || null,
          client_id: user.id,
          agency_id: userRole.agency_id,
          status: 'request',
          container_id: data.container_id,
          reference_links: data.reference_links || null,
        })
        .select('id')
        .single();

      if (projectError) throw projectError;

      // Queue asset uploads if any files selected
      if (selectedFiles.length > 0 && newProject?.id) {
        await addToQueue(selectedFiles, newProject.id, data.title, 'asset');
      }

      toast({
        title: 'Video request submitted',
        description: `"${data.title}" has been sent to your agency for approval.${selectedFiles.length > 0 ? ' Assets are uploading in the background.' : ''}`,
      });

      form.reset();
      setSelectedFiles([]);
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
      setSelectedFiles([]);
      onOpenChange(false);
    }
  };

  const noProjects = !loadingContainers && containers.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-border/50 sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Video className="w-5 h-5 text-primary" />
            Request New Video
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Submit a video request for your agency to review and approve.
          </DialogDescription>
        </DialogHeader>

        {noProjects ? (
          <Alert className="border-warning/30 bg-warning/5">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-foreground">
              <span className="font-medium">No projects available.</span><br />
              Please contact your admin to create a Project folder before requesting videos.
            </AlertDescription>
          </Alert>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="container_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Select Project</FormLabel>
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
                        {containers.map((container) => (
                          <SelectItem key={container.id} value={container.id}>
                            {container.title}
                          </SelectItem>
                        ))}
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
                        placeholder="Brief description, notes, or instructions for this video..."
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
                name="reference_links"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">
                      Reference Links <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Paste any reference URLs (one per line)&#10;https://youtube.com/example&#10;https://drive.google.com/..."
                        className="bg-surface-elevated border-border/50 min-h-[60px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Asset Upload Section */}
              <div className="space-y-3">
                <FormLabel className="text-foreground">
                  Upload Assets <span className="text-muted-foreground font-normal">(optional)</span>
                </FormLabel>
                
                <div className="border-2 border-dashed border-border/50 rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                      accept="video/*,audio/*,image/*,.zip,.rar,.7z"
                    />
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        <span className="text-primary font-medium">Click to upload</span> raw footage, scripts, or assets
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Video, audio, images, or archives
                      </p>
                    </div>
                  </label>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/50"
                      >
                        <FileVideo className="w-5 h-5 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0"
                          onClick={() => removeFile(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
                  className="flex-1"
                  disabled={isSubmitting || noProjects}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
