import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { clinicApi } from '../api/clinicApi.ts';
import type { AnalyticsResponse } from '../types/clinic.ts';

interface TrendAnalysisViewProps {
  refreshKey: number;
}

const SPECIES_COLORS = ['#0284C7', '#0D9488', '#38BDF8', '#64748B', '#14B8A6'];
const YEAR_COLORS = ['#94A3B8', '#0D9488', '#0284C7', '#0369A1'];
const STATUS_COLOR_MAP: Record<string, string> = {
  Completed: '#16A34A',
  Upcoming: '#D97706',
  'Due Today': '#EA580C',
  Overdue: '#DC2626',
};

export function TrendAnalysisView({ refreshKey }: TrendAnalysisViewProps) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [species, setSpecies] = useState('All');
  const [vaccine, setVaccine] = useState('All');

  const fetchAnalytics = async (overrides?: {
    startDate?: string;
    endDate?: string;
    species?: string;
    vaccine?: string;
  }) => {
    setLoading(true);
    try {
      const res = await clinicApi.getAnalytics({
        startDate: overrides?.startDate ?? (startDate || undefined),
        endDate: overrides?.endDate ?? (endDate || undefined),
        species: overrides?.species ?? species,
        vaccine: overrides?.vaccine ?? vaccine,
      });
      setData(res);
      if (!startDate && res.filterOptions.minDate) {
        setStartDate(res.filterOptions.minDate);
      }
      if (!endDate && res.filterOptions.maxDate) {
        setEndDate(res.filterOptions.maxDate);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [refreshKey, species, vaccine]);

  const handleReset = () => {
    const minD = data?.filterOptions.minDate ?? '';
    const maxD = data?.filterOptions.maxDate ?? '';
    setStartDate(minD);
    setEndDate(maxD);
    setSpecies('All');
    setVaccine('All');
    fetchAnalytics({ startDate: minD, endDate: maxD, species: 'All', vaccine: 'All' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Vaccination Trend Analysis
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Interactive multi-year clinical analytics deduplicated by unique vaccination record ID.
          </p>
        </div>
        {data && (
          <div className="flex items-center gap-4 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-4 py-2">
            <span>
              Records: <strong className="font-mono tabular-nums text-slate-900">{data.totals.totalRecords}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Pets: <strong className="font-mono tabular-nums text-slate-900">{data.totals.uniquePets}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Vaccines: <strong className="font-mono tabular-nums text-slate-900">{data.totals.uniqueVaccines}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Interactive Analytics Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Species</label>
          <select
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
          >
            <option value="All">All Species</option>
            {(data?.filterOptions.species ?? []).map((sp) => (
              <option key={sp} value={sp}>
                {sp}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Vaccine Type</label>
          <select
            value={vaccine}
            onChange={(e) => setVaccine(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
          >
            <option value="All">All Vaccines</option>
            {(data?.filterOptions.vaccines ?? []).map((vx) => (
              <option key={vx} value={vx}>
                {vx}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAnalytics()}
            className="flex-1 px-3.5 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors"
          >
            Apply Dates
          </button>
          <button
            onClick={handleReset}
            title="Reset Filters"
            className="p-2 text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data || data.totals.totalRecords === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <p className="text-sm text-slate-600">
            No vaccination records match the selected date range, species, and vaccine filters.
          </p>
          <button
            onClick={handleReset}
            className="px-4 py-2 text-xs font-medium text-sky-700 bg-sky-50 rounded-lg hover:bg-sky-100"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Monthly Vaccination Trends (Line Chart) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900">
              1. Monthly Vaccination Trends
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Chronological volume of vaccinations administered per month
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthlyTrend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Doses"
                    stroke="#0284C7"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#0284C7' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Most Commonly Administered Vaccines (Bar Chart) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900">
              2. Most Commonly Administered Vaccines
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Total distinct doses logged per vaccine type
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topVaccines} margin={{ top: 8, right: 12, left: -16, bottom: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="vaccine_name"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Doses" fill="#0D9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Vaccination Distribution by Species (Pie / Donut Chart) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900">
              3. Vaccination Distribution by Species
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Share of administered doses across clinic patient species
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.speciesDistribution}
                    dataKey="count"
                    nameKey="species"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={86}
                    paddingAngle={2}
                  >
                    {data.speciesDistribution.map((entry, idx) => (
                      <Cell
                        key={entry.species}
                        fill={SPECIES_COLORS[idx % SPECIES_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value ?? 0} doses`, String(name ?? '')]}
                  />
                  <Legend verticalAlign="bottom" height={30} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Monthly Comparison Across Years (Grouped Bar Chart) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900">
              4. Monthly Comparison of Vaccinations
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Side-by-side seasonal comparison from January to December across years
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyComparison} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip />
                  <Legend verticalAlign="top" height={28} />
                  {data.comparisonYears.map((yr, idx) => (
                    <Bar
                      key={yr}
                      dataKey={yr}
                      name={yr}
                      fill={YEAR_COLORS[idx % YEAR_COLORS.length]}
                      radius={[3, 3, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 5: Upcoming & Overdue Vaccination Statistics */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900">
              5. Upcoming &amp; Overdue Vaccination Statistics
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Schedule compliance breakdown computed dynamically against today
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.statusBreakdown} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Records" radius={[4, 4, 0, 0]}>
                    {data.statusBreakdown.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLOR_MAP[entry.status] ?? '#0284C7'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 6: Yearly Vaccination Comparisons */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900">
              6. Yearly Vaccination Comparisons
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Annual immunization totals alongside unique pets vaccinated per year
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.yearlyComparison} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip />
                  <Legend verticalAlign="top" height={28} />
                  <Bar dataKey="count" name="Total Doses" fill="#0284C7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="uniquePets" name="Unique Pets" fill="#0D9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
