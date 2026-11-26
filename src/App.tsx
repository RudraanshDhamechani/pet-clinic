import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PawPrint,
  Plus,
  Stethoscope,
  Syringe,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { clinicApi, setAuthToken } from './api/clinicApi.ts';
import type { AuthUser, DoctorNavSection } from './types/clinic.ts';
import { AuthGateway } from './components/AuthGateway.tsx';
import { DoctorAuthPortal } from './components/DoctorAuthPortal.tsx';
import { CustomerAuthPortal } from './components/CustomerAuthPortal.tsx';
import { CustomerPortal } from './components/CustomerPortal.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { AllCustomersView } from './components/AllCustomersView.tsx';
import { PetRecordsView } from './components/PetRecordsView.tsx';
import { RegisterPetView } from './components/RegisterPetView.tsx';
import { AddVaccinationView } from './components/AddVaccinationView.tsx';
import { VaccinationHistoryView } from './components/VaccinationHistoryView.tsx';
import { VaccinationTrackerView } from './components/VaccinationTrackerView.tsx';
import { TrendAnalysisView } from './components/TrendAnalysisView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { ImportCsvView } from './components/ImportCsvView.tsx';

type PortalRoute = 'gateway' | 'doctor-auth' | 'customer-auth';

interface DoctorNavItem {
  id: DoctorNavSection;
  label: string;
  Icon: typeof LayoutDashboard;
}

const DOCTOR_NAV_ITEMS: DoctorNavItem[] = [
  { id: 'overview', label: 'Overview Dashboard', Icon: LayoutDashboard },
  { id: 'all-pets', label: 'All Registered Pets', Icon: PawPrint },
  { id: 'all-customers', label: 'All Customers', Icon: Users },
  { id: 'register-pet', label: 'Register New Pet', Icon: UserPlus },
  { id: 'add-vaccination', label: 'Add Vaccination Record', Icon: Syringe },
  { id: 'vaccination-history', label: 'Vaccination History', Icon: History },
  { id: 'upcoming-vaccinations', label: 'Upcoming Vaccinations', Icon: CalendarClock },
  { id: 'overdue-vaccinations', label: 'Overdue Vaccinations', Icon: AlertTriangle },
  { id: 'trend-analysis', label: 'Trend Analysis', Icon: BarChart3 },
  { id: 'reports', label: 'Reports', Icon: FileSpreadsheet },
  { id: 'import-csv', label: 'Import CSV', Icon: Upload },
];

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [portalRoute, setPortalRoute] = useState<PortalRoute>('gateway');

  // Doctor Dashboard state
  const [activeSection, setActiveSection] = useState<DoctorNavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [preselectedPetId, setPreselectedPetId] = useState<string | null>(null);
  const [preselectedVaccine, setPreselectedVaccine] = useState<string | null>(null);
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<number | null>(null);
  const [historyPetId, setHistoryPetId] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  const handleAuthenticated = (token: string, user: AuthUser) => {
    setAuthToken(token);
    setAuthUser(user);
    setActiveSection('overview');
  };

  const handleLogout = async () => {
    try {
      await clinicApi.logout();
    } catch {
      // ignore network error on logout
    }
    setAuthToken(null);
    setAuthUser(null);
    setPortalRoute('gateway');
  };

  // Unauthenticated Portal Selection / Login Flows
  if (!authUser) {
    if (portalRoute === 'doctor-auth') {
      return (
        <DoctorAuthPortal
          onBack={() => setPortalRoute('gateway')}
          onAuthenticated={handleAuthenticated}
        />
      );
    }
    if (portalRoute === 'customer-auth') {
      return (
        <CustomerAuthPortal
          onBack={() => setPortalRoute('gateway')}
          onAuthenticated={handleAuthenticated}
        />
      );
    }
    return (
      <AuthGateway
        onSelectDoctor={() => setPortalRoute('doctor-auth')}
        onSelectCustomer={() => setPortalRoute('customer-auth')}
      />
    );
  }

  // Strictly separated Customer Portal
  if (authUser.role === 'customer') {
    return (
      <CustomerPortal
        user={authUser}
        onUserUpdated={setAuthUser}
        onLogout={handleLogout}
      />
    );
  }

  // Doctor Portal (role === 'doctor')
  const navigateTo = (section: DoctorNavSection) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
  };

  const handleQuickLogBooster = (petId: string, vaccineName?: string) => {
    setPreselectedPetId(petId);
    setPreselectedVaccine(vaccineName ?? null);
    navigateTo('add-vaccination');
  };

  const handleViewPetHistory = (petId: string) => {
    setHistoryPetId(petId);
    navigateTo('vaccination-history');
  };

  const handleRegisterPetForCustomer = (customerId: number) => {
    setPreselectedCustomerId(customerId);
    navigateTo('register-pet');
  };

  const activeNavMeta =
    DOCTOR_NAV_ITEMS.find((item) => item.id === activeSection) ?? DOCTOR_NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Navy / Clinical Blue Doctor Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-150 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
          <button
            onClick={() => navigateTo('overview')}
            className="flex items-center gap-2.5 text-left"
          >
            <span className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
              <Stethoscope className="w-4 h-4" />
            </span>
            <span className="font-display font-bold text-sm leading-tight text-white">
              Pawsitive Care
              <span className="block text-[11px] font-normal text-sky-300">
                Doctor Clinic Portal
              </span>
            </span>
          </button>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Doctor Navigation">
          {DOCTOR_NAV_ITEMS.map(({ id, label, Icon }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => {
                  if (id === 'vaccination-history') setHistoryPetId(null);
                  if (id === 'add-vaccination') {
                    setPreselectedPetId(null);
                    setPreselectedVaccine(null);
                  }
                  if (id === 'register-pet') {
                    setPreselectedCustomerId(null);
                  }
                  navigateTo(id);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-400'
                  }`}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            {!avatarError ? (
              <img
                src="/src/assets/images/vet_clinician_avatar_1795605468354.jpg"
                alt={authUser.full_name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-sky-700 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                DR
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {authUser.full_name}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {authUser.email || 'Clinic Veterinarian'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:text-slate-900 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="font-semibold text-slate-900 hidden sm:inline whitespace-nowrap">
                Pawsitive Care Veterinary Clinic
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="text-slate-600 font-medium truncate">
                {activeNavMeta.label}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              setPreselectedPetId(null);
              setPreselectedVaccine(null);
              navigateTo('add-vaccination');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Vaccination
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {activeSection === 'overview' && (
            <DashboardView
              onNavigate={navigateTo}
              onQuickLogBooster={handleQuickLogBooster}
              refreshKey={refreshKey}
            />
          )}
          {activeSection === 'all-pets' && (
            <PetRecordsView
              onNavigate={navigateTo}
              onQuickLogVaccination={(petId) => handleQuickLogBooster(petId)}
              onViewPetHistory={handleViewPetHistory}
              onDataChanged={triggerRefresh}
              refreshKey={refreshKey}
            />
          )}
          {activeSection === 'all-customers' && (
            <AllCustomersView
              onRegisterPetForCustomer={handleRegisterPetForCustomer}
              refreshKey={refreshKey}
            />
          )}
          {activeSection === 'register-pet' && (
            <RegisterPetView
              preselectedCustomerId={preselectedCustomerId}
              onPetCreated={() => triggerRefresh()}
              onNavigate={navigateTo}
              onQuickLogVaccination={(petId) => handleQuickLogBooster(petId)}
            />
          )}
          {activeSection === 'add-vaccination' && (
            <AddVaccinationView
              preselectedPetId={preselectedPetId}
              preselectedVaccine={preselectedVaccine}
              onVaccinationAdded={triggerRefresh}
              onNavigate={navigateTo}
            />
          )}
          {activeSection === 'vaccination-history' && (
            <VaccinationHistoryView
              initialPetId={historyPetId}
              onNavigate={navigateTo}
              onDataChanged={triggerRefresh}
              refreshKey={refreshKey}
            />
          )}
          {activeSection === 'upcoming-vaccinations' && (
            <VaccinationTrackerView
              initialStatusFilter="Upcoming"
              title="Upcoming Vaccinations"
              subtitle="Patients due within the next 30 days or today across the clinic."
              onQuickLogBooster={handleQuickLogBooster}
              refreshKey={refreshKey}
            />
          )}
          {activeSection === 'overdue-vaccinations' && (
            <VaccinationTrackerView
              initialStatusFilter="Overdue"
              title="Overdue Vaccinations"
              subtitle="Patients whose next booster due date has passed and require desk outreach."
              onQuickLogBooster={handleQuickLogBooster}
              refreshKey={refreshKey}
            />
          )}
          {activeSection === 'trend-analysis' && (
            <TrendAnalysisView refreshKey={refreshKey} />
          )}
          {activeSection === 'reports' && <ReportsView refreshKey={refreshKey} />}
          {activeSection === 'import-csv' && (
            <ImportCsvView onDataChanged={triggerRefresh} onNavigate={navigateTo} />
          )}
        </main>

        <footer className="px-6 py-4 border-t border-slate-200 bg-white text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-teal-600" />
            <span>Pawsitive Care Veterinary Clinic · Doctor Clinical Portal</span>
          </div>
          <span>Authenticated SQLite Session · Role-Based Access Active</span>
        </footer>
      </div>
    </div>
  );
}
