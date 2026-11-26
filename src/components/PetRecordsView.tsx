import { useEffect, useState, type FormEvent } from 'react';
import { Eye, PawPrint, Pencil, Plus, Search, Syringe, Trash2, X } from 'lucide-react';
import { clinicApi } from '../api/clinicApi.ts';
import type { DoctorNavSection, Gender, PetRecord, Species } from '../types/clinic.ts';
import { StatusIndicator } from './StatusIndicator.tsx';

interface PetRecordsViewProps {
  onNavigate: (section: DoctorNavSection) => void;
  onQuickLogVaccination: (petId: string) => void;
  onViewPetHistory: (petId: string) => void;
  onDataChanged: () => void;
  refreshKey: number;
}

const SPECIES_FILTERS = ['All', 'Dog', 'Cat', 'Rabbit', 'Other'] as const;

export function PetRecordsView({
  onNavigate,
  onQuickLogVaccination,
  onViewPetHistory,
  onDataChanged,
  refreshKey,
}: PetRecordsViewProps) {
  const [pets, setPets] = useState<PetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState<string>('All');
  const [error, setError] = useState<string | null>(null);

  const [profilePet, setProfilePet] = useState<PetRecord | null>(null);
  const [editingPet, setEditingPet] = useState<PetRecord | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deletingPet, setDeletingPet] = useState<PetRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPets = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await clinicApi.getPets({
        search: search.trim() || undefined,
        species: speciesFilter,
      });
      setPets(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pet records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPets();
  }, [speciesFilter, refreshKey]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetchPets();
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingPet) return;
    setEditError(null);
    setSaving(true);
    try {
      await clinicApi.updatePet(editingPet.pet_id, {
        pet_name: editingPet.pet_name,
        species: editingPet.species,
        breed: editingPet.breed,
        age: Number(editingPet.age),
        gender: editingPet.gender,
        date_of_birth: editingPet.date_of_birth,
        weight: editingPet.weight ?? null,
        owner_name: editingPet.owner_name,
        owner_phone: editingPet.owner_phone,
        owner_email: editingPet.owner_email,
      });
      setEditingPet(null);
      onDataChanged();
      fetchPets();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update pet.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingPet) return;
    setDeleting(true);
    try {
      await clinicApi.deletePet(deletingPet.pet_id);
      setDeletingPet(null);
      onDataChanged();
      fetchPets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pet.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            All Registered Pets
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Clinic-wide directory across all pet owners. Search by pet name, pet ID, or owner&apos;s name.
          </p>
        </div>
        <button
          onClick={() => onNavigate('register-pet')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Register New Pet
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Pet ID, Pet Name, or Owner..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {SPECIES_FILTERS.map((sp) => (
            <button
              key={sp}
              onClick={() => setSpeciesFilter(sp)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                speciesFilter === sp
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {sp}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">Pet ID</th>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Species &amp; Breed</th>
                <th className="py-3 px-4 text-right">Age</th>
                <th className="py-3 px-4">Owner &amp; Contact</th>
                <th className="py-3 px-4 text-right">Doses</th>
                <th className="py-3 px-4">Schedule Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="py-3.5 px-4">
                      <div className="h-5 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : pets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 px-4 text-center text-slate-500">
                    No pets matched your search criteria.
                  </td>
                </tr>
              ) : (
                pets.map((pet) => (
                  <tr key={pet.pet_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {pet.pet_id}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        {pet.photo ? (
                          <img
                            src={pet.photo}
                            alt={pet.pet_name}
                            className="w-8 h-8 rounded-md object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <span className="w-8 h-8 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                            <PawPrint className="w-4 h-4" />
                          </span>
                        )}
                        <div>
                          <div className="font-medium text-slate-900">{pet.pet_name}</div>
                          <div className="text-xs text-slate-500">
                            {pet.gender} · DOB{' '}
                            <span className="font-mono tabular-nums">{pet.date_of_birth}</span>
                            {pet.is_sample === 1 && (
                              <>
                                {' · '}
                                <span className="text-teal-700 font-medium">Demo</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="text-slate-800">{pet.species}</div>
                      <div className="text-xs text-slate-500">{pet.breed}</div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {pet.age}y
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="text-slate-800">{pet.owner_name}</div>
                      <div className="text-xs text-slate-500 font-mono">{pet.owner_phone}</div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-slate-800">
                      {pet.vaccination_count ?? 0}
                    </td>
                    <td className="py-2.5 px-4">
                      {pet.latest_status ? (
                        <StatusIndicator status={pet.latest_status} />
                      ) : (
                        <span className="text-xs text-slate-400">No doses logged</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setProfilePet(pet)}
                          title="View Pet Profile"
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onQuickLogVaccination(pet.pet_id)}
                          title="Add Vaccination"
                          className="p-1.5 text-teal-700 hover:bg-teal-50 rounded-md"
                        >
                          <Syringe className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onViewPetHistory(pet.pet_id)}
                          className="px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50 rounded-md"
                        >
                          History
                        </button>
                        <button
                          onClick={() => {
                            setEditError(null);
                            setEditingPet({ ...pet });
                          }}
                          title="Edit Pet"
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingPet(pet)}
                          title="Delete Pet"
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
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

      {/* Individual Pet Profile Modal */}
      {profilePet && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Patient Profile: {profilePet.pet_name} ({profilePet.pet_id})
              </h2>
              <button
                onClick={() => setProfilePet(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {profilePet.photo && (
              <img
                src={profilePet.photo}
                alt={profilePet.pet_name}
                className="w-full h-44 object-cover rounded-lg border border-slate-200"
              />
            )}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Species &amp; Breed</span>
                <strong className="text-slate-900">
                  {profilePet.species} · {profilePet.breed}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Gender &amp; Age</span>
                <strong className="text-slate-900">
                  {profilePet.gender} · {profilePet.age} years
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Date of Birth</span>
                <strong className="font-mono text-slate-900">{profilePet.date_of_birth}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Weight</span>
                <strong className="font-mono text-slate-900">
                  {profilePet.weight ? `${profilePet.weight} kg` : 'Not recorded'}
                </strong>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-100">
                <span className="text-slate-500 block">Owner Contact Details</span>
                <strong className="text-slate-900 block">{profilePet.owner_name}</strong>
                <div className="text-slate-600 font-mono">
                  {profilePet.owner_phone} {profilePet.owner_email ? `· ${profilePet.owner_email}` : ''}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  const id = profilePet.pet_id;
                  setProfilePet(null);
                  onQuickLogVaccination(id);
                }}
                className="px-3.5 py-2 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700"
              >
                Add Vaccination
              </button>
              <button
                onClick={() => {
                  const id = profilePet.pet_id;
                  setProfilePet(null);
                  onViewPetHistory(id);
                }}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg"
              >
                Vaccination History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Pet Modal */}
      {editingPet && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900">
                Edit Patient <span className="font-mono">{editingPet.pet_id}</span>
              </h2>
              <button
                onClick={() => setEditingPet(null)}
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
            <form onSubmit={handleSaveEdit} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Pet Name</label>
                <input
                  type="text"
                  required
                  value={editingPet.pet_name}
                  onChange={(e) => setEditingPet({ ...editingPet, pet_name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Species</label>
                <select
                  value={editingPet.species}
                  onChange={(e) =>
                    setEditingPet({ ...editingPet, species: e.target.value as Species })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                >
                  {(['Dog', 'Cat', 'Rabbit', 'Other'] as Species[]).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Breed</label>
                <input
                  type="text"
                  required
                  value={editingPet.breed}
                  onChange={(e) => setEditingPet({ ...editingPet, breed: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Age (Years)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="40"
                  required
                  value={editingPet.age}
                  onChange={(e) => setEditingPet({ ...editingPet, age: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                <select
                  value={editingPet.gender}
                  onChange={(e) =>
                    setEditingPet({ ...editingPet, gender: e.target.value as Gender })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  required
                  value={editingPet.date_of_birth}
                  onChange={(e) => setEditingPet({ ...editingPet, date_of_birth: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Owner Name</label>
                <input
                  type="text"
                  required
                  value={editingPet.owner_name}
                  onChange={(e) => setEditingPet({ ...editingPet, owner_name: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Owner Phone</label>
                <input
                  type="text"
                  required
                  value={editingPet.owner_phone}
                  onChange={(e) => setEditingPet({ ...editingPet, owner_phone: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Owner Email</label>
                <input
                  type="email"
                  value={editingPet.owner_email}
                  onChange={(e) => setEditingPet({ ...editingPet, owner_email: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPet(null)}
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

      {/* Delete Pet Confirmation Modal */}
      {deletingPet && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Delete Pet Record</h2>
            <p className="text-sm text-slate-600">
              Are you sure you want to remove <strong>{deletingPet.pet_name}</strong> (
              <span className="font-mono">{deletingPet.pet_id}</span>)? This will also remove{' '}
              <strong className="font-mono tabular-nums">
                {deletingPet.vaccination_count ?? 0}
              </strong>{' '}
              linked vaccination record(s).
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingPet(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete Pet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
