import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PawPrint,
  Plus,
  Printer,
  Shield,
  Upload,
  User,
  X,
} from 'lucide-react';
import { clinicApi } from '../api/clinicApi.ts';
import type {
  AuthUser,
  CustomerDashboardSummary,
  CustomerNavSection,
  Gender,
  PetRecord,
  PetReportData,
  Species,
  VaccinationRecord,
} from '../types/clinic.ts';
import { downloadPetVaccinationPdf } from '../utils/pdfReport.ts';
import { StatusIndicator } from './StatusIndicator.tsx';

interface CustomerPortalProps {
  user: AuthUser;
  onUserUpdated: (user: AuthUser) => void;
  onLogout: () => void;
}

const CUSTOMER_NAV: { id: CustomerNavSection; label: string; Icon: typeof LayoutDashboard }[] = [
  { id: 'my-dashboard', label: 'My Dashboard', Icon: LayoutDashboard },
  { id: 'register-my-pet', label: 'Register My Pet', Icon: Plus },
  { id: 'my-pets', label: 'My Pets', Icon: PawPrint },
  { id: 'my-history', label: 'Vaccination History', Icon: History },
  { id: 'my-upcoming', label: 'Upcoming Vaccinations', Icon: CalendarClock },
  { id: 'my-reports', label: 'Vaccination Reports', Icon: FileText },
  { id: 'my-profile', label: 'My Profile', Icon: User },
];

export function CustomerPortal({ user, onUserUpdated, onLogout }: CustomerPortalProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [section, setSection] = useState<CustomerNavSection>('my-dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [dashboard, setDashboard] = useState<CustomerDashboardSummary | null>(null);
  const [pets, setPets] = useState<PetRecord[]>([]);
  const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected pet for History / Reports / Details modal
  const [selectedHistoryPetId, setSelectedHistoryPetId] = useState<string>('ALL');
  const [selectedReportPetId, setSelectedReportPetId] = useState<string>('');
  const [petReport, setPetReport] = useState<PetReportData | null>(null);
  const [detailPet, setDetailPet] = useState<PetRecord | null>(null);

  // Register My Pet form
  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState<Species>('Dog');
  const [breed, setBreed] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender>('Female');
  const [weight, setWeight] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [petError, setPetError] = useState<string | null>(null);
  const [petSuccess, setPetSuccess] = useState<string | null>(null);
  const [submittingPet, setSubmittingPet] = useState(false);

  // Profile & Password state
  const [profileName, setProfileName] = useState(user.full_name);
  const [profileEmail, setProfileEmail] = useState(user.email ?? '');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confPass, setConfPass] = useState('');
  const [passMsg, setPassMsg] = useState<string | null>(null);
  const [passErr, setPassErr] = useState<string | null>(null);
  const [savingPass, setSavingPass] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dash, myPets, myVax] = await Promise.all([
        clinicApi.getCustomerDashboard(),
        clinicApi.getCustomerPets(),
        clinicApi.getCustomerVaccinations(),
      ]);
      setDashboard(dash);
      setPets(myPets);
      setVaccinations(myVax);
      if (myPets.length > 0 && !myPets.some((p) => p.pet_id === selectedReportPetId)) {
        setSelectedReportPetId(myPets[0].pet_id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedReportPetId) {
      setPetReport(null);
      return;
    }
    clinicApi
      .getCustomerPetReport(selectedReportPetId)
      .then(setPetReport)
      .catch(() => setPetReport(null));
  }, [selectedReportPetId, refreshKey]);

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoDataUrl('');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setPetError('Please choose a PNG, JPEG, or WebP photograph.');
      return;
    }
    if (file.size > 1_400_000) {
      setPetError('Photograph must be under 1.4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
        setPetError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterPet = async (e: FormEvent) => {
    e.preventDefault();
    setPetError(null);
    setPetSuccess(null);

    if (!petName.trim() || !breed.trim() || !dob) {
      setPetError('Please complete Pet Name, Breed, and Date of Birth.');
      return;
    }
    if (dob > todayStr) {
      setPetError('Date of birth cannot be in the future.');
      return;
    }

    setSubmittingPet(true);
    try {
      const created = await clinicApi.registerCustomerPet({
        pet_name: petName.trim(),
        species,
        breed: breed.trim(),
        date_of_birth: dob,
        gender,
        weight: weight.trim() ? Number(weight) : null,
        photo: photoDataUrl || undefined,
      });
      setPetSuccess(`${created.pet_name} (${created.pet_id}) has been registered to your account.`);
      setPetName('');
      setBreed('');
      setDob('');
      setWeight('');
      setPhotoDataUrl('');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setPetError(err instanceof Error ? err.message : 'Failed to register pet.');
    } finally {
      setSubmittingPet(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileErr(null);
    setProfileMsg(null);
    setSavingProfile(true);
    try {
      const res = await clinicApi.updateCustomerProfile({
        full_name: profileName.trim(),
        email: profileEmail.trim(),
      });
      onUserUpdated(res.user);
      setProfileMsg('Profile details updated.');
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPassErr(null);
    setPassMsg(null);
    setSavingPass(true);
    try {
      const res = await clinicApi.changeCustomerPassword({
        current_password: curPass,
        new_password: newPass,
        confirm_password: confPass,
      });
      setPassMsg(res.message);
      setCurPass('');
      setNewPass('');
      setConfPass('');
    } catch (err) {
      setPassErr(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setSavingPass(false);
    }
  };

  const navigate = (next: CustomerNavSection) => {
    setSection(next);
    setMobileMenuOpen(false);
  };

  const handleDownloadPetPdf = async (petId: string) => {
    const rep = await clinicApi.getCustomerPetReport(petId);
    downloadPetVaccinationPdf(rep);
  };

  const activeNavMeta = CUSTOMER_NAV.find((n) => n.id === section) ?? CUSTOMER_NAV[0];

  const historyList =
    selectedHistoryPetId === 'ALL'
      ? vaccinations
      : vaccinations.filter((v) => v.pet_id === selectedHistoryPetId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/40 to-slate-50 text-slate-900 flex">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Teal-Accented Pet Owner Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-150 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
          <button onClick={() => navigate('my-dashboard')} className="flex items-center gap-2.5 text-left">
            <span className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
              <PawPrint className="w-4 h-4" />
            </span>
            <span className="font-display font-bold text-sm leading-tight text-slate-900">
              Pawsitive Care
              <span className="block text-[11px] font-normal text-teal-700">
                Pet Owner Portal
              </span>
            </span>
          </button>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Pet Owner Navigation">
          {CUSTOMER_NAV.map(({ id, label, Icon }) => {
            const isActive = section === id;
            return (
              <button
                key={id}
                onClick={() => navigate(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-600' : 'text-slate-400'}`}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-900 truncate">{user.full_name}</div>
            <div className="text-[11px] font-mono text-slate-500 truncate">{user.phone_number}</div>
          </div>
          <button
            onClick={onLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Customer Workspace */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="h-16 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:text-slate-900 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="font-semibold text-teal-800 hidden sm:inline whitespace-nowrap">
                Pet Owner Portal
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="text-slate-700 font-medium truncate">{activeNavMeta.label}</span>
            </div>
          </div>

          <button
            onClick={() => navigate('register-my-pet')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Register My Pet
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1240px] w-full mx-auto space-y-6">
          {/* 1. MY DASHBOARD */}
          {section === 'my-dashboard' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-teal-700">
                    Welcome back, {user.full_name}
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
                    Your Pet Health &amp; Vaccination Overview
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Track booster schedules, view veterinarian-approved immunization logs, and download official PDF certificates.
                  </p>
                </div>
                <button
                  onClick={() => navigate('my-upcoming')}
                  className="px-4 py-2 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                >
                  View Full Schedule
                </button>
              </div>

              {/* 4 Customer KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <span className="text-xs font-medium text-slate-500">My Registered Pets</span>
                  <div className="text-3xl font-bold font-mono tabular-nums text-teal-700 mt-2">
                    {dashboard?.kpis.myPets ?? 0}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">Linked to your account</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <span className="text-xs font-medium text-slate-500">Total Vaccinations Completed</span>
                  <div className="text-3xl font-bold font-mono tabular-nums text-emerald-700 mt-2">
                    {dashboard?.kpis.totalCompleted ?? 0}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">Current immunizations</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <span className="text-xs font-medium text-slate-500">Upcoming Vaccinations</span>
                  <div className="text-3xl font-bold font-mono tabular-nums text-orange-600 mt-2">
                    {dashboard?.kpis.upcomingVaccinations ?? 0}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">
                    {dashboard?.kpis.dueWithin7Days ?? 0} due within 7 days
                  </span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <span className="text-xs font-medium text-slate-500">Overdue Vaccinations</span>
                  <div className="text-3xl font-bold font-mono tabular-nums text-red-700 mt-2">
                    {dashboard?.kpis.overdueVaccinations ?? 0}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">Schedule clinic visit</span>
                </div>
              </div>

              {/* Personal Reminders (7-day, Today, Overdue) */}
              {dashboard &&
                dashboard.alerts.overdue.length +
                  dashboard.alerts.dueToday.length +
                  dashboard.alerts.dueWithin7Days.length >
                  0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Bell className="w-4 h-4 text-teal-600" />
                      Personal Vaccination Reminders
                    </div>
                    <div className="divide-y divide-slate-100">
                      {[
                        ...dashboard.alerts.overdue,
                        ...dashboard.alerts.dueToday,
                        ...dashboard.alerts.dueWithin7Days,
                      ].map((item) => (
                        <div
                          key={item.vaccination_id}
                          className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <div>
                            <strong className="text-slate-900">{item.pet_name}</strong> ·{' '}
                            <span className="text-slate-700">{item.vaccine_name}</span>{' '}
                            <span className="text-xs font-mono text-slate-500">
                              (Next due: {item.next_due_date})
                            </span>
                          </div>
                          <StatusIndicator
                            status={item.status}
                            daysUntilDue={item.days_until_due}
                            showDays
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Empty state when customer hasn't added a pet yet */}
              {!loading && pets.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
                  <PawPrint className="w-9 h-9 text-teal-600 mx-auto" />
                  <h2 className="text-base font-semibold text-slate-900">
                    Register Your First Pet
                  </h2>
                  <p className="text-sm text-slate-600 max-w-md mx-auto">
                    Add your dog, cat, or rabbit to track doctor-recorded immunizations and receive due-date reminders.
                  </p>
                  <button
                    onClick={() => navigate('register-my-pet')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                  >
                    <Plus className="w-4 h-4" />
                    Register My Pet
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. REGISTER MY PET */}
          {section === 'register-my-pet' && (
            <div className="max-w-2xl space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Register My Pet</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Your new pet is automatically linked to your verified account ({user.full_name}).
                </p>
              </div>

              {petError && (
                <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <span>{petError}</span>
                </div>
              )}
              {petSuccess && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-900">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{petSuccess}</span>
                  </div>
                  <button
                    onClick={() => navigate('my-pets')}
                    className="px-3 py-1 text-xs font-medium bg-white border border-emerald-300 rounded-lg text-emerald-800"
                  >
                    View My Pets
                  </button>
                </div>
              )}

              <form
                onSubmit={handleRegisterPet}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Pet Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      placeholder="e.g., Bruno"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Species *
                    </label>
                    <select
                      value={species}
                      onChange={(e) => setSpecies(e.target.value as Species)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    >
                      {(['Dog', 'Cat', 'Rabbit', 'Other'] as Species[]).map((sp) => (
                        <option key={sp} value={sp}>
                          {sp}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Breed *</label>
                    <input
                      type="text"
                      required
                      value={breed}
                      onChange={(e) => setBreed(e.target.value)}
                      placeholder="e.g., Labrador"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      required
                      max={todayStr}
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Gender *</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as Gender)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Weight in kg (Optional)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="250"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="e.g., 18.5"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Pet Photograph (Optional, PNG/JPEG/WebP under 1.4 MB)
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        Choose Photo
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                      {photoDataUrl && (
                        <div className="flex items-center gap-2">
                          <img
                            src={photoDataUrl}
                            alt="Pet preview"
                            className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => setPhotoDataUrl('')}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => navigate('my-pets')}
                    className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPet}
                    className="px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60"
                  >
                    {submittingPet ? 'Registering...' : 'Register Pet'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 3. MY PETS (Card Grid with Photos + View Details) */}
          {section === 'my-pets' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">My Pets</h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Pets registered under your account ({pets.length} total).
                  </p>
                </div>
                <button
                  onClick={() => navigate('register-my-pet')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                >
                  <Plus className="w-4 h-4" />
                  Register My Pet
                </button>
              </div>

              {pets.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
                  <p className="text-sm text-slate-600">You have not registered any pets yet.</p>
                  <button
                    onClick={() => navigate('register-my-pet')}
                    className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg"
                  >
                    Register My Pet
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {pets.map((pet) => (
                    <div
                      key={pet.pet_id}
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
                    >
                      <div className="h-44 bg-sky-50 border-b border-slate-200 flex items-center justify-center overflow-hidden">
                        {pet.photo ? (
                          <img
                            src={pet.photo}
                            alt={pet.pet_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center text-teal-700/70">
                            <PawPrint className="w-10 h-10 mb-1" />
                            <span className="text-xs font-medium">{pet.species}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h2 className="text-lg font-bold text-slate-900">{pet.pet_name}</h2>
                            <span className="text-xs font-mono text-slate-500">{pet.pet_id}</span>
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            {pet.species} · {pet.breed} · {pet.age}y
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Total Vaccinations</span>
                              <span className="font-mono tabular-nums font-semibold text-slate-800">
                                {pet.vaccination_count ?? 0}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Next Due Date</span>
                              <span className="font-mono tabular-nums text-slate-800">
                                {pet.next_due_date ?? 'No schedule yet'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={() => setDetailPet(pet)}
                            className="flex-1 py-2 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => {
                              setSelectedHistoryPetId(pet.pet_id);
                              navigate('my-history');
                            }}
                            className="px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                          >
                            History
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pet Details Modal */}
              {detailPet && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
                  <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h2 className="text-base font-bold text-slate-900">
                        {detailPet.pet_name} ({detailPet.pet_id})
                      </h2>
                      <button
                        onClick={() => setDetailPet(null)}
                        className="p-1 text-slate-400 hover:text-slate-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block">Species &amp; Breed</span>
                        <strong className="text-slate-900">
                          {detailPet.species} · {detailPet.breed}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Gender &amp; Age</span>
                        <strong className="text-slate-900">
                          {detailPet.gender} · {detailPet.age} years
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Date of Birth</span>
                        <strong className="font-mono text-slate-900">
                          {detailPet.date_of_birth}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Weight</span>
                        <strong className="font-mono text-slate-900">
                          {detailPet.weight ? `${detailPet.weight} kg` : 'Not specified'}
                        </strong>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleDownloadPetPdf(detailPet.pet_id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download PDF Report
                      </button>
                      <button
                        onClick={() => {
                          const id = detailPet.pet_id;
                          setDetailPet(null);
                          setSelectedHistoryPetId(id);
                          navigate('my-history');
                        }}
                        className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg"
                      >
                        View History
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. VACCINATION HISTORY (Read-Only Doctor-Approved Logs + PDF Download) */}
          {section === 'my-history' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">My Vaccination History</h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Doctor-approved immunization logs for your pets (read-only).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedHistoryPetId}
                    onChange={(e) => setSelectedHistoryPetId(e.target.value)}
                    className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="ALL">All My Pets</option>
                    {pets.map((p) => (
                      <option key={p.pet_id} value={p.pet_id}>
                        {p.pet_name} ({p.pet_id})
                      </option>
                    ))}
                  </select>
                  {selectedHistoryPetId !== 'ALL' && (
                    <button
                      onClick={() => handleDownloadPetPdf(selectedHistoryPetId)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download PDF
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                        <th className="py-3 px-4">Pet</th>
                        <th className="py-3 px-4">Vaccine Name</th>
                        <th className="py-3 px-4">Vaccination Date</th>
                        <th className="py-3 px-4">Next Due Date</th>
                        <th className="py-3 px-4">Veterinarian</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {historyList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-500">
                            No vaccination records logged for the selected pet yet.
                          </td>
                        </tr>
                      ) : (
                        historyList.map((v) => (
                          <tr key={v.vaccination_id}>
                            <td className="py-2.5 px-4 font-medium text-slate-900">
                              {v.pet_name}{' '}
                              <span className="text-xs font-mono text-slate-400">{v.pet_id}</span>
                            </td>
                            <td className="py-2.5 px-4 font-medium text-slate-800">
                              {v.vaccine_name}
                            </td>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-600">
                              {v.vaccination_date}
                            </td>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-700 font-medium">
                              {v.next_due_date}
                            </td>
                            <td className="py-2.5 px-4 text-slate-700">{v.veterinarian_name}</td>
                            <td className="py-2.5 px-4">
                              <StatusIndicator status={v.status} />
                            </td>
                            <td className="py-2.5 px-4 text-xs text-slate-500">
                              {v.notes || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 5. UPCOMING VACCINATIONS */}
          {section === 'my-upcoming' && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Upcoming Vaccinations</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Color-coded immunization schedule for your pets: Green (Completed), Orange (Upcoming), Red (Overdue), Blue (Due Today).
                </p>
              </div>

              {dashboard && dashboard.alerts.dueWithin7Days.length > 0 && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-orange-950">
                    <strong>Due Within the Next 7 Days:</strong>{' '}
                    {dashboard.alerts.dueWithin7Days
                      .map((d) => `${d.pet_name} (${d.vaccine_name} on ${d.next_due_date})`)
                      .join(', ')}
                  </div>
                </div>
              )}

              {vaccinations.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
                  No scheduled vaccinations found for your pets yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vaccinations.map((v) => {
                    const borderTone =
                      v.status === 'Overdue'
                        ? 'border-red-200 bg-red-50/30'
                        : v.status === 'Due Today'
                          ? 'border-sky-200 bg-sky-50/40'
                          : v.status === 'Upcoming'
                            ? 'border-orange-200 bg-orange-50/30'
                            : 'border-emerald-200 bg-emerald-50/20';
                    return (
                      <div
                        key={v.vaccination_id}
                        className={`border rounded-xl p-5 space-y-2.5 ${borderTone}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-base font-bold text-slate-900">
                            Pet: {v.pet_name}
                          </div>
                          <StatusIndicator
                            status={v.status}
                            daysUntilDue={v.days_until_due}
                            showDays
                          />
                        </div>
                        <div className="text-sm text-slate-800">
                          Vaccine: <strong>{v.vaccine_name}</strong>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                          <div>
                            Last Vaccination:{' '}
                            <span className="font-mono text-slate-900">{v.vaccination_date}</span>
                          </div>
                          <div>
                            Next Due Date:{' '}
                            <span className="font-mono font-semibold text-slate-900">
                              {v.next_due_date}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 6. VACCINATION REPORTS (PDF Download) */}
          {section === 'my-reports' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 no-print">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Vaccination Reports</h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Download or print official immunization PDF reports for your pets.
                  </p>
                </div>
                {pets.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedReportPetId}
                      onChange={(e) => setSelectedReportPetId(e.target.value)}
                      className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    >
                      {pets.map((p) => (
                        <option key={p.pet_id} value={p.pet_id}>
                          {p.pet_name} ({p.pet_id})
                        </option>
                      ))}
                    </select>
                    {petReport && (
                      <>
                        <button
                          onClick={() => downloadPetVaccinationPdf(petReport)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                        >
                          <Download className="w-4 h-4" />
                          Download PDF
                        </button>
                        <button
                          onClick={() => window.print()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                        >
                          <Printer className="w-4 h-4" />
                          Print
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {!petReport ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                  Register a pet first to generate a vaccination report.
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex flex-wrap justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <div className="text-xs font-medium text-teal-700">
                        Pawsitive Care Veterinary Clinic — Immunization Certificate
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                        {petReport.pet.pet_name} ({petReport.pet.pet_id})
                      </h2>
                      <div className="text-xs text-slate-600 mt-1">
                        {petReport.pet.species} · {petReport.pet.breed} · {petReport.pet.gender} ·
                        DOB {petReport.pet.date_of_birth}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 sm:text-right">
                      <div className="font-semibold text-slate-900">{petReport.pet.owner_name}</div>
                      <div className="font-mono">{petReport.pet.owner_phone}</div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                          <th className="py-2.5 px-3">Vaccine</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Next Due</th>
                          <th className="py-2.5 px-3">Veterinarian</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {petReport.vaccinations.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-500">
                              No vaccinations recorded yet.
                            </td>
                          </tr>
                        ) : (
                          petReport.vaccinations.map((v) => (
                            <tr key={v.vaccination_id}>
                              <td className="py-2 px-3 font-medium text-slate-900">
                                {v.vaccine_name}
                              </td>
                              <td className="py-2 px-3 font-mono tabular-nums">
                                {v.vaccination_date}
                              </td>
                              <td className="py-2 px-3 font-mono tabular-nums">
                                {v.next_due_date}
                              </td>
                              <td className="py-2 px-3">{v.veterinarian_name}</td>
                              <td className="py-2 px-3">
                                <StatusIndicator status={v.status} />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. MY PROFILE */}
          {section === 'my-profile' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Manage your personal contact information and account password.
                </p>
              </div>

              <form
                onSubmit={handleSaveProfile}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  Personal Details
                </h2>
                {profileErr && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    {profileErr}
                  </div>
                )}
                {profileMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                    {profileMsg}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Registered Mobile Number (Verified)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={user.phone_number}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-100 text-slate-600 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-4 py-2 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60"
                  >
                    {savingProfile ? 'Saving...' : 'Update Profile'}
                  </button>
                </div>
              </form>

              <form
                onSubmit={handleChangePassword}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                  <Shield className="w-4 h-4 text-teal-600" />
                  Change Password
                </div>
                {passErr && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    {passErr}
                  </div>
                )}
                {passMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                    {passMsg}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Current Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={curPass}
                    onChange={(e) => setCurPass(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      New Password (min 8) *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Confirm Password *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confPass}
                      onChange={(e) => setConfPass(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingPass}
                    className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60"
                  >
                    {savingPass ? 'Updating...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
