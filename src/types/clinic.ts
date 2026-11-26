export type Species = 'Dog' | 'Cat' | 'Rabbit' | 'Other';
export type Gender = 'Male' | 'Female';
export type VaccinationStatus = 'Completed' | 'Upcoming' | 'Due Today' | 'Overdue';
export type UserRole = 'doctor' | 'customer';

export interface AuthUser {
  user_id: number;
  full_name: string;
  phone_number: string;
  email: string | null;
  role: UserRole;
  is_verified: number;
  created_at: string;
}

export interface CustomerSummary {
  user_id: number;
  full_name: string;
  phone_number: string;
  email: string | null;
  is_verified: number;
  created_at: string;
  pet_count: number;
}

export interface PetRecord {
  pet_id: string;
  owner_user_id: number | null;
  pet_name: string;
  species: Species;
  breed: string;
  age: number;
  gender: Gender;
  date_of_birth: string;
  weight?: number | null;
  photo?: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  is_sample: number;
  created_at: string;
  vaccination_count?: number;
  latest_status?: VaccinationStatus | null;
  next_due_date?: string | null;
}

export interface VaccinationRecord {
  vaccination_id: number;
  pet_id: string;
  pet_name?: string;
  species?: Species;
  breed?: string;
  owner_name?: string;
  owner_phone?: string;
  vaccine_name: string;
  vaccination_date: string;
  next_due_date: string;
  veterinarian_name: string;
  notes: string;
  created_by?: number | null;
  is_sample: number;
  created_at: string;
  status: VaccinationStatus;
  days_until_due: number;
  due_within_7_days: boolean;
}

export interface DashboardSummary {
  today: string;
  kpis: {
    totalPets: number;
    totalCustomers: number;
    totalVaccinations: number;
    upcomingVaccinations: number;
    dueTodayVaccinations: number;
    dueWithin7Days: number;
    overdueVaccinations: number;
    completedThisMonth: number;
  };
  alerts: {
    dueToday: VaccinationRecord[];
    dueWithin7Days: VaccinationRecord[];
    overdue: VaccinationRecord[];
  };
  monthlyOverview: {
    month: string;
    label: string;
    count: number;
  }[];
  recentVaccinations: VaccinationRecord[];
}

export interface CustomerDashboardSummary {
  today: string;
  kpis: {
    myPets: number;
    totalCompleted: number;
    upcomingVaccinations: number;
    overdueVaccinations: number;
    dueWithin7Days: number;
  };
  alerts: {
    dueToday: VaccinationRecord[];
    dueWithin7Days: VaccinationRecord[];
    overdue: VaccinationRecord[];
  };
  pets: PetRecord[];
  upcomingSchedule: VaccinationRecord[];
}

export interface AnalyticsResponse {
  filters: {
    startDate: string;
    endDate: string;
    species: string;
    vaccine: string;
  };
  filterOptions: {
    species: string[];
    vaccines: string[];
    minDate: string;
    maxDate: string;
  };
  totals: {
    totalRecords: number;
    uniquePets: number;
    uniqueVaccines: number;
  };
  monthlyTrend: {
    month: string;
    label: string;
    count: number;
  }[];
  topVaccines: {
    vaccine_name: string;
    count: number;
  }[];
  speciesDistribution: {
    species: string;
    count: number;
    percentage: number;
  }[];
  monthlyComparison: {
    monthNum: number;
    monthLabel: string;
    [yearKey: string]: string | number;
  }[];
  comparisonYears: string[];
  statusBreakdown: {
    status: VaccinationStatus;
    count: number;
  }[];
  yearlyComparison: {
    year: string;
    count: number;
    uniquePets: number;
  }[];
}

export interface PetReportData {
  pet: PetRecord;
  vaccinations: VaccinationRecord[];
  generatedAt: string;
}

export type DoctorNavSection =
  | 'overview'
  | 'all-pets'
  | 'all-customers'
  | 'register-pet'
  | 'add-vaccination'
  | 'vaccination-history'
  | 'upcoming-vaccinations'
  | 'overdue-vaccinations'
  | 'trend-analysis'
  | 'reports'
  | 'import-csv';

export type CustomerNavSection =
  | 'my-dashboard'
  | 'register-my-pet'
  | 'my-pets'
  | 'my-history'
  | 'my-upcoming'
  | 'my-reports'
  | 'my-profile';

export interface CsvImportRowResult {
  row: number;
  identifier: string;
  label: string;
  action: 'insert' | 'update' | 'skip' | 'error';
  reason: string;
}

export interface CsvImportResult {
  dryRun: boolean;
  dataset: 'pets' | 'vaccinations';
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  errorsCount: number;
  rows: CsvImportRowResult[];
}

