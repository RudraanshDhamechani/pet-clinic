import { useState, type ChangeEvent, type DragEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  SkipForward,
  Upload,
  XCircle,
} from 'lucide-react';
import { clinicApi } from '../api/clinicApi.ts';
import type { CsvImportResult, CsvImportRowResult, DoctorNavSection } from '../types/clinic.ts';

interface ImportCsvViewProps {
  onDataChanged: () => void;
  onNavigate: (section: DoctorNavSection) => void;
}

const PETS_TEMPLATE_CSV = [
  'pet_id,pet_name,species,breed,age,gender,date_of_birth,weight_kg,owner_name,owner_phone,owner_email',
  'PET-2001,Milo,Dog,Cavalier King Charles,2.5,Male,2024-05-12,8.4,Clara Henderson,(555) 234-5678,clara@example.com',
  ',Cleo,Cat,Ragdoll,1.5,Female,2025-05-10,4.2,Daniel Brooks,(555) 876-5432,daniel@example.com',
].join('\n');

const VACCINATIONS_TEMPLATE_CSV = [
  'pet_id,vaccine_name,vaccination_date,next_due_date,veterinarian_name,notes',
  'PET-1001,Rabies,2026-11-10,2027-11-10,Dr. Claire Vance,Annual booster administered smoothly',
  'PET-1002,FVRCP,2026-11-15,2026-12-05,Dr. Marcus Chen,Follow-up booster scheduled',
].join('\n');

function downloadTextTemplate(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ActionStatusLabel({ action }: { action: CsvImportRowResult['action'] }) {
  if (action === 'insert') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        Insert
      </span>
    );
  }
  if (action === 'update') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700">
        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
        Update
      </span>
    );
  }
  if (action === 'skip') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <SkipForward className="w-3.5 h-3.5 shrink-0" />
        Skip
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
      <XCircle className="w-3.5 h-3.5 shrink-0" />
      Error
    </span>
  );
}

export function ImportCsvView({ onDataChanged, onNavigate }: ImportCsvViewProps) {
  const [dataset, setDataset] = useState<'pets' | 'vaccinations'>('pets');
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'update'>('skip');
  const [fileName, setFileName] = useState<string>('');
  const [csvText, setCsvText] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<CsvImportResult | null>(null);
  const [committedResult, setCommittedResult] = useState<CsvImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runPreview = async (
    text: string,
    targetDataset: 'pets' | 'vaccinations',
    mode: 'skip' | 'update'
  ) => {
    setError(null);
    setCommittedResult(null);
    if (!text.trim()) {
      setPreview(null);
      return;
    }
    setValidating(true);
    try {
      const res =
        targetDataset === 'pets'
          ? await clinicApi.importPetsCsv({ csvText: text, mode, dryRun: true })
          : await clinicApi.importVaccinationsCsv({ csvText: text, dryRun: true });
      setPreview(res);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : 'Unable to parse CSV file.');
    } finally {
      setValidating(false);
    }
  };

  const handleDatasetChange = (next: 'pets' | 'vaccinations') => {
    setDataset(next);
    setCommittedResult(null);
    if (csvText) {
      void runPreview(csvText, next, duplicateMode);
    } else {
      setPreview(null);
      setError(null);
    }
  };

  const handleModeChange = (nextMode: 'skip' | 'update') => {
    setDuplicateMode(nextMode);
    if (csvText && dataset === 'pets') {
      void runPreview(csvText, dataset, nextMode);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setError('Please select a valid .csv file.');
      return;
    }
    if (file.size > 1_500_000) {
      setError('CSV file exceeds the 1.5 MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setFileName(file.name);
      setCsvText(text);
      void runPreview(text, dataset, duplicateMode);
    };
    reader.onerror = () => {
      setError('Could not read the selected CSV file.');
    };
    reader.readAsText(file);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleCommitImport = async () => {
    if (!csvText.trim()) return;
    setError(null);
    setCommitting(true);
    try {
      const res =
        dataset === 'pets'
          ? await clinicApi.importPetsCsv({ csvText, mode: duplicateMode, dryRun: false })
          : await clinicApi.importVaccinationsCsv({ csvText, dryRun: false });
      setCommittedResult(res);
      setPreview(res);
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit CSV import.');
    } finally {
      setCommitting(false);
    }
  };

  const handleClear = () => {
    setFileName('');
    setCsvText('');
    setPreview(null);
    setCommittedResult(null);
    setError(null);
  };

  const readyCount = (preview?.inserted ?? 0) + (preview?.updated ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Import CSV Files</h1>
          <p className="text-sm text-slate-600 mt-1">
            Bulk-import registered pets or clinical vaccination logs from CSV spreadsheets with row-by-row validation before saving.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadTextTemplate('pawsitive_care_pets_template.csv', PETS_TEMPLATE_CSV)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-sky-600" />
            Pets Template CSV
          </button>
          <button
            type="button"
            onClick={() =>
              downloadTextTemplate('pawsitive_care_vaccinations_template.csv', VACCINATIONS_TEMPLATE_CSV)
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-teal-600" />
            Vaccinations Template CSV
          </button>
        </div>
      </div>

      {/* Dataset Selector & Duplicate Strategy */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => handleDatasetChange('pets')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              dataset === 'pets'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Import Pets CSV
          </button>
          <button
            type="button"
            onClick={() => handleDatasetChange('vaccinations')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              dataset === 'vaccinations'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Import Vaccinations CSV
          </button>
        </div>

        {dataset === 'pets' ? (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium text-slate-700">If Pet ID already exists:</span>
            <select
              value={duplicateMode}
              onChange={(e) => handleModeChange(e.target.value as 'skip' | 'update')}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800"
            >
              <option value="skip">Skip existing records</option>
              <option value="update">Update existing pet details</option>
            </select>
          </div>
        ) : (
          <div className="text-xs text-slate-500">
            Duplicates matching Pet ID, Vaccine Name, and Vaccination Date are automatically skipped.
          </div>
        )}
      </div>

      {/* Upload Dropzone & Expected Schema */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isDragging
              ? 'border-sky-500 bg-sky-50/50'
              : 'border-slate-300 bg-slate-50/50 hover:border-slate-400'
          }`}
        >
          <FileSpreadsheet className="w-9 h-9 text-sky-600 mx-auto" />
          <div className="mt-3 text-sm font-semibold text-slate-900">
            {fileName ? `Loaded: ${fileName}` : `Drop your ${dataset === 'pets' ? 'Pets' : 'Vaccinations'} CSV file here`}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            UTF-8 CSV up to 1.5 MB and 1,000 rows per batch. Exported clinic CSVs can be re-imported directly.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors cursor-pointer whitespace-nowrap">
              <Upload className="w-3.5 h-3.5" />
              Select CSV File
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
            {fileName && (
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Clear File
              </button>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-600 pt-2 border-t border-slate-100">
          {dataset === 'pets' ? (
            <div>
              <strong className="text-slate-800">Required columns:</strong>{' '}
              <span className="font-mono">
                pet_name, species, breed, date_of_birth, gender, owner_name, owner_phone
              </span>
              <span className="mx-2 text-slate-300">·</span>
              <strong className="text-slate-800">Optional:</strong>{' '}
              <span className="font-mono">pet_id (auto-generated if blank), age, weight_kg, owner_email</span>
            </div>
          ) : (
            <div>
              <strong className="text-slate-800">Required columns:</strong>{' '}
              <span className="font-mono">
                pet_id, vaccine_name, vaccination_date, next_due_date, veterinarian_name
              </span>
              <span className="mx-2 text-slate-300">·</span>
              <strong className="text-slate-800">Optional:</strong>{' '}
              <span className="font-mono">notes</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800"
        >
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {committedResult && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-950">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Import complete: <strong className="font-mono tabular-nums">{committedResult.inserted}</strong> inserted,{' '}
              <strong className="font-mono tabular-nums">{committedResult.updated}</strong> updated,{' '}
              <strong className="font-mono tabular-nums">{committedResult.skipped}</strong> skipped,{' '}
              <strong className="font-mono tabular-nums">{committedResult.errorsCount}</strong> errors.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate(dataset === 'pets' ? 'all-pets' : 'vaccination-history')}
              className="px-3 py-1.5 text-xs font-medium text-emerald-900 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50"
            >
              {dataset === 'pets' ? 'View All Registered Pets' : 'View Vaccination History'}
            </button>
          </div>
        </div>
      )}

      {/* Validation Preview & Commit Bar */}
      {validating && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          Validating CSV rows against clinic database rules...
        </div>
      )}

      {!validating && preview && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900">
                {committedResult ? 'Import Outcome Report' : 'Pre-Import Validation Preview'}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>
                  Total rows:{' '}
                  <strong className="font-mono tabular-nums text-slate-900">{preview.totalRows}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Insert:{' '}
                  <strong className="font-mono tabular-nums text-emerald-700">{preview.inserted}</strong>
                </span>
                {preview.dataset === 'pets' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Update:{' '}
                      <strong className="font-mono tabular-nums text-sky-700">{preview.updated}</strong>
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>
                  Skipped:{' '}
                  <strong className="font-mono tabular-nums text-amber-700">{preview.skipped}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Errors:{' '}
                  <strong className="font-mono tabular-nums text-red-700">{preview.errorsCount}</strong>
                </span>
              </div>
            </div>

            {!committedResult && (
              <button
                type="button"
                disabled={committing || readyCount === 0}
                onClick={handleCommitImport}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                {committing
                  ? 'Importing...'
                  : `Import ${readyCount} Valid Row${readyCount === 1 ? '' : 's'}`}
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">CSV Row</th>
                  <th className="py-2.5 px-4">Pet ID</th>
                  <th className="py-2.5 px-4">Record</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {preview.rows.slice(0, 200).map((r) => (
                  <tr key={`${r.row}-${r.identifier}`} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-500">
                      #{r.row}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-800">
                      {r.identifier}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800">{r.label}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <ActionStatusLabel action={r.action} />
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 200 && (
            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
              Showing first 200 of {preview.rows.length} rows in preview. All {readyCount} valid rows will be imported.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
