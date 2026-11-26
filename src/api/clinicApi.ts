import type {
  AnalyticsResponse,
  AuthUser,
  CsvImportResult,
  CustomerDashboardSummary,
  CustomerSummary,
  DashboardSummary,
  PetRecord,
  PetReportData,
  VaccinationRecord,
} from '../types/clinic.ts';

let memoryAuthToken: string | null = null;

export function setAuthToken(token: string | null): void {
  memoryAuthToken = token;
}

export function getAuthToken(): string | null {
  return memoryAuthToken;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) ?? {}),
  };
  if (memoryAuthToken) {
    headers.Authorization = `Bearer ${memoryAuthToken}`;
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function downloadAuthenticatedFile(url: string, filename: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (memoryAuthToken) {
    headers.Authorization = `Bearer ${memoryAuthToken}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export const clinicApi = {
  // Authentication
  getMe(): Promise<{ user: AuthUser }> {
    return request('/api/auth/me');
  },

  logout(): Promise<{ ok: boolean }> {
    return request('/api/auth/logout', { method: 'POST' });
  },

  getDoctorStatus(): Promise<{
    needsSetup: boolean;
    envOverrideActive: boolean;
    adminEmailHint: string | null;
  }> {
    return request('/api/auth/doctor-status');
  },

  setupInitialDoctor(payload: {
    full_name: string;
    email: string;
    phone_number: string;
    password: string;
    confirm_password: string;
  }): Promise<{ token: string; user: AuthUser }> {
    return request('/api/auth/doctor-setup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  doctorLogin(payload: {
    identifier: string;
    password: string;
  }): Promise<{ token: string; user: AuthUser }> {
    return request('/api/auth/doctor-login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  sendCustomerOtp(payload: {
    phone_number: string;
    purpose: 'signup' | 'reset';
  }): Promise<{
    ok: boolean;
    phone_number: string;
    expiresInSeconds: number;
    mode: 'sms' | 'demo';
    demoOtp?: string;
  }> {
    return request('/api/auth/customer/send-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  verifyCustomerSignup(payload: {
    full_name: string;
    phone_number: string;
    email: string;
    password: string;
    confirm_password: string;
    otp: string;
  }): Promise<{ token: string; user: AuthUser }> {
    return request('/api/auth/customer/verify-signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  customerLogin(payload: {
    phone_number: string;
    password: string;
  }): Promise<{ token: string; user: AuthUser }> {
    return request('/api/auth/customer/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  resetCustomerPassword(payload: {
    phone_number: string;
    otp: string;
    new_password: string;
    confirm_password: string;
  }): Promise<{ ok: boolean; message: string }> {
    return request('/api/auth/customer/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Doctor Endpoints
  getDashboard(): Promise<DashboardSummary> {
    return request<DashboardSummary>('/api/dashboard');
  },

  getCustomers(): Promise<CustomerSummary[]> {
    return request<CustomerSummary[]>('/api/customers');
  },

  getPets(params?: { search?: string; species?: string }): Promise<PetRecord[]> {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.species && params.species !== 'All') qs.set('species', params.species);
    const query = qs.toString();
    return request<PetRecord[]>(`/api/pets${query ? `?${query}` : ''}`);
  },

  createPet(payload: {
    pet_id: string;
    owner_user_id?: number | null;
    pet_name: string;
    species: string;
    breed: string;
    age: number;
    gender: string;
    date_of_birth: string;
    weight?: number | null;
    photo?: string;
    owner_name: string;
    owner_phone: string;
    owner_email: string;
  }): Promise<PetRecord> {
    return request<PetRecord>('/api/pets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updatePet(
    petId: string,
    payload: {
      pet_name: string;
      species: string;
      breed: string;
      age: number;
      gender: string;
      date_of_birth: string;
      weight?: number | null;
      photo?: string;
      owner_name: string;
      owner_phone: string;
      owner_email: string;
    }
  ): Promise<PetRecord> {
    return request<PetRecord>(`/api/pets/${encodeURIComponent(petId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deletePet(petId: string): Promise<{ deleted: boolean; pet_id: string; cascadedVaccinations: number }> {
    return request(`/api/pets/${encodeURIComponent(petId)}`, { method: 'DELETE' });
  },

  getVaccinations(params?: {
    search?: string;
    petId?: string;
    species?: string;
    vaccine?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<VaccinationRecord[]> {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.petId && params.petId !== 'ALL') qs.set('petId', params.petId);
    if (params?.species && params.species !== 'All') qs.set('species', params.species);
    if (params?.vaccine && params.vaccine !== 'All') qs.set('vaccine', params.vaccine);
    if (params?.status && params.status !== 'All') qs.set('status', params.status);
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    const query = qs.toString();
    return request<VaccinationRecord[]>(`/api/vaccinations${query ? `?${query}` : ''}`);
  },

  createVaccination(payload: {
    pet_id: string;
    vaccine_name: string;
    vaccination_date: string;
    next_due_date: string;
    veterinarian_name: string;
    notes: string;
  }): Promise<VaccinationRecord> {
    return request<VaccinationRecord>('/api/vaccinations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateVaccination(
    id: number,
    payload: {
      pet_id: string;
      vaccine_name: string;
      vaccination_date: string;
      next_due_date: string;
      veterinarian_name: string;
      notes: string;
    }
  ): Promise<VaccinationRecord> {
    return request<VaccinationRecord>(`/api/vaccinations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteVaccination(id: number): Promise<{ deleted: boolean; vaccination_id: number }> {
    return request(`/api/vaccinations/${id}`, { method: 'DELETE' });
  },

  getAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    species?: string;
    vaccine?: string;
  }): Promise<AnalyticsResponse> {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    if (params?.species && params.species !== 'All') qs.set('species', params.species);
    if (params?.vaccine && params.vaccine !== 'All') qs.set('vaccine', params.vaccine);
    const query = qs.toString();
    return request<AnalyticsResponse>(`/api/analytics${query ? `?${query}` : ''}`);
  },

  getPetReport(petId: string): Promise<PetReportData> {
    return request<PetReportData>(`/api/reports/pet/${encodeURIComponent(petId)}`);
  },

  importPetsCsv(payload: {
    csvText: string;
    mode: 'skip' | 'update';
    dryRun: boolean;
  }): Promise<CsvImportResult> {
    return request<CsvImportResult>('/api/import/pets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  importVaccinationsCsv(payload: {
    csvText: string;
    dryRun: boolean;
  }): Promise<CsvImportResult> {
    return request<CsvImportResult>('/api/import/vaccinations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Customer Portal Endpoints
  getCustomerDashboard(): Promise<CustomerDashboardSummary> {
    return request<CustomerDashboardSummary>('/api/customer/dashboard');
  },

  getCustomerPets(): Promise<PetRecord[]> {
    return request<PetRecord[]>('/api/customer/pets');
  },

  registerCustomerPet(payload: {
    pet_name: string;
    species: string;
    breed: string;
    date_of_birth: string;
    gender: string;
    weight?: number | null;
    photo?: string;
  }): Promise<PetRecord> {
    return request<PetRecord>('/api/customer/pets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getCustomerVaccinations(params?: {
    petId?: string;
    status?: string;
  }): Promise<VaccinationRecord[]> {
    const qs = new URLSearchParams();
    if (params?.petId && params.petId !== 'ALL') qs.set('petId', params.petId);
    if (params?.status && params.status !== 'All') qs.set('status', params.status);
    const query = qs.toString();
    return request<VaccinationRecord[]>(
      `/api/customer/vaccinations${query ? `?${query}` : ''}`
    );
  },

  getCustomerPetReport(petId: string): Promise<PetReportData> {
    return request<PetReportData>(
      `/api/customer/reports/pet/${encodeURIComponent(petId)}`
    );
  },

  updateCustomerProfile(payload: {
    full_name: string;
    email: string;
  }): Promise<{ user: AuthUser }> {
    return request('/api/customer/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  changeCustomerPassword(payload: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<{ ok: boolean; message: string }> {
    return request('/api/customer/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
