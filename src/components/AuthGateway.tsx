import { ArrowRight, PawPrint, ShieldCheck, Stethoscope, UserCheck } from 'lucide-react';

interface AuthGatewayProps {
  onSelectDoctor: () => void;
  onSelectCustomer: () => void;
}

export function AuthGateway({ onSelectDoctor, onSelectCustomer }: AuthGatewayProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/70 via-white to-slate-50 flex flex-col">
      {/* Clean Top Bar */}
      <header className="h-16 bg-white/90 backdrop-blur border-b border-slate-200 px-6 lg:px-12 flex items-center justify-between gap-8">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <span className="w-8 h-8 rounded-lg bg-sky-700 text-white flex items-center justify-center">
            <Stethoscope className="w-4 h-4" />
          </span>
          <span className="font-display font-bold text-base text-slate-900">
            Pawsitive Care Veterinary Clinic
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-sm text-slate-600">
          <button
            onClick={onSelectDoctor}
            className="hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            Doctor Portal
          </button>
          <button
            onClick={onSelectCustomer}
            className="hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            Pet Owner Portal
          </button>
        </div>
        <button
          onClick={onSelectCustomer}
          className="px-4 py-2 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap shrink-0"
        >
          Pet Owner Sign Up
        </button>
      </header>

      {/* Main Split Intro & Portal Selection */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 lg:py-16 flex flex-col justify-center gap-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center space-y-4">
            <div className="text-xs font-medium text-teal-700">
              Pawsitive Care Veterinary Clinic · Immunization &amp; Patient Portal
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance">
              Veterinary Vaccination Log &amp; Preventive Care Platform
            </h1>
            <p className="text-base text-slate-600 max-w-xl leading-relaxed">
              Role-separated access for clinic veterinarians and registered pet owners.
              Select your portal below to manage clinical immunization records or check
              your pet&apos;s upcoming vaccination schedule.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
              <span>Role-Based SQLite Security</span>
              <span aria-hidden="true">·</span>
              <span>Mobile OTP Owner Verification</span>
              <span aria-hidden="true">·</span>
              <span>Real-Time Due Status Tracking</span>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden min-h-[220px]">
            <img
              src="/src/assets/images/clinic_care_banner_1795605468863.jpg"
              alt="Pawsitive Care Veterinary Clinic examination suite"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Two Separate Login Portal Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Doctor Login */}
          <div className="bg-white border border-slate-200 rounded-xl p-7 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Doctor Login</h2>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  For authorized clinic veterinarians and medical administrators. Access all
                  registered pets, log vaccinations, manage overdue alerts, and view clinic-wide trend analytics.
                </p>
              </div>
              <div className="text-xs text-slate-500 pt-1">
                Protected clinical staff portal · Admin-provisioned accounts only
              </div>
            </div>

            <button
              onClick={onSelectDoctor}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <span>Enter Doctor Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 2: Pet Owner Login / Sign Up */}
          <div className="bg-white border border-slate-200 rounded-xl p-7 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                <PawPrint className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Pet Owner Login / Sign Up
                </h2>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  For pet parents and clinic clients. Register your pets, view verified
                  vaccination history, track upcoming due dates, and download PDF reports.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-teal-700 pt-1">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Private owner workspace · Mobile number + OTP verification</span>
              </div>
            </div>

            <button
              onClick={onSelectCustomer}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
            >
              <span>Pet Owner Login / Sign Up</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
