import { useEffect, useState, type FormEvent } from 'react';
import {
  Code2,
  Download,
  FileSpreadsheet,
  FileText,
  FolderTree,
  Printer,
  Search,
  Terminal,
} from 'lucide-react';
import { clinicApi, downloadAuthenticatedFile } from '../api/clinicApi.ts';
import {
  downloadPythonProjectZip,
  PYTHON_PROJECT_FILES,
} from '../data/pythonProjectBundle.ts';
import type { PetRecord, PetReportData, VaccinationRecord } from '../types/clinic.ts';
import { downloadPetVaccinationPdf } from '../utils/pdfReport.ts';
import { StatusIndicator } from './StatusIndicator.tsx';

interface ReportsViewProps {
  refreshKey: number;
}

export function ReportsView({ refreshKey }: ReportsViewProps) {
  const [search, setSearch] = useState('');
  const [vaccine, setVaccine] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [pets, setPets] = useState<PetRecord[]>([]);
  const [records, setRecords] = useState<VaccinationRecord[]>([]);
  const [selectedPetId, setSelectedPetId] = useState('PET-1001');
  const [petReport, setPetReport] = useState<PetReportData | null>(null);
  const [activePyFile, setActivePyFile] = useState(PYTHON_PROJECT_FILES[0].filename);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [petList, vaxList] = await Promise.all([
        clinicApi.getPets(),
        clinicApi.getVaccinations({
          search: search.trim() || undefined,
          vaccine,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      ]);
      setPets(petList);
      setRecords(vaxList);
      if (petList.length > 0 && !petList.some((p) => p.pet_id === selectedPetId)) {
        setSelectedPetId(petList[0].pet_id);
      }
    } catch {
      // keep existing state
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshKey, vaccine]);

  useEffect(() => {
    if (!selectedPetId) return;
    clinicApi
      .getPetReport(selectedPetId)
      .then(setPetReport)
      .catch(() => setPetReport(null));
  }, [selectedPetId, refreshKey]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const uniqueVaccines = Array.from(new Set(records.map((r) => r.vaccine_name))).sort();

  const buildVaccinationsCsvUrl = () => {
    const qs = new URLSearchParams();
    if (search.trim()) qs.set('search', search.trim());
    if (vaccine !== 'All') qs.set('vaccine', vaccine);
    if (startDate) qs.set('startDate', startDate);
    if (endDate) qs.set('endDate', endDate);
    const query = qs.toString();
    return `/api/export/vaccinations.csv${query ? `?${query}` : ''}`;
  };

  const handleExport = async (url: string, filename: string) => {
    setExportErr(null);
    try {
      await downloadAuthenticatedFile(url, filename);
    } catch (err) {
      setExportErr(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  const handleDownloadPythonZip = async () => {
    setDownloadingZip(true);
    try {
      await downloadPythonProjectZip();
    } finally {
      setDownloadingZip(false);
    }
  };

  const selectedPyModule =
    PYTHON_PROJECT_FILES.find((f) => f.filename === activePyFile) ?? PYTHON_PROJECT_FILES[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Clinic Reports &amp; Exports
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Filter clinical records, export authenticated CSV spreadsheets, print or download PDF certificates, or grab the Python/Streamlit package.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleExport('/api/export/pets.csv', 'pawsitive_care_pets.csv')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-700" />
            Export Pets CSV
          </button>
          <button
            onClick={() =>
              handleExport(buildVaccinationsCsvUrl(), 'pawsitive_care_vaccinations.csv')
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-sky-700" />
            Export Vaccinations CSV
          </button>
          <button
            onClick={() =>
              handleExport(
                '/api/export/summary.txt',
                `pawsitive_care_summary_${new Date().toISOString().slice(0, 10)}.txt`
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Summary Report (.txt)
          </button>
        </div>
      </div>

      {exportErr && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {exportErr}
        </div>
      )}

      {/* Search & Filter */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 no-print">
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Search by Pet ID, Pet Name, or Owner Name
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g., PET-1001, Bella, Jordan..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Vaccine</label>
            <select
              value={vaccine}
              onChange={(e) => setVaccine(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="All">All Vaccines</option>
              {uniqueVaccines.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700"
            >
              Filter
            </button>
          </div>
        </form>

        <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
              <tr>
                <th className="py-2.5 px-3">Pet ID</th>
                <th className="py-2.5 px-3">Pet Name</th>
                <th className="py-2.5 px-3">Owner</th>
                <th className="py-2.5 px-3">Vaccine</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Next Due</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No matching vaccination records.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.vaccination_id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-slate-700">{r.pet_id}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">{r.pet_name}</td>
                    <td className="py-2 px-3 text-slate-600">{r.owner_name}</td>
                    <td className="py-2 px-3 font-medium text-slate-800">{r.vaccine_name}</td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-600">
                      {r.vaccination_date}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-600">
                      {r.next_due_date}
                    </td>
                    <td className="py-2 px-3">
                      <StatusIndicator status={r.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Individual Pet Vaccination Certificate / PDF Report */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 no-print">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Individual Pet Vaccination Report
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a patient to view, print, or download their official PDF immunization record
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPetId}
              onChange={(e) => setSelectedPetId(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              {pets.map((p) => (
                <option key={p.pet_id} value={p.pet_id}>
                  {p.pet_id} — {p.pet_name}
                </option>
              ))}
            </select>
            {petReport && (
              <button
                onClick={() => downloadPetVaccinationPdf(petReport)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <Printer className="w-4 h-4" />
              Print Certificate
            </button>
          </div>
        </div>

        {petReport && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-teal-700">
                  Pawsitive Care Veterinary Clinic — Official Immunization History
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                  {petReport.pet.pet_name}{' '}
                  <span className="text-sm font-mono font-normal text-slate-500">
                    ({petReport.pet.pet_id})
                  </span>
                </h3>
                <div className="text-xs text-slate-600 mt-1">
                  {petReport.pet.species} · {petReport.pet.breed} · {petReport.pet.gender} · Age{' '}
                  {petReport.pet.age}y · DOB {petReport.pet.date_of_birth}
                </div>
              </div>
              <div className="text-xs text-slate-600 sm:text-right">
                <div className="font-semibold text-slate-800">{petReport.pet.owner_name}</div>
                <div className="font-mono">{petReport.pet.owner_phone}</div>
                <div>{petReport.pet.owner_email}</div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-3">Vaccine</th>
                    <th className="py-2.5 px-3">Date Administered</th>
                    <th className="py-2.5 px-3">Next Due Date</th>
                    <th className="py-2.5 px-3">Veterinarian</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {petReport.vaccinations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No vaccinations recorded for this patient yet.
                      </td>
                    </tr>
                  ) : (
                    petReport.vaccinations.map((v) => (
                      <tr key={v.vaccination_id}>
                        <td className="py-2 px-3 font-medium text-slate-900">{v.vaccine_name}</td>
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-700">
                          {v.vaccination_date}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-700">
                          {v.next_due_date}
                        </td>
                        <td className="py-2 px-3 text-slate-700">{v.veterinarian_name}</td>
                        <td className="py-2 px-3">
                          <StatusIndicator status={v.status} />
                        </td>
                        <td className="py-2 px-3 text-slate-500">{v.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Python / Streamlit Project Bundle & VS Code Setup */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 no-print">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-sky-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Python &amp; Streamlit Source Package (Local VS Code Deliverables)
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Complete modular Python codebase using Streamlit, Pandas, Plotly, Matplotlib, and SQLite.
            </p>
          </div>
          <button
            onClick={handleDownloadPythonZip}
            disabled={downloadingZip}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            {downloadingZip ? 'Packaging ZIP...' : 'Download Python/Streamlit Project (.zip)'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="border border-slate-200 rounded-lg p-4 space-y-2 bg-slate-50/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <FolderTree className="w-4 h-4 text-teal-600" />
                Folder Structure &amp; Modules
              </div>
              <div className="space-y-2 pt-1">
                {PYTHON_PROJECT_FILES.map((file) => (
                  <button
                    key={file.filename}
                    onClick={() => setActivePyFile(file.filename)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                      activePyFile === file.filename
                        ? 'bg-white border-sky-300 text-slate-900'
                        : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-sky-700">
                        {file.filename}
                      </span>
                      <span className="text-[11px] text-slate-500">{file.role}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {file.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Terminal className="w-4 h-4 text-sky-600" />
                Run Locally in VS Code
              </div>
              <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Download and extract the ZIP archive, then open the folder in VS Code.</li>
                <li>Open the VS Code terminal and create a Python virtual environment.</li>
                <li>
                  Install dependencies:{' '}
                  <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                    pip install -r requirements.txt
                  </code>
                </li>
                <li>
                  Launch Streamlit:{' '}
                  <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                    streamlit run app.py
                  </code>
                </li>
              </ol>
            </div>
          </div>

          <div className="lg:col-span-7 border border-slate-200 rounded-lg overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-slate-800">
                python_streamlit_app/{selectedPyModule.filename}
              </span>
              <span className="text-xs text-slate-500">{selectedPyModule.role}</span>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-800 bg-slate-50/40 overflow-auto max-h-[460px] leading-relaxed">
              <code>{selectedPyModule.content}</code>
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
