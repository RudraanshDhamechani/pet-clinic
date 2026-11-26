import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, AlertCircle, Syringe } from 'lucide-react';
import { clinicApi } from '../api/clinicApi.ts';
import type { CustomerSummary, DoctorNavSection, Gender, Species } from '../types/clinic.ts';

interface RegisterPetViewProps {
  preselectedCustomerId?: number | null;
  onPetCreated: (petId: string) => void;
  onNavigate: (section: DoctorNavSection) => void;
  onQuickLogVaccination: (petId: string) => void;
}

const SPECIES_OPTIONS: Species[] = ['Dog', 'Cat', 'Rabbit', 'Other'];
const GENDER_OPTIONS: Gender[] = ['Male', 'Female'];

export function RegisterPetView({
  preselectedCustomerId,
  onPetCreated,
  onNavigate,
  onQuickLogVaccination,
}: RegisterPetViewProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    preselectedCustomerId ? String(preselectedCustomerId) : ''
  );

  const [petId, setPetId] = useState('PET-1025');
  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState<Species>('Dog');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('1.5');
  const [gender, setGender] = useState<Gender>('Female');
  const [dob, setDob] = useState('');
  const [weight, setWeight] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([clinicApi.getPets(), clinicApi.getCustomers()])
      .then(([pets, customerList]) => {
        setCustomers(customerList);
        const maxNum = pets.reduce((max, p) => {
          const match = p.pet_id.match(/(\d+)$/);
          const n = match ? Number(match[1]) : 1000;
          return n > max ? n : max;
        }, 1000);
        setPetId(`PET-${maxNum + 1}`);

        if (preselectedCustomerId) {
          const found = customerList.find((c) => c.user_id === preselectedCustomerId);
          if (found) {
            setSelectedCustomerId(String(found.user_id));
            setOwnerName(found.full_name);
            setOwnerPhone(found.phone_number);
            setOwnerEmail(found.email ?? '');
          }
        }
      })
      .catch(() => {});
  }, [preselectedCustomerId]);

  const handleCustomerSelect = (val: string) => {
    setSelectedCustomerId(val);
    if (!val) return;
    const found = customers.find((c) => String(c.user_id) === val);
    if (found) {
      setOwnerName(found.full_name);
      setOwnerPhone(found.phone_number);
      setOwnerEmail(found.email ?? '');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatedId(null);

    const parsedAge = Number(age);
    if (!petId.trim() || !petName.trim() || !breed.trim() || !dob || !ownerName.trim()) {
      setError('Please complete all required patient and owner fields.');
      return;
    }
    if (dob > todayStr) {
      setError('Date of birth cannot be in the future.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await clinicApi.createPet({
        pet_id: petId.trim().toUpperCase(),
        owner_user_id: selectedCustomerId ? Number(selectedCustomerId) : null,
        pet_name: petName.trim(),
        species,
        breed: breed.trim(),
        age: parsedAge,
        gender,
        date_of_birth: dob,
        weight: weight.trim() ? Number(weight) : null,
        owner_name: ownerName.trim(),
        owner_phone: ownerPhone.trim(),
        owner_email: ownerEmail.trim(),
      });
      setCreatedId(created.pet_id);
      onPetCreated(created.pet_id);
      setPetName('');
      setBreed('');
      setDob('');
      setWeight('');
      if (!selectedCustomerId) {
        setOwnerName('');
        setOwnerPhone('');
        setOwnerEmail('');
      }
      const nextNumMatch = created.pet_id.match(/(\d+)$/);
      const nextNum = nextNumMatch ? Number(nextNumMatch[1]) + 1 : 1026;
      setPetId(`PET-${nextNum}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register pet.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Register New Pet
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Enroll a pet for an existing registered customer or walk-in pet owner.
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

      {createdId && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-900">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Pet <strong className="font-mono">{createdId}</strong> has been registered in SQLite.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onQuickLogVaccination(createdId)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
            >
              <Syringe className="w-3.5 h-3.5" />
              Add First Vaccination
            </button>
            <button
              onClick={() => onNavigate('all-pets')}
              className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors"
            >
              View All Pets
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
      >
        <div>
          <h2 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100">
            Patient Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Unique Pet ID *
              </label>
              <input
                type="text"
                required
                value={petId}
                onChange={(e) => setPetId(e.target.value.toUpperCase())}
                placeholder="PET-1025"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Pet Name *
              </label>
              <input
                type="text"
                required
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                placeholder="e.g., Archie"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Species *
              </label>
              <select
                value={species}
                onChange={(e) => setSpecies(e.target.value as Species)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                {SPECIES_OPTIONS.map((sp) => (
                  <option key={sp} value={sp}>
                    {sp}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Breed *
              </label>
              <input
                type="text"
                required
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                placeholder="e.g., Golden Retriever"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Age (Years) *
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="40"
                required
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Gender *
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Date of Birth *
              </label>
              <input
                type="date"
                required
                max={todayStr}
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Weight in kg (Optional)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="250"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g., 14.2"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100">
            Owner Assignment
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Link to Registered Customer Account (Optional)
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg"
              >
                <option value="">Walk-in / Manual Owner Details</option>
                {customers.map((c) => (
                  <option key={c.user_id} value={String(c.user_id)}>
                    {c.full_name} ({c.phone_number})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Owner Full Name *
              </label>
              <input
                type="text"
                required
                readOnly={Boolean(selectedCustomerId)}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g., Clara Henderson"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg read-only:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Phone Number (10–15 digits) *
              </label>
              <input
                type="tel"
                required
                readOnly={Boolean(selectedCustomerId)}
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="(555) 234-5678"
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg read-only:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                readOnly={Boolean(selectedCustomerId)}
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="clara@example.com"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg read-only:bg-slate-100"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onNavigate('all-pets')}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-60"
          >
            {submitting ? 'Registering...' : 'Register Pet'}
          </button>
        </div>
      </form>
    </div>
  );
}
