import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAgencyClients } from '@/hooks/useAgencyClients';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  CalendarIcon,
  FolderPlus,
  Upload,
  X,
  Link as LinkIcon,
  DollarSign,
  Users,
  Check,
  ChevronDown,
  Search,
  FileText,
  Paperclip,
} from 'lucide-react';
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
  editor_ids: z.array(z.string()).optional(),
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

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
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
  const [editorPickerOpen, setEditorPickerOpen] = useState(false);
  const [editorSearch, setEditorSearch] = useState('');
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
      editor_ids: [],
      budget: '',
      editor_rate: '',
      reference_links: '',
    },
  });

  const selectedClientId = form.watch('client_id');
  const selectedEditorIds = form.watch('editor_ids') || [];

  const filteredContainers = (containers || []).filter((c) => {
    if (!selectedClientId) return false;
    if (selectedClientId.startsWith('mc:')) {
      return c.managed_client_id === selectedClientId.slice(3);
    }
    return c.client_id === selectedClientId;
  });

  const selectedEditors = editors.filter((e) => selectedEditorIds.includes(e.id));
  const hasFreelanceSelected = selectedEditors.some((e) => e.employment_type === 'freelance');
  const salariedSelected = selectedEditors.filter((e) => e.employment_type === 'salaried');

  const filteredEditorList = useMemo(() => {
    const q = editorSearch.trim().toLowerCase();
    if (!q) return editors;
    return editors.filter(
      (e) => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
    );
  }, [editors, editorSearch]);

  useEffect(() => {
    if (preselectedClientId) form.setValue('client_id', preselectedClientId);
    if (preselectedContainerId) form.setValue('container_id', preselectedContainerId);
  }, [preselectedClientId, preselectedContainerId, form]);

  useEffect(() => {
    if (!preselectedContainerId && selectedClientId) {
      form.setValue('container_id', '');
    }
  }, [selectedClientId, preselectedContainerId, form]);

  const { clients, agencyId: resolvedAgencyId, loading: clientsLoading } = useAgencyClients(open);

  useEffect(() => {
    setClients(clients);
  }, [clients]);

  useEffect(() => {
    if (resolvedAgencyId) setAgencyId(resolvedAgencyId);
  }, [resolvedAgencyId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !resolvedAgencyId) return;

      try {
        const { data: editorRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('agency_id', resolvedAgencyId)
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

        const { data: containersData } = await supabase
          .from('project_containers')
          .select('id, title, client_id, managed_client_id')
          .eq('agency_id', resolvedAgencyId)
          .order('title', { ascending: true });

        setContainers(containersData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    if (open) fetchData();
  }, [user, open, resolvedAgencyId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files.map((file) => ({ file }))]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const toggleEditor = (id: string) => {
    const current = form.getValues('editor_ids') || [];
    if (current.includes(id)) {
      form.setValue('editor_ids', current.filter((x) => x !== id), { shouldDirty: true });
    } else {
      form.setValue('editor_ids', [...current, id], { shouldDirty: true });
    }
  };

  const onSubmit = async (data: VideoFormData) => {
    if (!user || !agencyId) return;

    if (isFree && !canCreateProject()) {
      setShowUpgrade(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const budgetValue = data.budget
        ? parseFloat(data.budget.replace(/[^0-9.]/g, ''))
        : null;
      const editorRateValue = data.editor_rate
        ? parseFloat(data.editor_rate.replace(/[^0-9.]/g, ''))
        : null;

      const isManaged = data.client_id.startsWith('mc:');
      const realClientId = isManaged ? null : data.client_id;
      const managedClientId = isManaged ? data.client_id.slice(3) : null;

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

      // Insert multiple editors
      const editorIds = data.editor_ids || [];
      if (editorIds.length > 0 && project) {
        const rows = editorIds.map((editor_id) => ({
          project_id: project.id,
          editor_id,
        }));
        const { error: editorError } = await supabase.from('project_editors').insert(rows);
        if (editorError) console.error('Error assigning editors:', editorError);
      }

      if (selectedFiles.length > 0 && project) {
        addToQueue(
          selectedFiles.map((f) => f.file),
          project.id,
          data.title,
          'asset'
        );
      }

      toast({
        title: 'Video created',
        description:
          selectedFiles.length > 0
            ? `"${data.title}" added. Files are uploading in the background.`
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
      setEditorSearch('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          'glass-card border-border/50 p-0 gap-0 flex flex-col overflow-hidden',
          // Mobile: near full-screen sheet feel. Desktop: comfortable modal.
          'w-[calc(100vw-1rem)] sm:w-full sm:max-w-2xl',
          'h-[92vh] sm:h-auto sm:max-h-[90vh] rounded-2xl'
        )}
      >
        {/* Sticky header */}
        <DialogHeader className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2.5 text-foreground text-lg">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <FolderPlus className="w-4.5 h-4.5 text-primary" />
            </div>
            New Video
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm pl-11.5">
            Add a new video task, assign editors, and attach assets.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              {/* SECTION 1 — Essentials */}
              <section className="space-y-4">
                <SectionLabel>Essentials</SectionLabel>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground text-sm">
                        Video title <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Episode 1 — Intro"
                          className="bg-surface-elevated border-border/50 h-11"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Client & Project — stack on mobile, split on desktop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="client_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground text-sm">
                          Client <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!!preselectedClientId}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-surface-elevated border-border/50 h-11">
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
                    name="container_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground text-sm">
                          Project <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!selectedClientId || !!preselectedContainerId}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-surface-elevated border-border/50 h-11">
                              <SelectValue
                                placeholder={
                                  selectedClientId ? 'Select project' : 'Pick client first'
                                }
                              />
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
                                No projects. Create one first.
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Due date */}
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-foreground text-sm">
                        Due date <span className="text-muted-foreground font-normal">(optional)</span>
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full justify-start text-left font-normal bg-surface-elevated border-border/50 h-11',
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
              </section>

              {/* SECTION 2 — Editors (multi-select) */}
              <section className="space-y-3">
                <SectionLabel icon={<Users className="w-3.5 h-3.5" />}>
                  Editors
                </SectionLabel>

                <FormField
                  control={form.control}
                  name="editor_ids"
                  render={() => (
                    <FormItem>
                      <Popover open={editorPickerOpen} onOpenChange={setEditorPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between bg-surface-elevated border-border/50 h-auto min-h-11 py-2 px-3"
                          >
                            <div className="flex flex-wrap gap-1.5 flex-1 items-center">
                              {selectedEditors.length === 0 ? (
                                <span className="text-muted-foreground text-sm">
                                  Assign one or more editors
                                </span>
                              ) : (
                                selectedEditors.map((e) => (
                                  <Badge
                                    key={e.id}
                                    variant="secondary"
                                    className="bg-primary/15 text-primary hover:bg-primary/25 pl-2 pr-1 py-0.5 gap-1"
                                  >
                                    {e.name}
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        toggleEditor(e.id);
                                      }}
                                      className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                    </span>
                                  </Badge>
                                ))
                              )}
                            </div>
                            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="p-0 w-[--radix-popover-trigger-width] max-w-[92vw]"
                          align="start"
                        >
                          <div className="p-2 border-b border-border/50">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                placeholder="Search editors..."
                                value={editorSearch}
                                onChange={(e) => setEditorSearch(e.target.value)}
                                className="h-9 pl-8 bg-surface-elevated border-border/50"
                              />
                            </div>
                          </div>
                          <div className="max-h-64 overflow-y-auto py-1">
                            {filteredEditorList.length === 0 ? (
                              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                                No editors match "{editorSearch}"
                              </div>
                            ) : (
                              filteredEditorList.map((e) => {
                                const checked = selectedEditorIds.includes(e.id);
                                return (
                                  <button
                                    type="button"
                                    key={e.id}
                                    onClick={() => toggleEditor(e.id)}
                                    className={cn(
                                      'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors',
                                      checked && 'bg-primary/5'
                                    )}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={() => toggleEditor(e.id)}
                                      className="pointer-events-none"
                                    />
                                    <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-medium shrink-0">
                                      {getInitials(e.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-foreground truncate">
                                        {e.name}
                                      </div>
                                      <div className="text-xs text-muted-foreground truncate">
                                        {e.email} · {e.employment_type}
                                      </div>
                                    </div>
                                    {checked && (
                                      <Check className="w-4 h-4 text-primary shrink-0" />
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                          {selectedEditorIds.length > 0 && (
                            <div className="border-t border-border/50 p-2 flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">
                                {selectedEditorIds.length} selected
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => form.setValue('editor_ids', [])}
                              >
                                Clear all
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                      {editors.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          No editors on your team yet. You can invite them from the Team page.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {salariedSelected.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40 text-xs text-muted-foreground">
                    {salariedSelected.map((e) => e.name).join(', ')}{' '}
                    {salariedSelected.length === 1 ? 'is' : 'are'} salaried — their pay isn't
                    tied to this video.
                  </div>
                )}
              </section>

              {/* SECTION 3 — Budget */}
              <section className="space-y-3">
                <SectionLabel icon={<DollarSign className="w-3.5 h-3.5" />}>
                  Budget <span className="text-muted-foreground/70 font-normal">(optional)</span>
                </SectionLabel>

                <div
                  className={cn(
                    'grid gap-4',
                    hasFreelanceSelected ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                  )}
                >
                  <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground text-sm">Project budget</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              $
                            </span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="500"
                              className="bg-surface-elevated border-border/50 pl-7 h-11"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {hasFreelanceSelected && (
                    <FormField
                      control={form.control}
                      name="editor_rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground text-sm">Editor rate</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                $
                              </span>
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="100"
                                className="bg-surface-elevated border-border/50 pl-7 h-11"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </section>

              {/* SECTION 4 — Details (description, links, files) */}
              <section className="space-y-4">
                <SectionLabel icon={<FileText className="w-3.5 h-3.5" />}>
                  Details <span className="text-muted-foreground/70 font-normal">(optional)</span>
                </SectionLabel>

                <FormItem>
                  <FormLabel className="text-foreground text-sm">Description</FormLabel>
                  <div className="min-h-[110px]">
                    <RichTextEditor
                      content={richDescription}
                      onChange={setRichDescription}
                      placeholder="Goals, context, and any specific direction..."
                    />
                  </div>
                </FormItem>

                <FormField
                  control={form.control}
                  name="reference_links"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground text-sm flex items-center gap-1.5">
                        <LinkIcon className="w-3.5 h-3.5" />
                        Reference links
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Paste one link per line — Drive folders, references, mood boards..."
                          className="bg-surface-elevated border-border/50 min-h-[70px] text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel className="text-foreground text-sm flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" />
                    Project assets
                  </FormLabel>
                  <div className="space-y-2">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border/50 rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                    >
                      <Upload className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">
                        Tap to upload files
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Video, audio, images, PDFs, documents
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

                    {selectedFiles.length > 0 && (
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                        {selectedFiles.map((fileItem, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border/30"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {fileItem.file.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(fileItem.file.size)}
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
                </FormItem>
              </section>
            </div>

            {/* Sticky footer */}
            <div className="flex-shrink-0 border-t border-border/40 px-5 py-3.5 bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-11 bg-primary hover:bg-primary/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Video'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
      <UpgradeRequiredModal
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        limitType="project"
      />
    </Dialog>
  );
}

function SectionLabel({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {children}
    </div>
  );
}
