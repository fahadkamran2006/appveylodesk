import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface SendAttendanceReportProps {
  agencyId: string;
}

export function SendAttendanceReport({ agencyId }: SendAttendanceReportProps) {
  const now = new Date();
  // Default to previous month
  const defaultMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [month, setMonth] = useState(String(defaultMonth));
  const [year, setYear] = useState(String(defaultYear));
  const [sending, setSending] = useState(false);

  // Generate year options (current year and 2 previous)
  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const handleSend = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('monthly-attendance-summary', {
        body: { agency_id: agencyId, month: parseInt(month), year: parseInt(year) },
      });

      if (error) throw error;
      if (data?.success) {
        toast.success(`Report for ${MONTHS[parseInt(month)]} ${year} sent to your email!`);
      } else {
        throw new Error(data?.error || 'Failed to send report');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send report');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={month} onValueChange={setMonth}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m, i) => (
            <SelectItem key={i} value={String(i)}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={year} onValueChange={setYear}>
        <SelectTrigger className="w-[100px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map(y => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button onClick={handleSend} disabled={sending} size="sm">
        {sending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
        ) : (
          <><Mail className="w-4 h-4 mr-2" /> Send Report</>
        )}
      </Button>
    </div>
  );
}
