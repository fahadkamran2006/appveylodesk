import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, LayoutGrid, List, Filter, X, User } from 'lucide-react';
import { ProjectStatus } from './KanbanColumn';
import { cn } from '@/lib/utils';

export type ViewMode = 'kanban' | 'list';

interface Client {
  id: string;
  name: string;
}

interface Editor {
  id: string;
  name: string;
}

interface ProjectFiltersProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: ProjectStatus | 'all';
  onStatusFilterChange: (status: ProjectStatus | 'all') => void;
  clientFilter: string | 'all';
  onClientFilterChange: (clientId: string | 'all') => void;
  editorFilter: string | 'all' | 'my_work';
  onEditorFilterChange: (editorId: string | 'all' | 'my_work') => void;
  clients: Client[];
  editors: Editor[];
  currentUserId?: string;
  showArchived?: boolean;
  onShowArchivedChange?: (show: boolean) => void;
}

const STATUS_OPTIONS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'proposal', label: 'Proposals' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
  { value: 'paid', label: 'Paid' },
  { value: 'archived', label: 'Archived' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function ProjectFilters({
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  clientFilter,
  onClientFilterChange,
  editorFilter,
  onEditorFilterChange,
  clients,
  editors,
  currentUserId,
  showArchived,
  onShowArchivedChange,
}: ProjectFiltersProps) {
  const hasActiveFilters = 
    statusFilter !== 'all' || 
    clientFilter !== 'all' || 
    editorFilter !== 'all' ||
    searchQuery.length > 0;

  const clearFilters = () => {
    onSearchChange('');
    onStatusFilterChange('all');
    onClientFilterChange('all');
    onEditorFilterChange('all');
  };

  return (
    <div className="space-y-4">
      {/* Top Row: Search + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-3 gap-2",
              viewMode === 'kanban' && "bg-background shadow-sm"
            )}
            onClick={() => onViewModeChange('kanban')}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Board</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-3 gap-2",
              viewMode === 'list' && "bg-background shadow-sm"
            )}
            onClick={() => onViewModeChange('list')}
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">List</span>
          </Button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />

        {/* My Work Quick Filter */}
        <Button
          variant={editorFilter === 'my_work' ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => onEditorFilterChange(editorFilter === 'my_work' ? 'all' : 'my_work')}
        >
          <User className="w-3.5 h-3.5" />
          My Work
        </Button>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as ProjectStatus | 'all')}>
          <SelectTrigger className="w-[140px] h-8 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Client Filter */}
        {clients.length > 0 && (
          <Select value={clientFilter} onValueChange={onClientFilterChange}>
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Editor Filter */}
        {editors.length > 0 && (
          <Select value={editorFilter === 'my_work' ? 'all' : editorFilter} onValueChange={onEditorFilterChange}>
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue placeholder="All Editors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Editors</SelectItem>
              {editors.map((editor) => (
                <SelectItem key={editor.id} value={editor.id}>
                  {editor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Show Archived Toggle */}
        {onShowArchivedChange && (
          <Button
            variant={showArchived ? 'secondary' : 'outline'}
            size="sm"
            className="h-8"
            onClick={() => onShowArchivedChange(!showArchived)}
          >
            Archived
          </Button>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={clearFilters}
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Active Filter Tags */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {searchQuery && (
            <Badge variant="secondary" className="gap-1.5">
              Search: "{searchQuery}"
              <X className="w-3 h-3 cursor-pointer" onClick={() => onSearchChange('')} />
            </Badge>
          )}
          {statusFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1.5">
              {STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}
              <X className="w-3 h-3 cursor-pointer" onClick={() => onStatusFilterChange('all')} />
            </Badge>
          )}
          {clientFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1.5">
              {clients.find(c => c.id === clientFilter)?.name}
              <X className="w-3 h-3 cursor-pointer" onClick={() => onClientFilterChange('all')} />
            </Badge>
          )}
          {editorFilter === 'my_work' && (
            <Badge variant="secondary" className="gap-1.5">
              My Work
              <X className="w-3 h-3 cursor-pointer" onClick={() => onEditorFilterChange('all')} />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
