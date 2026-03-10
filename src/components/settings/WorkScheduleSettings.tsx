import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { CalendarDays, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export function WorkScheduleSettings() {
  const { user } = useAuth();
  const [agencyId, setAgencyId] = useState('');
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [lateHour, setLateHour] = useState(10);
  const [lateMinute, setLateMinute] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      const { data: role } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!role?.agency_id) { setLoading(false); return; }
      setAgencyId(role.agency_id);

      const { data } = await supabase
        .from('agency_work_schedule' as any)
        .select('*')
        .eq('agency_id', role.agency_id)
        .maybeSingle();

      if (data) {
        setWorkingDays((data as any).working_days || [1, 2, 3, 4, 5]);
        setLateHour((data as any).late_threshold_hour ?? 10);
        setLateMinute((data as any).late_threshold_minute ?? 0);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const toggleDay = (day: number) => {
    setWorkingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = async () => {
    if (!agencyId) return;
    setSaving(true);
    try {
      // Upsert
      const { error } = await supabase
        .from('agency_work_schedule' as any)
        .upsert({
          agency_id: agencyId,
          working_days: workingDays,
          late_threshold_hour: lateHour,
          late_threshold_minute: lateMinute,
        } as any, { onConflict: 'agency_id' });

      if (error) throw error;
      toast.success('Work schedule updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <CalendarDays className="w-5 h-5" />
          Work Schedule
        </CardTitle>
        <CardDescription>
          Configure working days and late arrival threshold for your team
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Working Days */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Working Days</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DAYS.map(day => (
              <label
                key={day.value}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <Checkbox
                  checked={workingDays.includes(day.value)}
                  onCheckedChange={() => toggleDay(day.value)}
                />
                <span className="text-sm text-foreground">{day.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Non-working days won't count as absent in attendance reports
          </p>
        </div>

        {/* Late Threshold */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Late Arrival Threshold
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={23}
              value={lateHour}
              onChange={(e) => setLateHour(parseInt(e.target.value) || 0)}
              className="w-20 text-center"
            />
            <span className="text-muted-foreground font-medium">:</span>
            <Input
              type="number"
              min={0}
              max={59}
              step={5}
              value={lateMinute}
              onChange={(e) => setLateMinute(parseInt(e.target.value) || 0)}
              className="w-20 text-center"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Check-ins after {String(lateHour).padStart(2, '0')}:{String(lateMinute).padStart(2, '0')} will be marked as late
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Schedule'}
        </Button>
      </CardContent>
    </Card>
  );
}
