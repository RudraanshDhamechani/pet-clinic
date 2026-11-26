import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  PawPrint,
  Smartphone,
} from 'lucide-react';
import { clinicApi } from '../api/clinicApi.ts';
import type { AuthUser } from '../types/clinic.ts';

interface CustomerAuthPortalProps {
  onBack: () => void;
  onAuthenticated: (token: string, user: AuthUser) => void;
}

type PortalTab = 'login' | 'signup' | 'forgot';

export function CustomerAuthPortal({ onBack, onAuthenticated }: CustomerAuthPortalProps) {
  const [tab, setTab] = useState<PortalTab>('login');
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Login fields
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup fields
  const [fullName, setFullName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupStep, setSignupStep] = useState<'details' | 'otp'>('details');
  const [signupOtp, setSignupOtp] = useState('');

  // Reset password fields
  const [resetPhone, setResetPhone] = useState('');
  const [resetStep, setResetStep] = useState<'phone' | 'otp'>('phone');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetConfirmPass, setResetConfirmPass] = useState('');

  // OTP state (expiry countdown, resend cooldown, demo mode banner)
  const [otpMode, setOtpMode] = useState<'sms' | 'demo' | null>(null);
  const [demoOtpValue, setDemoOtpValue] = useState<string | null>(null);
  const [expirySeconds, setExpirySeconds] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (expirySeconds <= 0 && resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setExpirySeconds((s) => (s > 0 ? s - 1 : 0));
      setResendCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [expirySeconds > 0, resendCooldown > 0]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const switchTab = (next: PortalTab) => {
    setTab(next);
    setError(null);
    setInfoMsg(null);
    setDemoOtpValue(null);
    setOtpMode(null);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await clinicApi.customerLogin({
        phone_number: loginPhone.trim(),
        password: loginPassword,
      });
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendSignupOtp = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfoMsg(null);

    if (fullName.trim().length < 2) {
      setError('Full name is required.');
      return;
    }
    if (signupPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (signupPassword !== signupConfirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await clinicApi.sendCustomerOtp({
        phone_number: signupPhone.trim(),
        purpose: 'signup',
      });
      setOtpMode(res.mode);
      setDemoOtpValue(res.demoOtp ?? null);
      setExpirySeconds(res.expiresInSeconds);
      setResendCooldown(30);
      setSignupStep('otp');
      setInfoMsg(
        res.mode === 'sms'
          ? `A 6-digit SMS verification code was sent to ${res.phone_number}.`
          : `Development/Demo OTP generated for ${res.phone_number}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifySignup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await clinicApi.verifyCustomerSignup({
        full_name: fullName.trim(),
        phone_number: signupPhone.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
        confirm_password: signupConfirm,
        otp: signupOtp.trim(),
      });
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendResetOtp = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfoMsg(null);
    setSubmitting(true);
    try {
      const res = await clinicApi.sendCustomerOtp({
        phone_number: resetPhone.trim(),
        purpose: 'reset',
      });
      setOtpMode(res.mode);
      setDemoOtpValue(res.demoOtp ?? null);
      setExpirySeconds(res.expiresInSeconds);
      setResendCooldown(30);
      setResetStep('otp');
      setInfoMsg(
        res.mode === 'sms'
          ? `Password reset SMS code sent to ${res.phone_number}.`
          : `Development/Demo reset OTP generated for ${res.phone_number}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteReset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (resetNewPass.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (resetNewPass !== resetConfirmPass) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await clinicApi.resetCustomerPassword({
        phone_number: resetPhone.trim(),
        otp: resetOtp.trim(),
        new_password: resetNewPass,
        confirm_password: resetConfirmPass,
      });
      setTab('login');
      setLoginPhone(resetPhone.trim());
      setResetStep('phone');
      setResetOtp('');
      setResetNewPass('');
      setResetConfirmPass('');
      setDemoOtpValue(null);
      setInfoMsg(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/50 to-slate-50 flex flex-col items-center justify-center p-4">
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
            <span className="w-10 h-10 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
              <PawPrint className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Pet Owner Portal</h1>
              <p className="text-xs text-slate-500">
                Pawsitive Care Veterinary Clinic · Mobile Account Access
              </p>
            </div>
          </div>

          {/* Segmented Portal Mode Switch */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                switchTab('signup');
                setSignupStep('details');
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === 'signup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign Up (OTP)
            </button>
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

          {infoMsg && (
            <div className="flex items-start gap-2 p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-900">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-600 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* Clearly Labelled Demo OTP Mode Banner (Only when SMS gateway is unconfigured) */}
          {otpMode === 'demo' && demoOtpValue && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
              <div className="font-semibold">
                Development / Demo OTP Mode (SMS Gateway Not Configured)
              </div>
              <div>
                Generated 6-digit verification code:{' '}
                <strong className="font-mono text-sm tracking-wider">{demoOtpValue}</strong>
              </div>
              <p className="text-[11px] text-amber-800">
                To send real SMS messages in production, set{' '}
                <code className="font-mono">TWILIO_ACCOUNT_SID</code>,{' '}
                <code className="font-mono">TWILIO_AUTH_TOKEN</code>, and{' '}
                <code className="font-mono">TWILIO_FROM_NUMBER</code> in Secrets.
              </p>
            </div>
          )}

          {/* TAB 1: CUSTOMER LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Registered Mobile Number *
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="(555) 234-5678"
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      switchTab('forgot');
                      setResetStep('phone');
                    }}
                    className="text-xs text-teal-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Logging In...' : 'Login to Pet Owner Dashboard'}
              </button>
            </form>
          )}

          {/* TAB 2: CUSTOMER SIGN UP WITH OTP */}
          {tab === 'signup' && signupStep === 'details' && (
            <form onSubmit={handleSendSignupOtp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g., Clara Henderson"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mobile Number (10–15 digits) *
                </label>
                <input
                  type="tel"
                  required
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                  placeholder="(555) 234-5678"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="clara@example.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Password (min 8) *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
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
                    value={signupConfirm}
                    onChange={(e) => setSignupConfirm(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Sending OTP...' : 'Send 6-Digit Verification OTP'}
              </button>
            </form>
          )}

          {tab === 'signup' && signupStep === 'otp' && (
            <form onSubmit={handleVerifySignup} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Enter 6-Digit OTP *
                  </label>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {expirySeconds > 0
                      ? `Expires in ${formatTimer(expirySeconds)}`
                      : 'OTP expired'}
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={signupOtp}
                  onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code"
                  className="w-full px-3 py-2.5 text-center text-lg font-mono tracking-widest border border-slate-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || expirySeconds === 0}
                className="w-full py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Verifying...' : 'Verify OTP & Activate Account'}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSignupStep('details');
                    setDemoOtpValue(null);
                  }}
                  className="text-slate-600 hover:text-slate-900"
                >
                  Edit mobile number
                </button>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || submitting}
                  onClick={() => handleSendSignupOtp()}
                  className="text-teal-700 font-medium hover:underline disabled:text-slate-400 disabled:no-underline"
                >
                  {resendCooldown > 0
                    ? `Resend OTP in ${resendCooldown}s`
                    : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: FORGOT PASSWORD VIA OTP */}
          {tab === 'forgot' && resetStep === 'phone' && (
            <form onSubmit={handleSendResetOtp} className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <KeyRound className="w-4 h-4 text-teal-600" />
                Reset Pet Owner Password
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Registered Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  value={resetPhone}
                  onChange={(e) => setResetPhone(e.target.value)}
                  placeholder="(555) 234-5678"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60"
              >
                {submitting ? 'Sending OTP...' : 'Send Password Reset OTP'}
              </button>
              <button
                type="button"
                onClick={() => switchTab('login')}
                className="w-full text-xs text-slate-600 hover:text-slate-900"
              >
                Back to Login
              </button>
            </form>
          )}

          {tab === 'forgot' && resetStep === 'otp' && (
            <form onSubmit={handleCompleteReset} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">6-Digit OTP *</label>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {expirySeconds > 0 ? `Expires in ${formatTimer(expirySeconds)}` : 'Expired'}
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 text-center font-mono tracking-widest border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  New Password (min 8 chars) *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={resetNewPass}
                  onChange={(e) => setResetNewPass(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={resetConfirmPass}
                  onChange={(e) => setResetConfirmPass(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || expirySeconds === 0}
                className="w-full py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60"
              >
                {submitting ? 'Resetting...' : 'Reset Password'}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="text-slate-600 hover:text-slate-900"
                >
                  Back to Login
                </button>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || submitting}
                  onClick={() => handleSendResetOtp()}
                  className="text-teal-700 hover:underline disabled:text-slate-400"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
