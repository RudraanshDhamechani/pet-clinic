import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { clinicApi } from '../api/clinicApi.ts';
import type { DoctorNavSection, PetRecord } from '../types/clinic.ts';

interface AddVaccinationViewProps {
  preselectedPetId?: string | null;
  preselectedVaccine?: string | null;
  onVaccinationAdded: () => void;
  onNavigate: (section: DoctorNavSection) => void;
}

const VACCINE_OPTIONS = [
  'Rabies',
  'DHPP',
  'FVRCP',
  'Bordetella',
  'Leptospirosis',
  'FeLV',
  'Lyme',
  'RHDV2',
  'Canine Influenza',
  'Other',
];

function addMonthsIso(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

export function AddVaccinationView({
  preselectedPetId,
  preselectedVaccine,
  onVaccinationAdded,
  onNavigate,
}: AddVaccinationViewProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [pets, setPets] = useState<PetRecord[]>([]);
  const [petId, setPetId] = useState(preselectedPetId ?? '');
  const [vaccineOption, setVaccineOption] = useState(
    preselectedVaccine && VACCINE_OPTIONS.includes(preselectedVaccine)
      ? preselectedVaccine
      : 'Rabies'
  );
  const [customVaccine, setCustomVaccine] = useState('');
  const [vaccinationDate, setVaccinationDate] = useState(todayStr);
  const [nextDueDate, setNextDueDate] = useState(addMonthsIso(todayStr, 12));
  const [veterinarianName, setVeterinarianName] = useState('Dr. Claire Vance');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    clinicApi
      .getPets()
      .then((list) => {
        setPets(list);
        if (preselectedPetId && list.some((p) => p.pet_id === preselectedPetId)) {
          setPetId(preselectedPetId);
        } else if (!petId && list.length > 0) {
          setPetId(list[0].pet_id);
        }
      })
      .catch(() => {});
  }, [preselectedPetId]);

  useEffect(() => {
    if (preselectedVaccine && VACCINE_OPTIONS.includes(preselectedVaccine)) {
      setVaccineOption(preselectedVaccine);
    }
  }, [preselectedVaccine]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const finalVaccine =
      vaccineOption === 'Other' ? customVaccine.trim() : vaccineOption;
    if (!petId) {
      setError('Please select a registered pet.');
      return;
    }
    if (!finalVaccine) {
      setError('Please enter a vaccine name.');
      return;
    }
    if (vaccinationDate > todayStr) {
      setError('Vaccination date cannot be in the future.');
      return;
    }
    if (nextDueDate < vaccinationDate) {
      setError('Next due date cannot be earlier than vaccination date.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await clinicApi.createVaccination({
        pet_id: petId,
        vaccine_name: finalVaccine,
        vaccination_date: vaccinationDate,
        next_due_date: nextDueDate,
        veterinarian_name: veterinarianName.trim(),
        notes: notes.trim(),
      });
      setSuccessMsg(
        `Logged ${created.vaccine_name} for ${created.pet_name} (${created.pet_id}). Status: ${created.status}.`
      );
      setNotes('');
      onVaccinationAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log vaccination.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Add Vaccination Record
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Record an administered immunization dose with validated administration and booster due dates.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-900">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => onNavigate('vaccination-history')}
            className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            View History
          </button>
        </div>
      )}

      {pets.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
          <p className="text-sm text-slate-600">
            No registered pets found. Register a patient before logging vaccinations.
          </p>
          <button
            onClick={() => onNavigate('register-pet')}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700"
          >
            Register Pet
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Registered Patient *
              </label>
              <select
                value={petId}
                onChange={(e) => setPetId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600"
              >
                {pets.map((p) => (
                  <option key={p.pet_id} value={p.pet_id}>
                    {p.pet_id} — {p.pet_name} ({p.species} · {p.owner_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Vaccine Name *
              </label>
              <select
                value={vaccineOption}
                onChange={(e) => setVaccineOption(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600"
              >
                {VACCINE_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {vaccineOption === 'Other' ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Custom Vaccine Name *
                </label>
                <input
                  type="text"
                  required
                  value={customVaccine}
                  onChange={(e) => setCustomVaccine(e.target.value)}
                  placeholder="Enter vaccine name"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Veterinarian Name *
                </label>
                <input
                  type="text"
                  required
                  value={veterinarianName}
                  onChange={(e) => setVeterinarianName(e.target.value)}
                  placeholder="Dr. Claire Vance"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600"
                />
              </div>
            )}

            {vaccineOption === 'Other' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Veterinarian Name *
                </label>
                <input
                  type="text"
                  required
                  value={veterinarianName}
                  onChange={(e) => setVeterinarianName(e.target.value)}
                  placeholder="Dr. Claire Vance"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Vaccination Date *
              </label>
              <input
                type="date"
                required
                max={todayStr}
                value={vaccinationDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setVaccinationDate(val);
                  if (val && nextDueDate < val) {
                    setNextDueDate(addMonthsIso(val, 12));
                  }
                }}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Next Due Date *
                </label>
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setNextDueDate(addMonthsIso(vaccinationDate, 6))}
                    className="text-sky-700 hover:underline"
                  >
                    +6m
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => setNextDueDate(addMonthsIso(vaccinationDate, 12))}
                    className="text-sky-700 hover:underline"
                  >
                    +1y
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => setNextDueDate(addMonthsIso(vaccinationDate, 36))}
                    className="text-sky-700 hover:underline"
                  >
                    +3y
                  </button>
                </div>
              </div>
              <input
                type="date"
                required
                min={vaccinationDate}
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Clinical Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Injection site, lot observations, post-dose tolerance..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('vaccination-history')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Vaccination Record'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
