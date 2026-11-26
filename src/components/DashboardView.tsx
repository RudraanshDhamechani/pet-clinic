import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Stethoscope,
  Syringe,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { clinicApi } from '../api/clinicApi.ts';
import type { DashboardSummary, DoctorNavSection, VaccinationRecord } from '../types/clinic.ts';
import { StatusIndicator } from './StatusIndicator.tsx';

interface DashboardViewProps {
  onNavigate: (section: DoctorNavSection) => void;
  onQuickLogBooster: (petId: string, vaccineName?: string) => void;
  refreshKey: number;
}

export function DashboardView({
  onNavigate,
  onQuickLogBooster,
  refreshKey,
}: DashboardViewProps) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertTab, setAlertTab] = useState<'overdue' | 'dueToday' | 'due7'>('overdue');
  const [bannerError, setBannerError] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clinicApi.getDashboard();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [refreshKey]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-36 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
        <h2 className="text-base font-semibold text-slate-900">Unable to load clinic overview</h2>
        <p className="text-sm text-slate-600">{error}</p>
        <button
          onClick={loadDashboard}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  const activeAlertList: VaccinationRecord[] =
    alertTab === 'overdue'
      ? data.alerts.overdue
      : alertTab === 'dueToday'
        ? data.alerts.dueToday
        : data.alerts.dueWithin7Days;

  const kpiCards = [
    {
      label: 'Total Registered Pets',
      value: data.kpis.totalPets,
      sub: 'All clinic patients',
      accent: 'text-sky-700',
    },
    {
      label: 'Total Registered Customers',
      value: data.kpis.totalCustomers,
      sub: 'Verified pet owners',
      accent: 'text-slate-900',
    },
    {
      label: 'Vaccinations Administered',
      value: data.kpis.totalVaccinations,
      sub: 'Clinic-wide records',
      accent: 'text-teal-700',
    },
    {
      label: 'Upcoming Vaccinations',
      value: data.kpis.upcomingVaccinations,
      sub: `${data.kpis.dueWithin7Days} due within 7 days`,
      accent: 'text-orange-600',
    },
    {
      label: 'Overdue Vaccinations',
      value: data.kpis.overdueVaccinations,
      sub: 'Requires desk follow-up',
      accent: 'text-red-700',
    },
    {
      label: 'Vaccinations Due Today',
      value: data.kpis.dueTodayVaccinations,
      sub: `Scheduled ${data.today}`,
      accent: 'text-sky-700',
    },
    {
      label: 'Completed This Month',
      value: data.kpis.completedThisMonth,
      sub: `Month ${data.today.slice(0, 7)}`,
      accent: 'text-emerald-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Clinic Welcome & Context Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 bg-white border border-slate-200 rounded-xl overflow-hidden items-stretch">
        <div className="lg:col-span-7 p-6 lg:p-7 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Pawsitive Care Veterinary Clinic</span>
              <span aria-hidden="true">·</span>
              <span>Doctor Clinical Desk</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{data.today}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 text-balance">
              Clinical Immunization &amp; Patient Command Center
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Manage all clinic patients and owner accounts, record vaccinations, monitor
              upcoming and overdue schedules, and review multi-year clinic analytics.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => onNavigate('add-vaccination')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Syringe className="w-4 h-4" />
              Add Vaccination Record
            </button>
            <button
              onClick={() => onNavigate('register-pet')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Register New Pet
            </button>
            <button
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50/70 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Reports &amp; Exports
            </button>
          </div>
        </div>
        <div className="lg:col-span-5 relative min-h-[180px] bg-slate-100 border-t lg:border-t-0 lg:border-l border-slate-200">
          {!bannerError ? (
            <img
              src="/src/assets/images/clinic_care_banner_1795605468863.jpg"
              alt="Golden retriever and tabby cat at Pawsitive Care Veterinary Clinic examination room"
              referrerPolicy="no-referrer"
              onError={() => setBannerError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-500 bg-gradient-to-br from-sky-50 to-teal-50">
              <Stethoscope className="w-8 h-8 text-teal-600 mb-2" />
              <span className="text-xs font-medium text-slate-700">
                Pawsitive Care Examination Suite
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 7 Doctor KPI Statistic Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between"
          >
            <span className="text-xs font-medium text-slate-500 leading-snug">{card.label}</span>
            <div className={`text-2xl font-bold font-mono tabular-nums mt-2 ${card.accent}`}>
              {card.value}
            </div>
            <span className="text-[11px] text-slate-500 mt-1.5">{card.sub}</span>
          </div>
        ))}
      </section>

      {/* Main Two-Column Operational Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Monthly Vaccination Volume
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Administered doses per calendar month across the last 12 active months
              </p>
            </div>
            <button
              onClick={() => onNavigate('trend-analysis')}
              className="text-xs font-medium text-sky-700 hover:text-sky-800 hover:underline whitespace-nowrap shrink-0"
            >
              Open Full Trend Analysis
            </button>
          </div>
          <div className="h-64 w-full mt-auto">
            {data.monthlyOverview.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                No vaccination history available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.monthlyOverview}
                  margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="clinicTealFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284C7" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Doses"
                    stroke="#0284C7"
                    strokeWidth={2.2}
                    fill="url(#clinicTealFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* In-App Notifications Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-sky-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Clinic-Wide Schedule Alerts
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                In-app alerts only · External SMS/email dispatch is not enabled
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-4">
            <button
              onClick={() => setAlertTab('overdue')}
              className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                alertTab === 'overdue'
                  ? 'bg-white text-red-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overdue (<span className="font-mono tabular-nums">{data.alerts.overdue.length}</span>)
            </button>
            <button
              onClick={() => setAlertTab('dueToday')}
              className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                alertTab === 'dueToday'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Due Today (<span className="font-mono tabular-nums">{data.alerts.dueToday.length}</span>)
            </button>
            <button
              onClick={() => setAlertTab('due7')}
              className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                alertTab === 'due7'
                  ? 'bg-white text-orange-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Next 7 Days (<span className="font-mono tabular-nums">{data.alerts.dueWithin7Days.length}</span>)
            </button>
          </div>

          <div className="flex-1 divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
            {activeAlertList.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                No patients in this alert window.
              </div>
            ) : (
              activeAlertList.map((item) => (
                <div
                  key={item.vaccination_id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900 truncate">
                      <span>{item.pet_name}</span>
                      <span className="text-xs font-mono text-slate-500">{item.pet_id}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <span>{item.vaccine_name}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">Due {item.next_due_date}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.owner_phone}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onQuickLogBooster(item.pet_id, item.vaccine_name)}
                    className="px-2.5 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    Log Booster
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Recent Vaccination Activity Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Recent Vaccination Activity
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest immunizations recorded across clinic patients
            </p>
          </div>
          <button
            onClick={() => onNavigate('vaccination-history')}
            className="text-xs font-medium text-sky-700 hover:text-sky-800 hover:underline whitespace-nowrap shrink-0"
          >
            View All Records
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">Pet</th>
                <th className="py-2.5 px-4">Species</th>
                <th className="py-2.5 px-4">Vaccine</th>
                <th className="py-2.5 px-4">Administered</th>
                <th className="py-2.5 px-4">Next Due</th>
                <th className="py-2.5 px-4">Veterinarian</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {data.recentVaccinations.map((rec) => (
                <tr key={rec.vaccination_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-slate-900">{rec.pet_name}</div>
                    <div className="text-xs font-mono text-slate-500">{rec.pet_id}</div>
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">{rec.species}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-800">{rec.vaccine_name}</td>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-600">
                    {rec.vaccination_date}
                  </td>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-600">
                    {rec.next_due_date}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">{rec.veterinarian_name}</td>
                  <td className="py-2.5 px-4">
                    <StatusIndicator status={rec.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
