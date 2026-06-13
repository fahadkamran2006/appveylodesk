import { useState, useEffect, useRef } from 'react';
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
import { Loader2, CalendarIcon, FolderPlus, Upload, X, Link as LinkIcon, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { UpgradeRequiredModal } from '@/components/UpgradeRequiredModal';
import { useAgencyLimits } from '@/hooks/useAgencyLimits';

const videoSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  client_id: z.string().min(1, 'Client is required'),
  container_id: z.string().min(1, 'Project is required'),
  editor_id: z.string().optional(),
  due_date: z.date().optional(),
  budget: z.string().optional(),
  editor_rate: z.string().optional(),
  reference_links: z.string().optional(),
});

type VideoFormData = z.infer<typeof videoSchema>;

interface Person {
  id: string;
  name: string;
  email: string;
  isManaged?: boolean;
}

interface Editor {
  id: string;
  name: string;
  email: string;
  employment_type: 'freelance' | 'salaried';
}

interface ProjectContainer {
  id: string;
  title: string;
  client_id: string | null;
  managed_client_id: string | null;
}

interface SelectedFile {
  file: File;
}

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preselectedClientId?: string;
  preselectedContainerId?: string;
}

export function CreateProjectModal({
  open,
  onOpenChange,
  onSuccess,
  preselectedClientId,
  preselectedContainerId,
}: CreateProjectModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [clients, setClients] = useState<Person[]>([]);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [containers, setContainers] = useState<ProjectContainer[]>();
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [richDescription, setRichDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { addToQueue } = useUploadContext();
  const { isFree, canCreateProject, refetch: refetchLimits } = useAgencyLimits();

  const form = useForm<VideoFormData>({
    resolver: zodResolver(videoSchema),
    defaultValues: {
      title: '',
      description: '',
      client_id: preselectedClientId || '',
      container_id: preselectedContainerId || '',
      budget: '',
      editor_rate: '',
      reference_links: '',
    },
  });

  // Watch client_id to filter containers
  const selectedClientId = form.watch('client_id');
  const selectedEditorId = form.watch('editor_id');

  // Filter containers by selected client (handles both real & managed)
  const filteredContainers = (containers || []).filter((c) => {
    if (!selectedClientId) return false;
    if (selectedClientId.startsWith('mc:')) {
      return c.managed_client_id === selectedClientId.slice(3);
    }
    return c.client_id === selectedClientId;
  });

  // Check if selected editor is salaried
  const selectedEditor = editors.find(e => e.id === selectedEditorId);
  const isEditorSalaried = selectedEditor?.employment_type === 'salaried';

  // Update form values when preselected props change
  useEffect(() => {
    if (preselectedClientId) {
      form.setValue('client_id', preselectedClientId);
    }
    if (preselectedContainerId) {
      form.setValue('container_id', preselectedContainerId);
    }
  }, [preselectedClientId, preselectedContainerId, form]);

  // Reset container when client changes (unless it's preselected)
  useEffect(() => {
    if (!preselectedContainerId && selectedClientId) {
      form.setValue('container_id', '');
    }
  }, [selectedClientId, preselectedContainerId, form]);

  // Fetch clients, editors, and project containers
  useEffect(() => {
    const fetchData = async () => {
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

        // Get real clients
        const { data: clientRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('agency_id', userRole.agency_id)
          .eq('role', 'client');

        const allClients: Person[] = [];
        if (clientRoles && clientRoles.length > 0) {
          const clientIds = clientRoles.map((r) => r.user_id);
          const { data: clientProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', clientIds);
          for (const p of clientProfiles || []) {
            allClients.push({ id: p.id, name: p.full_name || p.email, email: p.email });
          }
        }

        // Get managed (non-activated) clients
        const { data: managed } = await supabase
          .from('managed_clients')
          .select('id, full_name, email')
          .eq('agency_id', userRole.agency_id)
          .is('activated_at', null);

        for (const m of managed || []) {
          allClients.push({
            id: `mc:${m.id}`,
            name: (m.full_name || m.email) + ' (Manual)',
            email: m.email,
            isManaged: true,
          });
        }
        setClients(allClients);

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
            .select('id, full_name, email, employment_type')
            .in('id', editorIds);

          setEditors(
            (editorProfiles || []).map((p) => ({
              id: p.id,
              name: p.full_name || p.email,
              email: p.email,
              employment_type: (p.employment_type as 'freelance' | 'salaried') || 'freelance',
            }))
          );
        }

        // Get project containers (with both client links)
        const { data: containersData } = await supabase
          .from('project_containers')
          .select('id, title, client_id, managed_client_id')
          .eq('agency_id', userRole.agency_id)
          .order('title', { ascending: true });

        setContainers(containersData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    if (open) {
      fetchData();
    }
  }, [user, open]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles = files.map(file => ({ file }));
    setSelectedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const queueFilesForProject = (projectId: string, projectTitle: string) => {
    if (selectedFiles.length === 0) return;
    const files = selectedFiles.map(f => f.file);
    addToQueue(files, projectId, projectTitle, 'asset');
  };

  const onSubmit = async (data: VideoFormData) => {
    if (!user || !agencyId) return;

    // Front-end gate: free plan = max 1 active project
    if (isFree && !canCreateProject()) {
      setShowUpgrade(true);
      return;
    }

    setIsSubmitting(true);
    try {
      // Parse budget values
      const budgetValue = data.budget 
        ? parseFloat(data.budget.replace(/[^0-9.]/g, ''))
        : null;
      const editorRateValue = data.editor_rate
        ? parseFloat(data.editor_rate.replace(/[^0-9.]/g, ''))
        : null;

      // Resolve client (real vs managed)
      const isManaged = data.client_id.startsWith('mc:');
      const realClientId = isManaged ? null : data.client_id;
      const managedClientId = isManaged ? data.client_id.slice(3) : null;

      // Insert video (project) with container_id linking it to a project container
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          title: data.title,
          description: richDescription || data.description || null,
          client_id: realClientId,
          managed_client_id: managedClientId,
          container_id: data.container_id,
          agency_id: agencyId,
          status: 'backlog',
          due_date: data.due_date?.toISOString() || null,
          budget: budgetValue,
          editor_rate: editorRateValue,
          reference_links: data.reference_links || null,
        })
        .select()
        .single();

      if (projectError) {
        if (projectError.message?.includes('FREE_PLAN_PROJECT_LIMIT')) {
          setShowUpgrade(true);
          setIsSubmitting(false);
          return;
        }
        throw projectError;
      }

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

      // Queue files for upload
      if (selectedFiles.length > 0 && project) {
        queueFilesForProject(project.id, data.title);
      }

      toast({
        title: 'Video created',
        description: selectedFiles.length > 0 
          ? `"${data.title}" has been added to Backlog. Files are uploading in the background.`
          : `"${data.title}" has been added to Backlog`,
      });

      form.reset();
      setRichDescription('');
      setSelectedFiles([]);
      onOpenChange(false);
      onSuccess?.();
      refetchLimits();
    } catch (error: any) {
      if (error.message?.includes('FREE_PLAN_PROJECT_LIMIT')) {
        setShowUpgrade(true);
        return;
      }
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
      setRichDescription('');
      setSelectedFiles([]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-border/50 sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FolderPlus className="w-5 h-5 text-primary" />
            New Video
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a new video task and assign it to a project and editor.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Video Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Episode 1, Intro Video"
                      className="bg-surface-elevated border-border/50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Rich Description */}
            <FormItem>
              <FormLabel className="text-foreground">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </FormLabel>
              <div className="min-h-[120px]">
                <RichTextEditor
                  content={richDescription}
                  onChange={setRichDescription}
                  placeholder="Project description, goals, and any specific details..."
                />
              </div>
            </FormItem>

            {/* Client & Project Selection (Cascading) */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">
                      Client <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!!preselectedClientId}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-surface-elevated border-border/50">
                          <SelectValue placeholder="Select client first" />
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
                name="container_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">
                      Project <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!selectedClientId || !!preselectedContainerId}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-surface-elevated border-border/50">
                          <SelectValue placeholder={selectedClientId ? "Select project" : "Select client first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredContainers.map((container) => (
                          <SelectItem key={container.id} value={container.id}>
                            {container.title}
                          </SelectItem>
                        ))}
                        {filteredContainers.length === 0 && selectedClientId && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No projects for this client. Create one first.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Editor Assignment */}
            <FormField
              control={form.control}
              name="editor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">
                    Assigned Editor <span className="text-muted-foreground font-normal">(optional)</span>
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

            {/* Budget & Editor Rate */}
            <div className={isEditorSalaried ? '' : 'grid grid-cols-2 gap-4'}>
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Project Budget <span className="text-muted-foreground font-normal">(optional)</span>
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Only show editor rate for freelance editors */}
              {!isEditorSalaried && (
                <FormField
                  control={form.control}
                  name="editor_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Editor Rate <span className="text-muted-foreground font-normal">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            type="text"
                            placeholder="e.g., 100"
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
              {isEditorSalaried && (
                <div className="mt-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{selectedEditor?.name}</span> is a salaried employee. 
                    Their pay is not tied to individual videos.
                  </p>
                </div>
              )}
            </div>

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
              <div className="space-y-2">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border/50 rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                >
                  <Upload className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload raw footage, scripts, voiceovers
                  </p>
                  <p className="text-xs text-muted-foreground">
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
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                    {selectedFiles.map((fileItem, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(fileItem.file.size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => removeFile(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FormItem>

            {/* Due Date */}
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-foreground">
                    Due Date <span className="text-muted-foreground font-normal">(optional)</span>
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
                    {selectedFiles.length > 0 ? 'Creating...' : 'Creating...'}
                  </>
                ) : (
                  'Create Video'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
