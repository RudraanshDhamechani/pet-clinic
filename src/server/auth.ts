import crypto from 'crypto';
import type Database from 'better-sqlite3';
import type { AuthUser, UserRole } from '../types/clinic.ts';

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

export function getSessionSecret(): string {
  return process.env.SESSION_SECRET || EPHEMERAL_FALLBACK_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function hashToken(rawToken: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(rawToken)
    .digest('hex');
}

export function hashOtp(phoneDigits: string, otpCode: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(`${phoneDigits}:${otpCode}`)
    .digest('hex');
}

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function formatPhoneDisplay(digits: string): string {
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

export function createSession(db: Database.Database, userId: number, role: UserRole): string {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, role, expires_at)
     VALUES (?, ?, ?, ?)`
  ).run(tokenHash, userId, role, expiresAt);

  return rawToken;
}

export function authenticateBearer(
  db: Database.Database,
  authHeader: string | undefined
): AuthUser | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) return null;
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const row = db
    .prepare(
      `SELECT u.user_id, u.full_name, u.phone_number, u.email, u.role, u.is_verified, u.created_at, s.expires_at
       FROM sessions s
       INNER JOIN users u ON u.user_id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash) as (AuthUser & { expires_at: string }) | undefined;

  if (!row) return null;
  if (row.expires_at <= new Date().toISOString()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }

  return {
    user_id: row.user_id,
    full_name: row.full_name,
    phone_number: row.phone_number,
    email: row.email,
    role: row.role,
    is_verified: row.is_verified,
    created_at: row.created_at,
  };
}

export function revokeBearer(db: Database.Database, authHeader: string | undefined): void {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return;
  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) return;
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

export async function dispatchSmsOtp(
  phoneDigits: string,
  otpCode: string,
  purpose: 'signup' | 'reset'
): Promise<{ mode: 'sms' | 'demo'; demoOtp?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();

  if (sid && token && fromNumber) {
    const toE164 = phoneDigits.length === 10 ? `+1${phoneDigits}` : `+${phoneDigits}`;
    const body = new URLSearchParams({
      To: toE164,
      From: fromNumber,
      Body: `Pawsitive Care Veterinary Clinic: Your ${
        purpose === 'signup' ? 'registration' : 'password reset'
      } verification code is ${otpCode}. It expires in 5 minutes.`,
    });

    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`SMS gateway error (${resp.status}): ${errText.slice(0, 140)}`);
    }

    return { mode: 'sms' };
  }

  console.info(
    `[Pawsitive Care Demo OTP] (${purpose}) Phone ${phoneDigits} -> Code ${otpCode} (valid 5 min)`
  );
  return { mode: 'demo', demoOtp: otpCode };
}
