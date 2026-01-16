import { useMemo } from 'react';
import { Trophy, Clock, CheckCircle2, Medal, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TimePeriod } from '@/hooks/usePersonStats';

interface EditorStats {
  currentLoad: number;
  completedProjects: number;
  avgDeliveryDays: number | null;
  projects: Array<{ id: string; name: string; status: string }>;
}

interface Editor {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface EditorLeaderboardProps {
  editors: Editor[];
  stats: Record<string, EditorStats>;
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
}

const formatDeliveryTime = (days: number | null): string => {
  if (days === null || days === undefined) return 'N/A';
  if (days < 1) {
    const hours = Math.round(days * 24);
    return `${hours}h`;
  }
  return `${days.toFixed(1)}d`;
};

const getMedalColor = (rank: number): string => {
  switch (rank) {
    case 0:
      return 'text-yellow-500';
    case 1:
      return 'text-gray-400';
    case 2:
      return 'text-amber-600';
    default:
      return 'text-muted-foreground';
  }
};

const LeaderboardRow = ({
  editor,
  stat,
  rank,
  type,
}: {
  editor: Editor;
  stat: EditorStats;
  rank: number;
  type: 'speed' | 'completed';
}) => {
  const initials = (editor.full_name || editor.email)
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const value = type === 'speed' 
    ? formatDeliveryTime(stat.avgDeliveryDays)
    : stat.completedProjects.toString();

  const label = type === 'speed' ? 'avg' : 'projects';

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-center w-8">
        {rank < 3 ? (
          <Medal className={`w-5 h-5 ${getMedalColor(rank)}`} />
        ) : (
          <span className="text-sm font-medium text-muted-foreground">
            {rank + 1}
          </span>
        )}
      </div>
      <Avatar className="h-9 w-9">
        <AvatarImage src={editor.avatar_url || undefined} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">
          {editor.full_name || editor.email.split('@')[0]}
        </p>
        <p className="text-xs text-muted-foreground truncate">{editor.email}</p>
      </div>
      <Badge variant="secondary" className="font-mono">
        {value} <span className="text-muted-foreground ml-1">{label}</span>
      </Badge>
    </div>
  );
};

export const EditorLeaderboard = ({ editors, stats, period, onPeriodChange }: EditorLeaderboardProps) => {
  // Sort by fastest delivery time (lowest is best)
  const sortedBySpeed = useMemo(() => {
    return editors
      .filter((e) => stats[e.id]?.avgDeliveryDays !== null && stats[e.id]?.avgDeliveryDays !== undefined)
      .sort((a, b) => {
        const aTime = stats[a.id]?.avgDeliveryDays ?? Infinity;
        const bTime = stats[b.id]?.avgDeliveryDays ?? Infinity;
        return aTime - bTime;
      })
      .slice(0, 5);
  }, [editors, stats]);

  // Sort by most completed projects
  const sortedByCompleted = useMemo(() => {
    return editors
      .filter((e) => stats[e.id]?.completedProjects > 0)
      .sort((a, b) => {
        const aCount = stats[a.id]?.completedProjects ?? 0;
        const bCount = stats[b.id]?.completedProjects ?? 0;
        return bCount - aCount;
      })
      .slice(0, 5);
  }, [editors, stats]);

  const hasSpeedData = sortedBySpeed.length > 0;
  const hasCompletedData = sortedByCompleted.length > 0;

  if (!hasSpeedData && !hasCompletedData) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Editor Leaderboard</CardTitle>
          </div>
          <Select value={period} onValueChange={(v) => onPeriodChange(v as TimePeriod)}>
            <SelectTrigger className="w-[140px]">
              <CalendarDays className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={hasSpeedData ? 'speed' : 'completed'}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="speed" disabled={!hasSpeedData} className="gap-2">
              <Clock className="w-4 h-4" />
              Fastest Delivery
            </TabsTrigger>
            <TabsTrigger value="completed" disabled={!hasCompletedData} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Most Completed
            </TabsTrigger>
          </TabsList>
          <TabsContent value="speed" className="space-y-1">
            {sortedBySpeed.map((editor, idx) => (
              <LeaderboardRow
                key={editor.id}
                editor={editor}
                stat={stats[editor.id]}
                rank={idx}
                type="speed"
              />
            ))}
            {!hasSpeedData && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No delivery data yet. Complete projects to see rankings.
              </p>
            )}
          </TabsContent>
          <TabsContent value="completed" className="space-y-1">
            {sortedByCompleted.map((editor, idx) => (
              <LeaderboardRow
                key={editor.id}
                editor={editor}
                stat={stats[editor.id]}
                rank={idx}
                type="completed"
              />
            ))}
            {!hasCompletedData && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No completed projects yet.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
