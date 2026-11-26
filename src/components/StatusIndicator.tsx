import { AlertTriangle, CheckCircle2, Clock, CalendarClock } from 'lucide-react';
import type { VaccinationStatus } from '../types/clinic.ts';

interface StatusIndicatorProps {
  status: VaccinationStatus;
  daysUntilDue?: number;
  showDays?: boolean;
}

const STATUS_STYLES: Record<
  VaccinationStatus,
  { colorClass: string; Icon: typeof CheckCircle2 }
> = {
  Completed: { colorClass: 'text-emerald-700', Icon: CheckCircle2 },
  Upcoming: { colorClass: 'text-orange-600', Icon: CalendarClock },
  'Due Today': { colorClass: 'text-sky-700', Icon: Clock },
  Overdue: { colorClass: 'text-red-700', Icon: AlertTriangle },
};

export function StatusIndicator({
  status,
  daysUntilDue,
  showDays = false,
}: StatusIndicatorProps) {
  const { colorClass, Icon } = STATUS_STYLES[status];

  let suffix = '';
  if (showDays && typeof daysUntilDue === 'number') {
    if (daysUntilDue < 0) {
      suffix = ` (${Math.abs(daysUntilDue)}d late)`;
    } else if (daysUntilDue === 0) {
      suffix = ' (Today)';
    } else {
      suffix = ` (in ${daysUntilDue}d)`;
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${colorClass}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>
        {status}
        {suffix && <span className="font-mono tabular-nums">{suffix}</span>}
      </span>
    </span>
  );
}
