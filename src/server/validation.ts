import type { Gender, Species, VaccinationStatus } from '../types/clinic.ts';

export const ALLOWED_SPECIES = ['Dog', 'Cat', 'Rabbit', 'Bird', 'Other'] as const;
export const ALLOWED_GENDERS: Gender[] = ['Male', 'Female'];
export const COMMON_VACCINES = [
  'Rabies',
  'DHPP',
  'FVRCP',
  'Bordetella',
  'Leptospirosis',
  'FeLV',
  'Lyme',
  'RHDV2',
  'Canine Influenza',
] as const;

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function diffDays(fromDate: string, toDate: string): number {
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  const utcFrom = Date.UTC(fy, fm - 1, fd);
  const utcTo = Date.UTC(ty, tm - 1, td);
  return Math.round((utcTo - utcFrom) / 86400000);
}

export function computeAgeFromDob(dob: string, today: string = getTodayDateString()): number {
  const days = diffDays(dob, today);
  if (days <= 0) return 0;
  return Math.round((days / 365.25) * 10) / 10;
}

export function computeVaccinationStatus(
  nextDueDate: string,
  today: string = getTodayDateString()
): {
  status: VaccinationStatus;
  daysUntilDue: number;
  dueWithin7Days: boolean;
} {
  const daysUntilDue = diffDays(today, nextDueDate);
  if (daysUntilDue < 0) {
    return { status: 'Overdue', daysUntilDue, dueWithin7Days: false };
  }
  if (daysUntilDue === 0) {
    return { status: 'Due Today', daysUntilDue: 0, dueWithin7Days: true };
  }
  if (daysUntilDue <= 30) {
    return {
      status: 'Upcoming',
      daysUntilDue,
      dueWithin7Days: daysUntilDue <= 7,
    };
  }
  return { status: 'Completed', daysUntilDue, dueWithin7Days: false };
}

export function validatePetPhoto(rawPhoto: unknown): { ok: true; photo: string } | { ok: false; error: string } {
  const photo = String(rawPhoto ?? '').trim();
  if (!photo) return { ok: true, photo: '' };
  if (photo.length > 2_000_000) {
    return { ok: false, error: 'Pet photograph must be smaller than 1.5 MB.' };
  }
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)) {
    return { ok: false, error: 'Pet photograph must be a PNG, JPEG, or WebP image.' };
  }
  return { ok: true, photo };
}

export interface ValidatedPetPayload {
  pet_id: string;
  pet_name: string;
  species: Species;
  breed: string;
  age: number;
  gender: Gender;
  date_of_birth: string;
  weight: number | null;
  photo: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
}

export function validatePetInput(
  body: Record<string, unknown>
): { ok: true; data: ValidatedPetPayload } | { ok: false; error: string } {
  const today = getTodayDateString();
  const pet_id = String(body.pet_id ?? '').trim().toUpperCase();
  const pet_name = String(body.pet_name ?? '').trim();
  const speciesRaw = String(body.species ?? '').trim();
  const species = (speciesRaw === 'Bird' ? 'Other' : speciesRaw) as Species;
  const breed = String(body.breed ?? '').trim();
  const gender = String(body.gender ?? '').trim() as Gender;
  const date_of_birth = String(body.date_of_birth ?? '').trim();
  const owner_name = String(body.owner_name ?? '').trim();
  const owner_phone = String(body.owner_phone ?? '').trim();
  const owner_email = String(body.owner_email ?? '').trim();

  if (!/^[A-Z0-9-]{3,20}$/.test(pet_id)) {
    return {
      ok: false,
      error: 'Pet ID must be 3–20 characters using letters, numbers, or hyphens (e.g., PET-1025).',
    };
  }
  if (pet_name.length < 1 || pet_name.length > 80) {
    return { ok: false, error: 'Pet name is required (1–80 characters).' };
  }
  if (!ALLOWED_SPECIES.includes(speciesRaw as (typeof ALLOWED_SPECIES)[number])) {
    return { ok: false, error: 'Please select a valid species.' };
  }
  if (breed.length < 1 || breed.length > 80) {
    return { ok: false, error: 'Breed is required.' };
  }
  if (!ALLOWED_GENDERS.includes(gender)) {
    return { ok: false, error: 'Please select Male or Female for gender.' };
  }
  if (!isValidIsoDate(date_of_birth)) {
    return { ok: false, error: 'Date of birth must be a valid YYYY-MM-DD date.' };
  }
  if (date_of_birth > today) {
    return { ok: false, error: 'Date of birth cannot be in the future.' };
  }

  const ageRaw =
    body.age !== undefined && body.age !== ''
      ? Number(body.age)
      : computeAgeFromDob(date_of_birth, today);
  if (!Number.isFinite(ageRaw) || ageRaw < 0 || ageRaw > 40) {
    return { ok: false, error: 'Age must be a valid number between 0 and 40 years.' };
  }

  let weight: number | null = null;
  if (body.weight !== undefined && body.weight !== null && String(body.weight).trim() !== '') {
    const w = Number(body.weight);
    if (!Number.isFinite(w) || w <= 0 || w > 250) {
      return { ok: false, error: 'Weight must be a positive number up to 250 kg.' };
    }
    weight = Math.round(w * 10) / 10;
  }

  const photoCheck = validatePetPhoto(body.photo);
  if (!photoCheck.ok) {
    return { ok: false, error: photoCheck.error };
  }

  if (owner_name.length < 2 || owner_name.length > 100) {
    return { ok: false, error: 'Owner name is required (at least 2 characters).' };
  }
  const phoneDigits = owner_phone.replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return { ok: false, error: 'Owner phone number must contain 10 to 15 digits.' };
  }
  if (owner_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner_email)) {
    return { ok: false, error: 'Please enter a valid owner email address.' };
  }

  return {
    ok: true,
    data: {
      pet_id,
      pet_name,
      species,
      breed,
      age: Math.round(ageRaw * 10) / 10,
      gender,
      date_of_birth,
      weight,
      photo: photoCheck.photo,
      owner_name,
      owner_phone,
      owner_email: owner_email.toLowerCase(),
    },
  };
}

export interface ValidatedVaccinationPayload {
  pet_id: string;
  vaccine_name: string;
  vaccination_date: string;
  next_due_date: string;
  veterinarian_name: string;
  notes: string;
}

export function validateVaccinationInput(
  body: Record<string, unknown>
): { ok: true; data: ValidatedVaccinationPayload } | { ok: false; error: string } {
  const today = getTodayDateString();
  const pet_id = String(body.pet_id ?? '').trim().toUpperCase();
  const vaccine_name = String(body.vaccine_name ?? '').trim();
  const vaccination_date = String(body.vaccination_date ?? '').trim();
  const next_due_date = String(body.next_due_date ?? '').trim();
  const veterinarian_name = String(body.veterinarian_name ?? '').trim();
  const notes = String(body.notes ?? '').trim().slice(0, 500);

  if (!pet_id) {
    return { ok: false, error: 'A registered Pet ID is required.' };
  }
  if (vaccine_name.length < 2 || vaccine_name.length > 80) {
    return { ok: false, error: 'Vaccine name is required.' };
  }
  if (!isValidIsoDate(vaccination_date)) {
    return { ok: false, error: 'Vaccination date must be a valid YYYY-MM-DD date.' };
  }
  if (vaccination_date > today) {
    return { ok: false, error: 'Vaccination date cannot be in the future.' };
  }
  if (!isValidIsoDate(next_due_date)) {
    return { ok: false, error: 'Next due date must be a valid YYYY-MM-DD date.' };
  }
  if (next_due_date < vaccination_date) {
    return {
      ok: false,
      error: 'Next vaccination due date cannot be earlier than the vaccination date.',
    };
  }
  if (veterinarian_name.length < 2 || veterinarian_name.length > 100) {
    return { ok: false, error: 'Veterinarian name is required.' };
  }

  return {
    ok: true,
    data: {
      pet_id,
      vaccine_name,
      vaccination_date,
      next_due_date,
      veterinarian_name,
      notes,
    },
  };
}

export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}
