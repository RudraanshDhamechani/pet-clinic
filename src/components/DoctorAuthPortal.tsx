import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, HelpCircle, Lock, ShieldCheck } from 'lucide-react';
import { clinicApi } from '../api/clinicApi.ts';
import type { AuthUser } from '../types/clinic.ts';

interface DoctorAuthPortalProps {
  onBack: () => void;
  onAuthenticated: (token: string, user: AuthUser) => void;
}

export function DoctorAuthPortal({ onBack, onAuthenticated }: DoctorAuthPortalProps) {
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [envOverrideActive, setEnvOverrideActive] = useState(false);
  const [adminEmailHint, setAdminEmailHint] = useState<string | null>(null);
  const [showForgotHelp, setShowForgotHelp] = useState(false);

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // First-run setup form state (when no doctor exists and DOCTOR_ADMIN_PASSWORD is unset)
  const [setupName, setSetupName] = useState('Dr. Claire Vance');
  const [setupEmail, setSetupEmail] = useState('doctor@pawsitivecare.clinic');
  const [setupPhone, setSetupPhone] = useState('(555) 010-0001');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clinicApi
      .getDoctorStatus()
      .then((res) => {
        setNeedsSetup(res.needsSetup);
        setEnvOverrideActive(res.envOverrideActive);
        setAdminEmailHint(res.adminEmailHint);
        if (res.adminEmailHint) {
          setIdentifier(res.adminEmailHint);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingStatus(false));
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await clinicApi.doctorLogin({
        identifier: identifier.trim(),
        password,
      });
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInitialSetup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (setupPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (setupPassword !== setupConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await clinicApi.setupInitialDoctor({
        full_name: setupName.trim(),
        email: setupEmail.trim(),
        phone_number: setupPhone.trim(),
        password: setupPassword,
        confirm_password: setupConfirm,
      });
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize doctor account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Portal Selection
        </button>

        <div className="bg-white border border-slate-200 rounded-xl p-7 space-y-5">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                {needsSetup ? 'Initial Doctor Account Setup' : 'Doctor Clinic Login'}
              </h1>
              <p className="text-xs text-slate-500">
                Pawsitive Care Veterinary Clinic · Authorized Medical Staff
              </p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {checkingStatus ? (
            <div className="space-y-3 py-4">
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          ) : needsSetup ? (
            <form onSubmit={handleInitialSetup} className="space-y-4">
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-900 leading-relaxed">
                No clinic doctor account exists yet. Create the first administrator-doctor
                account below. Public doctor self-registration locks immediately after setup.
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Doctor Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Clinic Email *
                </label>
                <input
                  type="email"
                  required
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Clinic Phone *
                </label>
                <input
                  type="tel"
                  required
                  value={setupPhone}
                  onChange={(e) => setSetupPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Password (min 8 chars) *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30"
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
                  value={setupConfirm}
                  onChange={(e) => setSetupConfirm(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Creating Doctor Account...' : 'Create Clinic Doctor Account'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {envOverrideActive && adminEmailHint && (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-900">
                  Environment admin login active for <strong className="font-mono">{adminEmailHint}</strong>.
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Doctor Email or Username
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="doctor@pawsitivecare.clinic"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotHelp((v) => !v)}
                    className="text-xs text-sky-700 hover:underline inline-flex items-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3" />
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>

              {showForgotHelp && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1 leading-relaxed">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-600" />
                    Clinic Administrator Password Recovery
                  </div>
                  <p>
                    Doctor accounts cannot be reset via public self-service. To recover or
                    override clinic doctor access, set{' '}
                    <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">
                      DOCTOR_ADMIN_PASSWORD
                    </code>{' '}
                    in Settings &rarr; Secrets and restart the server.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Signing In...' : 'Login to Doctor Dashboard'}
              </button>

              <p className="text-[11px] text-slate-500 text-center pt-1">
                Public doctor registration is disabled. Accounts are provisioned by clinic administration.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
