import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { clinicApi } from '../api/clinicApi.ts';
import type { DoctorNavSection, PetRecord, VaccinationRecord } from '../types/clinic.ts';
import { StatusIndicator } from './StatusIndicator.tsx';

interface VaccinationHistoryViewProps {
  initialPetId?: string | null;
  onNavigate: (section: DoctorNavSection) => void;
  onDataChanged: () => void;
  refreshKey: number;
}

export function VaccinationHistoryView({
  initialPetId,
  onNavigate,
  onDataChanged,
  refreshKey,
}: VaccinationHistoryViewProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [pets, setPets] = useState<PetRecord[]>([]);
  const [records, setRecords] = useState<VaccinationRecord[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>(initialPetId ?? 'ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<VaccinationRecord | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<VaccinationRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (initialPetId) {
      setSelectedPetId(initialPetId);
    }
  }, [initialPetId]);

  useEffect(() => {
    clinicApi.getPets().then(setPets).catch(() => {});
  }, [refreshKey]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await clinicApi.getVaccinations({
        petId: selectedPetId,
        search: search.trim() || undefined,
      });
      setRecords(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vaccination history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedPetId, refreshKey]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setEditError(null);
    if (editing.vaccination_date > todayStr) {
      setEditError('Vaccination date cannot be in the future.');
      return;
    }
    if (editing.next_due_date < editing.vaccination_date) {
      setEditError('Next due date cannot be earlier than vaccination date.');
      return;
    }

    setSaving(true);
    try {
      await clinicApi.updateVaccination(editing.vaccination_id, {
        pet_id: editing.pet_id,
        vaccine_name: editing.vaccine_name,
        vaccination_date: editing.vaccination_date,
        next_due_date: editing.next_due_date,
        veterinarian_name: editing.veterinarian_name,
        notes: editing.notes,
      });
      setEditing(null);
      onDataChanged();
      fetchHistory();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await clinicApi.deleteVaccination(deleting.vaccination_id);
      setDeleting(null);
      onDataChanged();
      fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete record.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Vaccination History
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Inspect chronological immunization records by patient, update dates, or remove entries.
          </p>
        </div>
        <button
          onClick={() => onNavigate('add-vaccination')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Vaccination
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-[240px]">
          <label className="text-xs font-medium text-slate-600 whitespace-nowrap">
            Patient:
          </label>
          <select
            value={selectedPetId}
            onChange={(e) => setSelectedPetId(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          >
            <option value="ALL">All Registered Pets</option>
            {pets.map((p) => (
              <option key={p.pet_id} value={p.pet_id}>
                {p.pet_id} — {p.pet_name} ({p.species})
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vaccine, vet, pet, or owner..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Search
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* History Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Vaccine</th>
                <th className="py-3 px-4">Administered</th>
                <th className="py-3 px-4">Next Due</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Veterinarian</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="py-3.5 px-4">
                      <div className="h-5 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center text-slate-500">
                    No vaccination records found for the selected patient or search.
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.vaccination_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      #{rec.vaccination_id}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{rec.pet_name}</div>
                      <div className="text-xs text-slate-500">
                        <span className="font-mono">{rec.pet_id}</span> · {rec.species}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">{rec.vaccine_name}</td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-600">
                      {rec.vaccination_date}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-600">
                      {rec.next_due_date}
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusIndicator status={rec.status} />
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{rec.veterinarian_name}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-500 max-w-xs truncate">
                      {rec.notes || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditError(null);
                            setEditing({ ...rec });
                          }}
                          title="Edit Record"
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleting(rec)}
                          title="Delete Record"
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Vaccination Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900">
                Edit Vaccination #{editing.vaccination_id} ({editing.pet_name})
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {editError && (
              <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {editError}
              </div>
            )}
            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Vaccine Name</label>
                <input
                  type="text"
                  required
                  value={editing.vaccine_name}
                  onChange={(e) => setEditing({ ...editing, vaccine_name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Vaccination Date
                  </label>
                  <input
                    type="date"
                    required
                    max={todayStr}
                    value={editing.vaccination_date}
                    onChange={(e) => setEditing({ ...editing, vaccination_date: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Next Due Date
                  </label>
                  <input
                    type="date"
                    required
                    min={editing.vaccination_date}
                    value={editing.next_due_date}
                    onChange={(e) => setEditing({ ...editing, next_due_date: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Veterinarian Name
                </label>
                <input
                  type="text"
                  required
                  value={editing.veterinarian_name}
                  onChange={(e) => setEditing({ ...editing, veterinarian_name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleting && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Delete Vaccination Record</h2>
            <p className="text-sm text-slate-600">
              Remove <strong>{deleting.vaccine_name}</strong> ({deleting.vaccination_date}) for{' '}
              <strong>{deleting.pet_name}</strong>? This action updates analytics and tracker status immediately.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleting(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
