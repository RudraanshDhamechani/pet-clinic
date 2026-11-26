import { useEffect, useState } from 'react';
import { Syringe } from 'lucide-react';
import { clinicApi } from '../api/clinicApi.ts';
import type { VaccinationRecord } from '../types/clinic.ts';
import { StatusIndicator } from './StatusIndicator.tsx';

interface VaccinationTrackerViewProps {
  initialStatusFilter?: string;
  title?: string;
  subtitle?: string;
  onQuickLogBooster: (petId: string, vaccineName?: string) => void;
  refreshKey: number;
}

const STATUS_TABS = [
  'All',
  'Overdue',
  'Due Today',
  'Due Within 7 Days',
  'Upcoming',
  'Completed',
] as const;

export function VaccinationTrackerView({
  initialStatusFilter = 'All',
  title = 'Vaccination Status Tracker',
  subtitle = "Statuses are computed dynamically against today's date to surface overdue doses, same-day boosters, and 30-day upcoming schedules.",
  onQuickLogBooster,
  refreshKey,
}: VaccinationTrackerViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [records, setRecords] = useState<VaccinationRecord[]>([]);
  const [allRecords, setAllRecords] = useState<VaccinationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      clinicApi.getVaccinations({ status: statusFilter }),
      clinicApi.getVaccinations({}),
    ])
      .then(([filteredList, fullList]) => {
        setRecords(filteredList);
        setAllRecords(fullList);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter, refreshKey]);

  const counts: Record<string, number> = {
    All: allRecords.length,
    Overdue: allRecords.filter((r) => r.status === 'Overdue').length,
    'Due Today': allRecords.filter((r) => r.status === 'Due Today').length,
    'Due Within 7 Days': allRecords.filter(
      (r) => r.status === 'Due Today' || (r.status === 'Upcoming' && r.due_within_7_days)
    ).length,
    Upcoming: allRecords.filter((r) => r.status === 'Upcoming').length,
    Completed: allRecords.filter((r) => r.status === 'Completed').length,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600 mt-1">{subtitle}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap items-center gap-1.5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              statusFilter === tab
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab}{' '}
            <span
              className={`font-mono tabular-nums ml-1 ${
                statusFilter === tab ? 'text-sky-100' : 'text-slate-400'
              }`}
            >
              {counts[tab] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Owner Contact</th>
                <th className="py-3 px-4">Vaccine</th>
                <th className="py-3 px-4">Last Dose</th>
                <th className="py-3 px-4">Next Due Date</th>
                <th className="py-3 px-4">Dynamic Status</th>
                <th className="py-3 px-4 text-right">Follow-Up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="py-3.5 px-4">
                      <div className="h-5 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center text-slate-500">
                    No vaccinations currently fall under &ldquo;{statusFilter}&rdquo;.
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.vaccination_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{rec.pet_name}</div>
                      <div className="text-xs text-slate-500">
                        <span className="font-mono">{rec.pet_id}</span> · {rec.species}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="text-slate-800">{rec.owner_name}</div>
                      <div className="text-xs font-mono text-slate-500">{rec.owner_phone}</div>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">{rec.vaccine_name}</td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-600">
                      {rec.vaccination_date}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-700 font-medium">
                      {rec.next_due_date}
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusIndicator
                        status={rec.status}
                        daysUntilDue={rec.days_until_due}
                        showDays
                      />
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => onQuickLogBooster(rec.pet_id, rec.vaccine_name)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-md transition-colors whitespace-nowrap"
                      >
                        <Syringe className="w-3.5 h-3.5" />
                        Log Booster
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
