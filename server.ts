import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  authenticateBearer,
  createSession,
  dispatchSmsOtp,
  formatPhoneDisplay,
  hashOtp,
  hashPassword,
  normalizePhone,
  revokeBearer,
  verifyPassword,
} from './src/server/auth.ts';
import { parseCsvText } from './src/server/csvParser.ts';
import { getDb } from './src/server/db.ts';
import {
  computeVaccinationStatus,
  escapeCsvCell,
  getTodayDateString,
  validatePetInput,
  validateVaccinationInput,
} from './src/server/validation.ts';
import type {
  AuthUser,
  CsvImportResult,
  CsvImportRowResult,
  CustomerSummary,
  PetRecord,
  VaccinationRecord,
  VaccinationStatus,
} from './src/types/clinic.ts';

interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

interface RawJoinedVaccination {
  vaccination_id: number;
  pet_id: string;
  pet_name: string;
  species: PetRecord['species'];
  breed: string;
  owner_name: string;
  owner_phone: string;
  vaccine_name: string;
  vaccination_date: string;
  next_due_date: string;
  veterinarian_name: string;
  notes: string;
  created_by: number | null;
  is_sample: number;
  created_at: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const idx = Number(m) - 1;
  return `${MONTH_NAMES[idx] ?? m} '${y.slice(2)}`;
}

function enrichVaccination(row: RawJoinedVaccination, today: string): VaccinationRecord {
  const computed = computeVaccinationStatus(row.next_due_date, today);
  return {
    ...row,
    status: computed.status,
    days_until_due: computed.daysUntilDue,
    due_within_7_days: computed.dueWithin7Days,
  };
}

function generateNextPetId(db: ReturnType<typeof getDb>): string {
  const rows = db.prepare('SELECT pet_id FROM pets').all() as { pet_id: string }[];
  let maxNum = 1024;
  for (const r of rows) {
    const m = r.pet_id.match(/(\d+)$/);
    if (m) {
      const n = Number(m[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  return `PET-${maxNum + 1}`;
}

async function startServer() {
  const app = express();
  const db = getDb();
  const PORT = 3000;

  app.use(express.json({ limit: '3mb' }));

  // Auth middlewares
  const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = authenticateBearer(db, req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }
    req.authUser = user;
    next();
  };

  const requireDoctor = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    requireAuth(req, res, () => {
      if (req.authUser?.role !== 'doctor') {
        return res.status(403).json({
          error: 'Forbidden: Doctor clinic privileges are required for this resource.',
        });
      }
      next();
    });
  };

  const requireCustomer = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    requireAuth(req, res, () => {
      if (req.authUser?.role !== 'customer') {
        return res.status(403).json({
          error: 'Forbidden: This endpoint is restricted to Pet Owner accounts.',
        });
      }
      next();
    });
  };

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, clinic: 'Pawsitive Care Veterinary Clinic' });
  });

  // =========================================================================
  // AUTHENTICATION ENDPOINTS
  // =========================================================================

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.authUser });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    revokeBearer(db, req.headers.authorization);
    res.json({ ok: true });
  });

  // Check if initial doctor account setup is needed
  app.get('/api/auth/doctor-status', (_req, res) => {
    const envPassConfigured = Boolean(process.env.DOCTOR_ADMIN_PASSWORD?.trim());
    const docCount = (
      db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'doctor'").get() as {
        count: number;
      }
    ).count;

    res.json({
      needsSetup: !envPassConfigured && docCount === 0,
      envOverrideActive: envPassConfigured,
      adminEmailHint: envPassConfigured
        ? process.env.DOCTOR_ADMIN_EMAIL?.trim() || 'doctor@pawsitivecare.clinic'
        : null,
    });
  });

  // One-time atomic bootstrap route for creating the first Doctor account when env passcode is unset
  app.post('/api/auth/doctor-setup', (req, res) => {
    try {
      const envPassConfigured = Boolean(process.env.DOCTOR_ADMIN_PASSWORD?.trim());
      if (envPassConfigured) {
        return res.status(403).json({
          error: 'Doctor admin credentials are managed via environment configuration.',
        });
      }

      const existingDoc = db
        .prepare("SELECT user_id FROM users WHERE role = 'doctor' LIMIT 1")
        .get();
      if (existingDoc) {
        return res.status(403).json({
          error: 'Initial doctor account has already been claimed. Please sign in.',
        });
      }

      const full_name = String(req.body.full_name ?? '').trim();
      const email = String(req.body.email ?? '').trim().toLowerCase();
      const phoneDigits = normalizePhone(String(req.body.phone_number ?? '5550100001'));
      const password = String(req.body.password ?? '');
      const confirm_password = String(req.body.confirm_password ?? '');

      if (full_name.length < 2) {
        return res.status(400).json({ error: 'Doctor full name is required.' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid clinic email address.' });
      }
      if (phoneDigits.length < 10 || phoneDigits.length > 15) {
        return res.status(400).json({ error: 'Please enter a valid 10–15 digit phone number.' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }
      if (password !== confirm_password) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }

      const conflict = db
        .prepare('SELECT user_id FROM users WHERE email = ? OR phone_number = ?')
        .get(email, phoneDigits);
      if (conflict) {
        return res.status(409).json({
          error: 'That email or phone number is already registered.',
        });
      }

      const passwordHash = hashPassword(password);
      const info = db
        .prepare(
          `INSERT INTO users (full_name, phone_number, email, password_hash, role, is_verified)
           VALUES (?, ?, ?, ?, 'doctor', 1)`
        )
        .run(full_name, phoneDigits, email, passwordHash);

      const userId = Number(info.lastInsertRowid);
      const user = db
        .prepare(
          'SELECT user_id, full_name, phone_number, email, role, is_verified, created_at FROM users WHERE user_id = ?'
        )
        .get(userId) as AuthUser;

      const token = createSession(db, userId, 'doctor');
      res.status(201).json({ token, user });
    } catch (err) {
      console.error('Doctor setup error:', err);
      res.status(500).json({ error: 'Failed to create initial doctor account.' });
    }
  });

  // Doctor Login
  app.post('/api/auth/doctor-login', (req, res) => {
    try {
      const identifier = String(req.body.identifier ?? '').trim();
      const password = String(req.body.password ?? '');

      if (!identifier || !password) {
        return res.status(400).json({ error: 'Email/username and password are required.' });
      }

      const envPass = process.env.DOCTOR_ADMIN_PASSWORD?.trim();
      const envEmail = (
        process.env.DOCTOR_ADMIN_EMAIL?.trim() || 'doctor@pawsitivecare.clinic'
      ).toLowerCase();

      if (envPass) {
        const matchesIdentifier =
          identifier.toLowerCase() === envEmail || identifier.toLowerCase() === 'admin';
        const envMatch =
          matchesIdentifier &&
          password.length === envPass.length &&
          crypto.timingSafeEqual(Buffer.from(password), Buffer.from(envPass));

        if (!envMatch) {
          return res.status(401).json({ error: 'Invalid doctor credentials.' });
        }

        let adminUser = db
          .prepare("SELECT * FROM users WHERE role = 'doctor' AND LOWER(email) = ?")
          .get(envEmail) as (AuthUser & { password_hash: string }) | undefined;

        if (!adminUser) {
          const info = db
            .prepare(
              `INSERT INTO users (full_name, phone_number, email, password_hash, role, is_verified)
               VALUES (?, ?, ?, ?, 'doctor', 1)`
            )
            .run('Dr. Claire Vance', '5550100000', envEmail, hashPassword(envPass));
          adminUser = db
            .prepare('SELECT * FROM users WHERE user_id = ?')
            .get(Number(info.lastInsertRowid)) as AuthUser & { password_hash: string };
        }

        const token = createSession(db, adminUser.user_id, 'doctor');
        return res.json({
          token,
          user: {
            user_id: adminUser.user_id,
            full_name: adminUser.full_name,
            phone_number: adminUser.phone_number,
            email: adminUser.email,
            role: adminUser.role,
            is_verified: adminUser.is_verified,
            created_at: adminUser.created_at,
          },
        });
      }

      const phoneDigits = normalizePhone(identifier);
      const docRow = db
        .prepare(
          `SELECT * FROM users
           WHERE role = 'doctor'
             AND (LOWER(email) = LOWER(?) OR LOWER(full_name) = LOWER(?) OR (? != '' AND phone_number = ?))
           LIMIT 1`
        )
        .get(identifier, identifier, phoneDigits, phoneDigits) as
        | (AuthUser & { password_hash: string })
        | undefined;

      if (!docRow || !verifyPassword(password, docRow.password_hash)) {
        return res.status(401).json({ error: 'Invalid doctor email/username or password.' });
      }

      const token = createSession(db, docRow.user_id, 'doctor');
      res.json({
        token,
        user: {
          user_id: docRow.user_id,
          full_name: docRow.full_name,
          phone_number: docRow.phone_number,
          email: docRow.email,
          role: docRow.role,
          is_verified: docRow.is_verified,
          created_at: docRow.created_at,
        },
      });
    } catch (err) {
      console.error('Doctor login error:', err);
      res.status(500).json({ error: 'Failed to sign in.' });
    }
  });

  // Customer Send OTP (Signup or Password Reset) with Rate Limiting
  app.post('/api/auth/customer/send-otp', async (req, res) => {
    try {
      const phoneDigits = normalizePhone(String(req.body.phone_number ?? ''));
      const purpose = req.body.purpose === 'reset' ? 'reset' : 'signup';

      if (phoneDigits.length < 10 || phoneDigits.length > 15) {
        return res.status(400).json({
          error: 'Please enter a valid 10 to 15 digit mobile number.',
        });
      }

      const existingUser = db
        .prepare('SELECT user_id, role FROM users WHERE phone_number = ?')
        .get(phoneDigits) as { user_id: number; role: string } | undefined;

      if (purpose === 'signup' && existingUser) {
        return res.status(409).json({
          error: 'An account with this mobile number already exists. Please log in instead.',
        });
      }
      if (purpose === 'reset' && (!existingUser || existingUser.role !== 'customer')) {
        return res.status(404).json({
          error: 'No registered Pet Owner account was found for this mobile number.',
        });
      }

      // Rate limit: 1 OTP per 30 seconds, max 5 per 15 minutes per phone
      const recent = db
        .prepare(
          `SELECT created_at FROM otp_verifications
           WHERE phone_number = ? AND created_at > datetime('now', '-30 seconds')
           ORDER BY otp_id DESC LIMIT 1`
        )
        .get(phoneDigits);
      if (recent) {
        return res.status(429).json({
          error: 'Please wait 30 seconds before requesting another OTP.',
        });
      }

      const windowCount = (
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM otp_verifications
             WHERE phone_number = ? AND created_at > datetime('now', '-15 minutes')`
          )
          .get(phoneDigits) as { count: number }
      ).count;
      if (windowCount >= 5) {
        return res.status(429).json({
          error: 'Too many OTP requests for this number. Please try again in 15 minutes.',
        });
      }

      const otpCode = String(crypto.randomInt(100000, 1000000));
      const otpHash = hashOtp(phoneDigits, otpCode);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      db.prepare(
        `INSERT INTO otp_verifications (phone_number, purpose, otp_hash, expires_at)
         VALUES (?, ?, ?, ?)`
      ).run(phoneDigits, purpose, otpHash, expiresAt);

      const dispatchResult = await dispatchSmsOtp(phoneDigits, otpCode, purpose);

      res.json({
        ok: true,
        phone_number: formatPhoneDisplay(phoneDigits),
        expiresInSeconds: 300,
        mode: dispatchResult.mode,
        ...(dispatchResult.demoOtp ? { demoOtp: dispatchResult.demoOtp } : {}),
      });
    } catch (err) {
      console.error('Send OTP error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to send verification OTP.',
      });
    }
  });

  // Customer Verify OTP & Complete Sign Up
  app.post('/api/auth/customer/verify-signup', (req, res) => {
    try {
      const full_name = String(req.body.full_name ?? '').trim();
      const phoneDigits = normalizePhone(String(req.body.phone_number ?? ''));
      const email = String(req.body.email ?? '').trim().toLowerCase();
      const password = String(req.body.password ?? '');
      const confirm_password = String(req.body.confirm_password ?? '');
      const otp = String(req.body.otp ?? '').trim();

      if (full_name.length < 2 || full_name.length > 100) {
        return res.status(400).json({ error: 'Full name is required (at least 2 characters).' });
      }
      if (phoneDigits.length < 10 || phoneDigits.length > 15) {
        return res.status(400).json({ error: 'Valid mobile number is required.' });
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      }
      if (password !== confirm_password) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }
      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ error: 'Please enter the 6-digit verification OTP.' });
      }

      const existingPhone = db
        .prepare('SELECT user_id FROM users WHERE phone_number = ?')
        .get(phoneDigits);
      if (existingPhone) {
        return res.status(409).json({ error: 'This mobile number is already registered.' });
      }
      if (email) {
        const existingEmail = db
          .prepare('SELECT user_id FROM users WHERE LOWER(email) = ?')
          .get(email);
        if (existingEmail) {
          return res.status(409).json({ error: 'This email address is already in use.' });
        }
      }

      const otpRow = db
        .prepare(
          `SELECT * FROM otp_verifications
           WHERE phone_number = ? AND purpose = 'signup' AND consumed = 0
           ORDER BY otp_id DESC LIMIT 1`
        )
        .get(phoneDigits) as
        | {
            otp_id: number;
            otp_hash: string;
            expires_at: string;
            attempts: number;
          }
        | undefined;

      if (!otpRow) {
        return res.status(400).json({ error: 'No active OTP found. Please request a new code.' });
      }
      if (otpRow.expires_at <= new Date().toISOString()) {
        return res.status(400).json({ error: 'Your OTP has expired. Please request a new code.' });
      }
      if (otpRow.attempts >= 5) {
        return res.status(429).json({ error: 'Too many invalid attempts. Request a new OTP.' });
      }

      const providedHash = hashOtp(phoneDigits, otp);
      const validOtp = crypto.timingSafeEqual(
        Buffer.from(providedHash, 'hex'),
        Buffer.from(otpRow.otp_hash, 'hex')
      );
      if (!validOtp) {
        db.prepare('UPDATE otp_verifications SET attempts = attempts + 1 WHERE otp_id = ?').run(
          otpRow.otp_id
        );
        return res.status(400).json({ error: 'Incorrect 6-digit OTP code.' });
      }

      const passwordHash = hashPassword(password);
      const tx = db.transaction(() => {
        db.prepare('UPDATE otp_verifications SET consumed = 1 WHERE otp_id = ?').run(otpRow.otp_id);
        const info = db
          .prepare(
            `INSERT INTO users (full_name, phone_number, email, password_hash, role, is_verified)
             VALUES (?, ?, ?, ?, 'customer', 1)`
          )
          .run(full_name, phoneDigits, email || null, passwordHash);
        const newUserId = Number(info.lastInsertRowid);

        // Link any existing clinic walk-in pets whose normalized owner_phone matches this verified customer
        const unlinkedPets = db
          .prepare('SELECT pet_id, owner_phone FROM pets WHERE owner_user_id IS NULL')
          .all() as { pet_id: string; owner_phone: string }[];
        const linkStmt = db.prepare('UPDATE pets SET owner_user_id = ? WHERE pet_id = ?');
        for (const p of unlinkedPets) {
          if (normalizePhone(p.owner_phone) === phoneDigits) {
            linkStmt.run(newUserId, p.pet_id);
          }
        }
        return newUserId;
      });

      const userId = tx();
      const user = db
        .prepare(
          'SELECT user_id, full_name, phone_number, email, role, is_verified, created_at FROM users WHERE user_id = ?'
        )
        .get(userId) as AuthUser;

      const token = createSession(db, userId, 'customer');
      res.status(201).json({ token, user });
    } catch (err) {
      console.error('Customer signup verify error:', err);
      res.status(500).json({ error: 'Failed to complete registration.' });
    }
  });

  // Customer Login with Mobile Number + Password
  app.post('/api/auth/customer/login', (req, res) => {
    try {
      const phoneDigits = normalizePhone(String(req.body.phone_number ?? ''));
      const password = String(req.body.password ?? '');

      if (!phoneDigits || !password) {
        return res.status(400).json({ error: 'Mobile number and password are required.' });
      }

      const row = db
        .prepare("SELECT * FROM users WHERE phone_number = ? AND role = 'customer' LIMIT 1")
        .get(phoneDigits) as (AuthUser & { password_hash: string }) | undefined;

      if (!row || !verifyPassword(password, row.password_hash)) {
        return res.status(401).json({ error: 'Invalid mobile number or password.' });
      }
      if (!row.is_verified) {
        return res.status(403).json({ error: 'Account mobile verification is incomplete.' });
      }

      const token = createSession(db, row.user_id, 'customer');
      res.json({
        token,
        user: {
          user_id: row.user_id,
          full_name: row.full_name,
          phone_number: row.phone_number,
          email: row.email,
          role: row.role,
          is_verified: row.is_verified,
          created_at: row.created_at,
        },
      });
    } catch (err) {
      console.error('Customer login error:', err);
      res.status(500).json({ error: 'Failed to sign in.' });
    }
  });

  // Customer Password Reset via OTP
  app.post('/api/auth/customer/reset-password', (req, res) => {
    try {
      const phoneDigits = normalizePhone(String(req.body.phone_number ?? ''));
      const otp = String(req.body.otp ?? '').trim();
      const new_password = String(req.body.new_password ?? '');
      const confirm_password = String(req.body.confirm_password ?? '');

      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ error: 'Please enter the 6-digit OTP.' });
      }
      if (new_password.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
      }
      if (new_password !== confirm_password) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }

      const userRow = db
        .prepare("SELECT user_id FROM users WHERE phone_number = ? AND role = 'customer'")
        .get(phoneDigits) as { user_id: number } | undefined;
      if (!userRow) {
        return res.status(404).json({ error: 'Customer account not found.' });
      }

      const otpRow = db
        .prepare(
          `SELECT * FROM otp_verifications
           WHERE phone_number = ? AND purpose = 'reset' AND consumed = 0
           ORDER BY otp_id DESC LIMIT 1`
        )
        .get(phoneDigits) as
        | { otp_id: number; otp_hash: string; expires_at: string; attempts: number }
        | undefined;

      if (!otpRow || otpRow.expires_at <= new Date().toISOString()) {
        return res.status(400).json({ error: 'OTP missing or expired. Request a new code.' });
      }
      if (otpRow.attempts >= 5) {
        return res.status(429).json({ error: 'Too many attempts. Request a new OTP.' });
      }

      const providedHash = hashOtp(phoneDigits, otp);
      const valid = crypto.timingSafeEqual(
        Buffer.from(providedHash, 'hex'),
        Buffer.from(otpRow.otp_hash, 'hex')
      );
      if (!valid) {
        db.prepare('UPDATE otp_verifications SET attempts = attempts + 1 WHERE otp_id = ?').run(
          otpRow.otp_id
        );
        return res.status(400).json({ error: 'Incorrect 6-digit OTP code.' });
      }

      const newHash = hashPassword(new_password);
      db.transaction(() => {
        db.prepare('UPDATE otp_verifications SET consumed = 1 WHERE otp_id = ?').run(otpRow.otp_id);
        db.prepare('UPDATE users SET password_hash = ? WHERE user_id = ?').run(newHash, userRow.user_id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userRow.user_id);
      })();

      res.json({ ok: true, message: 'Password updated. You can now log in.' });
    } catch (err) {
      console.error('Customer password reset error:', err);
      res.status(500).json({ error: 'Failed to reset password.' });
    }
  });

  // =========================================================================
  // DOCTOR-ONLY CLINIC ENDPOINTS
  // =========================================================================

  app.get('/api/dashboard', requireDoctor, (_req, res) => {
    try {
      const today = getTodayDateString();
      const currentMonthPrefix = today.slice(0, 7);

      const petCountRow = db.prepare('SELECT COUNT(*) AS count FROM pets').get() as { count: number };
      const customerCountRow = db
        .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'customer'")
        .get() as { count: number };

      const allVaxRows = db
        .prepare(
          `SELECT v.vaccination_id, v.pet_id, p.pet_name, p.species, p.breed,
                  p.owner_name, p.owner_phone, v.vaccine_name, v.vaccination_date,
                  v.next_due_date, v.veterinarian_name, v.notes, v.created_by, v.is_sample, v.created_at
           FROM vaccinations v
           INNER JOIN pets p ON p.pet_id = v.pet_id
           ORDER BY v.next_due_date ASC, v.vaccination_id DESC`
        )
        .all() as RawJoinedVaccination[];

      const seenIds = new Set<number>();
      const enriched: VaccinationRecord[] = [];
      for (const row of allVaxRows) {
        if (seenIds.has(row.vaccination_id)) continue;
        seenIds.add(row.vaccination_id);
        enriched.push(enrichVaccination(row, today));
      }

      const dueToday = enriched.filter((r) => r.status === 'Due Today');
      const dueWithin7Days = enriched.filter(
        (r) => r.status === 'Upcoming' && r.due_within_7_days
      );
      const upcoming = enriched.filter((r) => r.status === 'Upcoming');
      const overdue = enriched.filter((r) => r.status === 'Overdue');
      const completedThisMonth = enriched.filter((r) =>
        r.vaccination_date.startsWith(currentMonthPrefix)
      ).length;

      const monthCounts = new Map<string, number>();
      for (const r of enriched) {
        const ym = r.vaccination_date.slice(0, 7);
        monthCounts.set(ym, (monthCounts.get(ym) ?? 0) + 1);
      }
      const monthlyOverview = Array.from(monthCounts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, count]) => ({
          month,
          label: formatMonthLabel(month),
          count,
        }));

      const recentVaccinations = [...enriched]
        .sort((a, b) => b.vaccination_date.localeCompare(a.vaccination_date))
        .slice(0, 8);

      res.json({
        today,
        kpis: {
          totalPets: petCountRow.count,
          totalCustomers: customerCountRow.count,
          totalVaccinations: enriched.length,
          upcomingVaccinations: upcoming.length,
          dueTodayVaccinations: dueToday.length,
          dueWithin7Days: dueWithin7Days.length,
          overdueVaccinations: overdue.length,
          completedThisMonth,
        },
        alerts: {
          dueToday,
          dueWithin7Days,
          overdue,
        },
        monthlyOverview,
        recentVaccinations,
      });
    } catch (err) {
      console.error('Dashboard error:', err);
      res.status(500).json({ error: 'Failed to load dashboard summary.' });
    }
  });

  app.get('/api/customers', requireDoctor, (_req, res) => {
    try {
      const customers = db
        .prepare(
          `SELECT u.user_id, u.full_name, u.phone_number, u.email, u.is_verified, u.created_at,
                  COUNT(p.pet_id) AS pet_count
           FROM users u
           LEFT JOIN pets p ON p.owner_user_id = u.user_id
           WHERE u.role = 'customer'
           GROUP BY u.user_id
           ORDER BY u.created_at DESC`
        )
        .all() as CustomerSummary[];

      res.json(customers);
    } catch (err) {
      console.error('List customers error:', err);
      res.status(500).json({ error: 'Failed to retrieve registered customers.' });
    }
  });

  app.get('/api/pets', requireDoctor, (req, res) => {
    try {
      const today = getTodayDateString();
      const search = String(req.query.search ?? '').trim().toLowerCase();
      const species = String(req.query.species ?? '').trim();

      let sql = `SELECT p.* FROM pets p WHERE 1=1`;
      const params: unknown[] = [];

      if (search) {
        sql += ` AND (LOWER(p.pet_id) LIKE ? OR LOWER(p.pet_name) LIKE ? OR LOWER(p.owner_name) LIKE ?)`;
        const like = `%${search}%`;
        params.push(like, like, like);
      }
      if (species && species !== 'All') {
        sql += ` AND p.species = ?`;
        params.push(species);
      }
      sql += ` ORDER BY p.pet_id ASC`;

      const pets = db.prepare(sql).all(...params) as PetRecord[];

      const vaxRows = db
        .prepare('SELECT pet_id, next_due_date FROM vaccinations ORDER BY next_due_date ASC')
        .all() as { pet_id: string; next_due_date: string }[];

      const byPet = new Map<
        string,
        { count: number; nextDue: string | null; status: VaccinationStatus | null }
      >();
      const priority: Record<VaccinationStatus, number> = {
        Overdue: 4,
        'Due Today': 3,
        Upcoming: 2,
        Completed: 1,
      };

      for (const v of vaxRows) {
        const computed = computeVaccinationStatus(v.next_due_date, today).status;
        const existing = byPet.get(v.pet_id);
        if (!existing) {
          byPet.set(v.pet_id, { count: 1, nextDue: v.next_due_date, status: computed });
        } else {
          existing.count += 1;
          if (!existing.status || priority[computed] > priority[existing.status]) {
            existing.status = computed;
            existing.nextDue = v.next_due_date;
          }
        }
      }

      const enrichedPets = pets.map((p) => {
        const summary = byPet.get(p.pet_id);
        return {
          ...p,
          vaccination_count: summary?.count ?? 0,
          latest_status: summary?.status ?? null,
          next_due_date: summary?.nextDue ?? null,
        };
      });

      res.json(enrichedPets);
    } catch (err) {
      console.error('List pets error:', err);
      res.status(500).json({ error: 'Failed to retrieve pets.' });
    }
  });

  app.post('/api/pets', requireDoctor, (req, res) => {
    try {
      const body = { ...(req.body as Record<string, unknown>) };
      let ownerUserId: number | null = null;

      if (body.owner_user_id !== undefined && body.owner_user_id !== null && String(body.owner_user_id) !== '') {
        const requestedOwnerId = Number(body.owner_user_id);
        const customer = db
          .prepare("SELECT user_id, full_name, phone_number, email FROM users WHERE user_id = ? AND role = 'customer'")
          .get(requestedOwnerId) as
          | { user_id: number; full_name: string; phone_number: string; email: string | null }
          | undefined;
        if (!customer) {
          return res.status(404).json({ error: 'Selected customer account not found.' });
        }
        ownerUserId = customer.user_id;
        body.owner_name = customer.full_name;
        body.owner_phone = customer.phone_number;
        body.owner_email = customer.email ?? '';
      }

      const validation = validatePetInput(body);
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }
      const data = validation.data;

      const existing = db.prepare('SELECT pet_id FROM pets WHERE pet_id = ?').get(data.pet_id);
      if (existing) {
        return res.status(409).json({
          error: `Pet ID "${data.pet_id}" is already registered. Please enter a unique Pet ID.`,
        });
      }

      db.prepare(
        `INSERT INTO pets (
          pet_id, owner_user_id, pet_name, species, breed, age, gender, date_of_birth,
          weight, photo, owner_name, owner_phone, owner_email, is_sample
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
      ).run(
        data.pet_id,
        ownerUserId,
        data.pet_name,
        data.species,
        data.breed,
        data.age,
        data.gender,
        data.date_of_birth,
        data.weight,
        data.photo,
        data.owner_name,
        data.owner_phone,
        data.owner_email
      );

      const created = db
        .prepare('SELECT * FROM pets WHERE pet_id = ?')
        .get(data.pet_id) as PetRecord;
      res.status(201).json(created);
    } catch (err) {
      console.error('Create pet error:', err);
      res.status(500).json({ error: 'Failed to register pet.' });
    }
  });

  app.put('/api/pets/:petId', requireDoctor, (req, res) => {
    try {
      const targetId = String(req.params.petId).trim().toUpperCase();
      const existing = db.prepare('SELECT * FROM pets WHERE pet_id = ?').get(targetId) as
        | PetRecord
        | undefined;
      if (!existing) {
        return res.status(404).json({ error: `Pet "${targetId}" was not found.` });
      }

      const validation = validatePetInput({
        ...(req.body as Record<string, unknown>),
        pet_id: targetId,
      });
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }
      const data = validation.data;

      db.prepare(
        `UPDATE pets SET
          pet_name = ?, species = ?, breed = ?, age = ?, gender = ?,
          date_of_birth = ?, weight = ?, photo = ?, owner_name = ?, owner_phone = ?, owner_email = ?
         WHERE pet_id = ?`
      ).run(
        data.pet_name,
        data.species,
        data.breed,
        data.age,
        data.gender,
        data.date_of_birth,
        data.weight ?? existing.weight ?? null,
        data.photo || existing.photo || '',
        data.owner_name,
        data.owner_phone,
        data.owner_email,
        targetId
      );

      const updated = db.prepare('SELECT * FROM pets WHERE pet_id = ?').get(targetId) as PetRecord;
      res.json(updated);
    } catch (err) {
      console.error('Update pet error:', err);
      res.status(500).json({ error: 'Failed to update pet record.' });
    }
  });

  app.delete('/api/pets/:petId', requireDoctor, (req, res) => {
    try {
      const targetId = String(req.params.petId).trim().toUpperCase();
      const existing = db.prepare('SELECT pet_id FROM pets WHERE pet_id = ?').get(targetId);
      if (!existing) {
        return res.status(404).json({ error: `Pet "${targetId}" was not found.` });
      }

      const vaxCountRow = db
        .prepare('SELECT COUNT(*) AS count FROM vaccinations WHERE pet_id = ?')
        .get(targetId) as { count: number };

      db.prepare('DELETE FROM pets WHERE pet_id = ?').run(targetId);
      res.json({ deleted: true, pet_id: targetId, cascadedVaccinations: vaxCountRow.count });
    } catch (err) {
      console.error('Delete pet error:', err);
      res.status(500).json({ error: 'Failed to delete pet record.' });
    }
  });

  app.get('/api/vaccinations', requireDoctor, (req, res) => {
    try {
      const today = getTodayDateString();
      const search = String(req.query.search ?? '').trim().toLowerCase();
      const petId = String(req.query.petId ?? '').trim().toUpperCase();
      const species = String(req.query.species ?? '').trim();
      const vaccine = String(req.query.vaccine ?? '').trim();
      const statusFilter = String(req.query.status ?? '').trim();
      const startDate = String(req.query.startDate ?? '').trim();
      const endDate = String(req.query.endDate ?? '').trim();

      let sql = `
        SELECT v.vaccination_id, v.pet_id, p.pet_name, p.species, p.breed,
               p.owner_name, p.owner_phone, v.vaccine_name, v.vaccination_date,
               v.next_due_date, v.veterinarian_name, v.notes, v.created_by, v.is_sample, v.created_at
        FROM vaccinations v
        INNER JOIN pets p ON p.pet_id = v.pet_id
        WHERE 1=1
      `;
      const params: unknown[] = [];

      if (search) {
        sql += ` AND (LOWER(v.pet_id) LIKE ? OR LOWER(p.pet_name) LIKE ? OR LOWER(p.owner_name) LIKE ? OR LOWER(v.vaccine_name) LIKE ? OR LOWER(v.veterinarian_name) LIKE ?)`;
        const like = `%${search}%`;
        params.push(like, like, like, like, like);
      }
      if (petId && petId !== 'ALL') {
        sql += ` AND v.pet_id = ?`;
        params.push(petId);
      }
      if (species && species !== 'All') {
        sql += ` AND p.species = ?`;
        params.push(species);
      }
      if (vaccine && vaccine !== 'All') {
        sql += ` AND v.vaccine_name = ?`;
        params.push(vaccine);
      }
      if (startDate) {
        sql += ` AND v.vaccination_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND v.vaccination_date <= ?`;
        params.push(endDate);
      }

      sql += ` ORDER BY v.vaccination_date DESC, v.vaccination_id DESC`;

      const rows = db.prepare(sql).all(...params) as RawJoinedVaccination[];
      let enriched = rows.map((row) => enrichVaccination(row, today));

      if (statusFilter && statusFilter !== 'All') {
        if (statusFilter === 'Due Within 7 Days') {
          enriched = enriched.filter(
            (r) => r.status === 'Due Today' || (r.status === 'Upcoming' && r.due_within_7_days)
          );
        } else {
          enriched = enriched.filter((r) => r.status === statusFilter);
        }
      }

      res.json(enriched);
    } catch (err) {
      console.error('List vaccinations error:', err);
      res.status(500).json({ error: 'Failed to retrieve vaccination records.' });
    }
  });

  app.post('/api/vaccinations', requireDoctor, (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = validateVaccinationInput(req.body as Record<string, unknown>);
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }
      const data = validation.data;

      const petExists = db.prepare('SELECT pet_id FROM pets WHERE pet_id = ?').get(data.pet_id);
      if (!petExists) {
        return res.status(404).json({
          error: `Registered Pet ID "${data.pet_id}" does not exist. Please register the pet first.`,
        });
      }

      const duplicate = db
        .prepare(
          `SELECT vaccination_id FROM vaccinations
           WHERE pet_id = ? AND LOWER(vaccine_name) = LOWER(?) AND vaccination_date = ?`
        )
        .get(data.pet_id, data.vaccine_name, data.vaccination_date);
      if (duplicate) {
        return res.status(409).json({
          error: `A "${data.vaccine_name}" vaccination record on ${data.vaccination_date} already exists for ${data.pet_id}.`,
        });
      }

      const info = db
        .prepare(
          `INSERT INTO vaccinations (
            pet_id, vaccine_name, vaccination_date, next_due_date,
            veterinarian_name, notes, created_by, is_sample
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
        )
        .run(
          data.pet_id,
          data.vaccine_name,
          data.vaccination_date,
          data.next_due_date,
          data.veterinarian_name,
          data.notes,
          req.authUser?.user_id ?? null
        );

      const createdRow = db
        .prepare(
          `SELECT v.vaccination_id, v.pet_id, p.pet_name, p.species, p.breed,
                  p.owner_name, p.owner_phone, v.vaccine_name, v.vaccination_date,
                  v.next_due_date, v.veterinarian_name, v.notes, v.created_by, v.is_sample, v.created_at
           FROM vaccinations v
           INNER JOIN pets p ON p.pet_id = v.pet_id
           WHERE v.vaccination_id = ?`
        )
        .get(info.lastInsertRowid) as RawJoinedVaccination;

      res.status(201).json(enrichVaccination(createdRow, getTodayDateString()));
    } catch (err) {
      console.error('Create vaccination error:', err);
      res.status(500).json({ error: 'Failed to add vaccination record.' });
    }
  });

  app.put('/api/vaccinations/:id', requireDoctor, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid vaccination record ID.' });
      }

      const existing = db
        .prepare('SELECT vaccination_id FROM vaccinations WHERE vaccination_id = ?')
        .get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Vaccination record not found.' });
      }

      const validation = validateVaccinationInput(req.body as Record<string, unknown>);
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }
      const data = validation.data;

      const petExists = db.prepare('SELECT pet_id FROM pets WHERE pet_id = ?').get(data.pet_id);
      if (!petExists) {
        return res.status(404).json({
          error: `Registered Pet ID "${data.pet_id}" does not exist.`,
        });
      }

      const duplicate = db
        .prepare(
          `SELECT vaccination_id FROM vaccinations
           WHERE pet_id = ? AND LOWER(vaccine_name) = LOWER(?) AND vaccination_date = ? AND vaccination_id != ?`
        )
        .get(data.pet_id, data.vaccine_name, data.vaccination_date, id);
      if (duplicate) {
        return res.status(409).json({
          error: `Another "${data.vaccine_name}" record on ${data.vaccination_date} already exists for ${data.pet_id}.`,
        });
      }

      db.prepare(
        `UPDATE vaccinations SET
          pet_id = ?, vaccine_name = ?, vaccination_date = ?,
          next_due_date = ?, veterinarian_name = ?, notes = ?
         WHERE vaccination_id = ?`
      ).run(
        data.pet_id,
        data.vaccine_name,
        data.vaccination_date,
        data.next_due_date,
        data.veterinarian_name,
        data.notes,
        id
      );

      const updatedRow = db
        .prepare(
          `SELECT v.vaccination_id, v.pet_id, p.pet_name, p.species, p.breed,
                  p.owner_name, p.owner_phone, v.vaccine_name, v.vaccination_date,
                  v.next_due_date, v.veterinarian_name, v.notes, v.created_by, v.is_sample, v.created_at
           FROM vaccinations v
           INNER JOIN pets p ON p.pet_id = v.pet_id
           WHERE v.vaccination_id = ?`
        )
        .get(id) as RawJoinedVaccination;

      res.json(enrichVaccination(updatedRow, getTodayDateString()));
    } catch (err) {
      console.error('Update vaccination error:', err);
      res.status(500).json({ error: 'Failed to update vaccination record.' });
    }
  });

  app.delete('/api/vaccinations/:id', requireDoctor, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid vaccination record ID.' });
      }
      const existing = db
        .prepare('SELECT vaccination_id FROM vaccinations WHERE vaccination_id = ?')
        .get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Vaccination record not found.' });
      }
      db.prepare('DELETE FROM vaccinations WHERE vaccination_id = ?').run(id);
      res.json({ deleted: true, vaccination_id: id });
    } catch (err) {
      console.error('Delete vaccination error:', err);
      res.status(500).json({ error: 'Failed to delete vaccination record.' });
    }
  });

  app.get('/api/analytics', requireDoctor, (req, res) => {
    try {
      const today = getTodayDateString();
      const startDate = String(req.query.startDate ?? '').trim();
      const endDate = String(req.query.endDate ?? '').trim();
      const speciesFilter = String(req.query.species ?? '').trim();
      const vaccineFilter = String(req.query.vaccine ?? '').trim();

      const allOptionsRows = db
        .prepare(
          `SELECT DISTINCT p.species, v.vaccine_name,
                  MIN(v.vaccination_date) OVER () AS minDate,
                  MAX(v.vaccination_date) OVER () AS maxDate
           FROM vaccinations v
           INNER JOIN pets p ON p.pet_id = v.pet_id`
        )
        .all() as { species: string; vaccine_name: string; minDate: string; maxDate: string }[];

      const speciesSet = new Set<string>();
      const vaccineSet = new Set<string>();
      let minDate = today;
      let maxDate = today;
      for (const r of allOptionsRows) {
        speciesSet.add(r.species);
        vaccineSet.add(r.vaccine_name);
        if (r.minDate) minDate = r.minDate;
        if (r.maxDate) maxDate = r.maxDate;
      }

      let sql = `
        SELECT v.vaccination_id, v.pet_id, p.species, v.vaccine_name,
               v.vaccination_date, v.next_due_date
        FROM vaccinations v
        INNER JOIN pets p ON p.pet_id = v.pet_id
        WHERE 1=1
      `;
      const params: unknown[] = [];

      if (startDate) {
        sql += ` AND v.vaccination_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND v.vaccination_date <= ?`;
        params.push(endDate);
      }
      if (speciesFilter && speciesFilter !== 'All') {
        sql += ` AND p.species = ?`;
        params.push(speciesFilter);
      }
      if (vaccineFilter && vaccineFilter !== 'All') {
        sql += ` AND v.vaccine_name = ?`;
        params.push(vaccineFilter);
      }

      const rawRows = db.prepare(sql).all(...params) as {
        vaccination_id: number;
        pet_id: string;
        species: string;
        vaccine_name: string;
        vaccination_date: string;
        next_due_date: string;
      }[];

      const seen = new Set<number>();
      const records = rawRows.filter((r) => {
        if (seen.has(r.vaccination_id)) return false;
        seen.add(r.vaccination_id);
        return true;
      });

      const uniquePets = new Set(records.map((r) => r.pet_id)).size;
      const uniqueVaccines = new Set(records.map((r) => r.vaccine_name)).size;

      const monthMap = new Map<string, number>();
      const vaccineMap = new Map<string, number>();
      const speciesCountMap = new Map<string, number>();
      const yearSet = new Set<string>();
      const yearMonthMap = new Map<string, Map<number, number>>();
      const statusCountMap = new Map<VaccinationStatus, number>([
        ['Completed', 0],
        ['Upcoming', 0],
        ['Due Today', 0],
        ['Overdue', 0],
      ]);
      const yearlyMap = new Map<string, { count: number; pets: Set<string> }>();

      for (const r of records) {
        const ym = r.vaccination_date.slice(0, 7);
        const year = r.vaccination_date.slice(0, 4);
        const monthNum = Number(r.vaccination_date.slice(5, 7));

        monthMap.set(ym, (monthMap.get(ym) ?? 0) + 1);
        vaccineMap.set(r.vaccine_name, (vaccineMap.get(r.vaccine_name) ?? 0) + 1);
        speciesCountMap.set(r.species, (speciesCountMap.get(r.species) ?? 0) + 1);

        yearSet.add(year);
        if (!yearMonthMap.has(year)) {
          yearMonthMap.set(year, new Map<number, number>());
        }
        const mMap = yearMonthMap.get(year)!;
        mMap.set(monthNum, (mMap.get(monthNum) ?? 0) + 1);

        const st = computeVaccinationStatus(r.next_due_date, today).status;
        statusCountMap.set(st, (statusCountMap.get(st) ?? 0) + 1);

        if (!yearlyMap.has(year)) {
          yearlyMap.set(year, { count: 0, pets: new Set() });
        }
        const yEntry = yearlyMap.get(year)!;
        yEntry.count += 1;
        yEntry.pets.add(r.pet_id);
      }

      const monthlyTrend = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({
          month,
          label: formatMonthLabel(month),
          count,
        }));

      const topVaccines = Array.from(vaccineMap.entries())
        .map(([vaccine_name, count]) => ({ vaccine_name, count }))
        .sort((a, b) => b.count - a.count);

      const totalCount = records.length || 1;
      const speciesDistribution = Array.from(speciesCountMap.entries())
        .map(([species, count]) => ({
          species,
          count,
          percentage: Math.round((count / totalCount) * 1000) / 10,
        }))
        .sort((a, b) => b.count - a.count);

      const comparisonYears = Array.from(yearSet).sort((a, b) => a.localeCompare(b));
      const monthlyComparison = MONTH_NAMES.map((monthLabel, idx) => {
        const monthNum = idx + 1;
        const entry: Record<string, string | number> = { monthNum, monthLabel };
        for (const y of comparisonYears) {
          entry[y] = yearMonthMap.get(y)?.get(monthNum) ?? 0;
        }
        return entry;
      });

      const statusBreakdown = (
        ['Completed', 'Upcoming', 'Due Today', 'Overdue'] as VaccinationStatus[]
      ).map((status) => ({
        status,
        count: statusCountMap.get(status) ?? 0,
      }));

      const yearlyComparison = Array.from(yearlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([year, val]) => ({
          year,
          count: val.count,
          uniquePets: val.pets.size,
        }));

      res.json({
        filters: {
          startDate: startDate || minDate,
          endDate: endDate || maxDate,
          species: speciesFilter || 'All',
          vaccine: vaccineFilter || 'All',
        },
        filterOptions: {
          species: Array.from(speciesSet).sort(),
          vaccines: Array.from(vaccineSet).sort(),
          minDate,
          maxDate,
        },
        totals: {
          totalRecords: records.length,
          uniquePets,
          uniqueVaccines,
        },
        monthlyTrend,
        topVaccines,
        speciesDistribution,
        monthlyComparison,
        comparisonYears,
        statusBreakdown,
        yearlyComparison,
      });
    } catch (err) {
      console.error('Analytics error:', err);
      res.status(500).json({ error: 'Failed to compute vaccination analytics.' });
    }
  });

  app.get('/api/reports/pet/:petId', requireDoctor, (req, res) => {
    try {
      const today = getTodayDateString();
      const petId = String(req.params.petId).trim().toUpperCase();
      const pet = db.prepare('SELECT * FROM pets WHERE pet_id = ?').get(petId) as PetRecord | undefined;
      if (!pet) {
        return res.status(404).json({ error: `Pet "${petId}" not found.` });
      }
      const rows = db
        .prepare(
          `SELECT v.vaccination_id, v.pet_id, p.pet_name, p.species, p.breed,
                  p.owner_name, p.owner_phone, v.vaccine_name, v.vaccination_date,
                  v.next_due_date, v.veterinarian_name, v.notes, v.created_by, v.is_sample, v.created_at
           FROM vaccinations v
           INNER JOIN pets p ON p.pet_id = v.pet_id
           WHERE v.pet_id = ?
           ORDER BY v.vaccination_date DESC`
        )
        .all(petId) as RawJoinedVaccination[];

      res.json({
        pet,
        vaccinations: rows.map((r) => enrichVaccination(r, today)),
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Pet report error:', err);
      res.status(500).json({ error: 'Failed to generate pet report.' });
    }
  });

  app.get('/api/export/pets.csv', requireDoctor, (_req, res) => {
    try {
      const pets = db.prepare('SELECT * FROM pets ORDER BY pet_id ASC').all() as PetRecord[];
      const headers = [
        'pet_id',
        'owner_user_id',
        'pet_name',
        'species',
        'breed',
        'age',
        'gender',
        'date_of_birth',
        'weight_kg',
        'owner_name',
        'owner_phone',
        'owner_email',
        'record_type',
      ];
      const lines = [headers.join(',')];
      for (const p of pets) {
        lines.push(
          [
            p.pet_id,
            p.owner_user_id ?? '',
            p.pet_name,
            p.species,
            p.breed,
            p.age,
            p.gender,
            p.date_of_birth,
            p.weight ?? '',
            p.owner_name,
            p.owner_phone,
            p.owner_email,
            p.is_sample ? 'Demonstration Sample' : 'Clinic Record',
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="pawsitive_care_pets.csv"');
      res.send(lines.join('\n'));
    } catch (err) {
      console.error('Export pets CSV error:', err);
      res.status(500).json({ error: 'Failed to export pets CSV.' });
    }
  });

  app.get('/api/export/vaccinations.csv', requireDoctor, (req, res) => {
    try {
      const today = getTodayDateString();
      const search = String(req.query.search ?? '').trim().toLowerCase();
      const vaccine = String(req.query.vaccine ?? '').trim();
      const startDate = String(req.query.startDate ?? '').trim();
      const endDate = String(req.query.endDate ?? '').trim();

      let sql = `
        SELECT v.vaccination_id, v.pet_id, p.pet_name, p.species, p.breed,
               p.owner_name, p.owner_phone, v.vaccine_name, v.vaccination_date,
               v.next_due_date, v.veterinarian_name, v.notes, v.created_by, v.is_sample, v.created_at
        FROM vaccinations v
        INNER JOIN pets p ON p.pet_id = v.pet_id
        WHERE 1=1
      `;
      const params: unknown[] = [];
      if (search) {
        sql += ` AND (LOWER(v.pet_id) LIKE ? OR LOWER(p.pet_name) LIKE ? OR LOWER(p.owner_name) LIKE ?)`;
        const like = `%${search}%`;
        params.push(like, like, like);
      }
      if (vaccine && vaccine !== 'All') {
        sql += ` AND v.vaccine_name = ?`;
        params.push(vaccine);
      }
      if (startDate) {
        sql += ` AND v.vaccination_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND v.vaccination_date <= ?`;
        params.push(endDate);
      }
      sql += ` ORDER BY v.vaccination_date DESC`;

      const rows = db.prepare(sql).all(...params) as RawJoinedVaccination[];
      const headers = [
        'vaccination_id',
        'pet_id',
        'pet_name',
        'species',
        'owner_name',
        'vaccine_name',
        'vaccination_date',
        'next_due_date',
        'status',
        'veterinarian_name',
        'notes',
        'record_type',
      ];
      const lines = [headers.join(',')];
      for (const r of rows) {
        const status = computeVaccinationStatus(r.next_due_date, today).status;
        lines.push(
          [
            r.vaccination_id,
            r.pet_id,
            r.pet_name,
            r.species,
            r.owner_name,
            r.vaccine_name,
            r.vaccination_date,
            r.next_due_date,
            status,
            r.veterinarian_name,
            r.notes,
            r.is_sample ? 'Demonstration Sample' : 'Clinic Record',
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="pawsitive_care_vaccinations.csv"'
      );
      res.send(lines.join('\n'));
    } catch (err) {
      console.error('Export vaccinations CSV error:', err);
      res.status(500).json({ error: 'Failed to export vaccinations CSV.' });
    }
  });

  app.get('/api/export/summary.txt', requireDoctor, (_req, res) => {
    try {
      const today = getTodayDateString();
      const totalPets = (db.prepare('SELECT COUNT(*) AS count FROM pets').get() as { count: number }).count;
      const rows = db
        .prepare(
          `SELECT v.vaccination_id, v.pet_id, p.pet_name, p.species, p.breed,
                  p.owner_name, p.owner_phone, v.vaccine_name, v.vaccination_date,
                  v.next_due_date, v.veterinarian_name, v.notes, v.created_by, v.is_sample, v.created_at
           FROM vaccinations v
           INNER JOIN pets p ON p.pet_id = v.pet_id
           ORDER BY v.next_due_date ASC`
        )
        .all() as RawJoinedVaccination[];

      const enriched = rows.map((r) => enrichVaccination(r, today));
      const overdue = enriched.filter((r) => r.status === 'Overdue');
      const dueToday = enriched.filter((r) => r.status === 'Due Today');
      const due7 = enriched.filter((r) => r.status === 'Upcoming' && r.due_within_7_days);
      const completed = enriched.filter((r) => r.status === 'Completed');

      const vaccineCounts = new Map<string, number>();
      for (const r of enriched) {
        vaccineCounts.set(r.vaccine_name, (vaccineCounts.get(r.vaccine_name) ?? 0) + 1);
      }

      const reportLines = [
        '========================================================================',
        'PAWSITIVE CARE VETERINARY CLINIC — VACCINATION SUMMARY REPORT',
        `Generated Date: ${today}`,
        'Note: Records flagged [Sample] are demonstration data.',
        '========================================================================',
        '',
        '1. CLINIC OVERVIEW',
        `   - Total Registered Pets:       ${totalPets}`,
        `   - Total Vaccination Records:   ${enriched.length}`,
        `   - Overdue Vaccinations:        ${overdue.length}`,
        `   - Due Today:                   ${dueToday.length}`,
        `   - Upcoming (Next 7 Days):      ${due7.length}`,
        `   - Current / Completed (>30d):  ${completed.length}`,
        '',
        '2. VACCINES ADMINISTERED BREAKDOWN',
        ...Array.from(vaccineCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([name, cnt]) => `   - ${name.padEnd(22, ' ')} ${cnt} doses`),
        '',
        '3. PRIORITY FOLLOW-UP QUEUE (DUE TODAY & OVERDUE)',
        ...(overdue.length + dueToday.length === 0
          ? ['   No overdue or due-today vaccinations at this time.']
          : [...dueToday, ...overdue].map(
              (r) =>
                `   - [${r.status.toUpperCase()}] ${r.pet_id} ${r.pet_name} (${r.species}) | ${r.vaccine_name} | Due: ${r.next_due_date} | Owner: ${r.owner_name} (${r.owner_phone})`
            )),
        '',
        '4. UPCOMING WITHIN 7 DAYS',
        ...(due7.length === 0
          ? ['   No vaccinations due within the next 7 days.']
          : due7.map(
              (r) =>
                `   - ${r.pet_id} ${r.pet_name} (${r.species}) | ${r.vaccine_name} | Due: ${r.next_due_date} (${r.days_until_due}d) | Owner: ${r.owner_name}`
            )),
        '',
        '========================================================================',
      ];

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="pawsitive_care_summary_${today}.txt"`
      );
      res.send(reportLines.join('\n'));
    } catch (err) {
      console.error('Summary export error:', err);
      res.status(500).json({ error: 'Failed to generate summary report.' });
    }
  });

  // Doctor CSV Import Endpoints
  app.post('/api/import/pets', requireDoctor, (req, res) => {
    try {
      const csvText = typeof req.body?.csvText === 'string' ? req.body.csvText : '';
      const dryRun = Boolean(req.body?.dryRun);
      const mode = req.body?.mode === 'update' ? 'update' : 'skip';

      const parsed = parseCsvText(csvText);
      const requiredCols = ['pet_name', 'species', 'breed', 'date_of_birth', 'gender', 'owner_name', 'owner_phone'];
      const missingCols = requiredCols.filter((c) => !parsed.headers.includes(c));
      if (missingCols.length > 0) {
        return res.status(400).json({
          error: `Missing required CSV column(s): ${missingCols.join(', ')}`,
        });
      }

      const existingPetsRows = db.prepare('SELECT pet_id, owner_user_id FROM pets').all() as {
        pet_id: string;
        owner_user_id: number | null;
      }[];
      const existingPetMap = new Map<string, number | null>();
      let maxPetNum = 1024;
      for (const p of existingPetsRows) {
        existingPetMap.set(p.pet_id.toUpperCase(), p.owner_user_id);
        const m = p.pet_id.match(/(\d+)$/);
        if (m) {
          const n = Number(m[1]);
          if (n > maxPetNum) maxPetNum = n;
        }
      }

      const customerUsers = db
        .prepare("SELECT user_id, phone_number FROM users WHERE role = 'customer'")
        .all() as { user_id: number; phone_number: string }[];
      const customerByPhone = new Map<string, number>();
      for (const u of customerUsers) {
        customerByPhone.set(normalizePhone(u.phone_number), u.user_id);
      }

      const unescapeFormula = (v: string) => v.replace(/^'(?=[=+\-@\t\r])/, '');
      const seenBatchIds = new Set<string>();

      interface PreparedPetOp {
        mode: 'insert' | 'update';
        ownerUserId: number | null;
        data: ReturnType<typeof validatePetInput> extends infer R
          ? R extends { ok: true; data: infer D }
            ? D
            : never
          : never;
      }

      const ops: PreparedPetOp[] = [];
      const rowResults: CsvImportRowResult[] = [];
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      let errorsCount = 0;

      parsed.rows.forEach((rowMap, index) => {
        const rowNum = index + 2;
        const getCell = (key: string) => unescapeFormula(rowMap.get(key) ?? '');

        let rawPetId = getCell('pet_id').toUpperCase();
        if (!rawPetId) {
          maxPetNum += 1;
          rawPetId = `PET-${maxPetNum}`;
        }

        const petName = getCell('pet_name');
        const ownerPhone = getCell('owner_phone');
        const weightRaw = getCell('weight') || getCell('weight_kg');
        const ageRaw = getCell('age');

        const validation = validatePetInput({
          pet_id: rawPetId,
          pet_name: petName,
          species: getCell('species'),
          breed: getCell('breed'),
          age: ageRaw,
          gender: getCell('gender'),
          date_of_birth: getCell('date_of_birth'),
          weight: weightRaw,
          owner_name: getCell('owner_name'),
          owner_phone: ownerPhone,
          owner_email: getCell('owner_email'),
        });

        if (!validation.ok) {
          errorsCount += 1;
          rowResults.push({
            row: rowNum,
            identifier: rawPetId,
            label: petName || 'Unknown Pet',
            action: 'error',
            reason: validation.error,
          });
          return;
        }

        const data = validation.data;
        if (seenBatchIds.has(data.pet_id)) {
          skipped += 1;
          rowResults.push({
            row: rowNum,
            identifier: data.pet_id,
            label: data.pet_name,
            action: 'skip',
            reason: 'Duplicate Pet ID within uploaded CSV file.',
          });
          return;
        }
        seenBatchIds.add(data.pet_id);

        const matchedOwnerId = customerByPhone.get(normalizePhone(data.owner_phone)) ?? null;
        const alreadyExists = existingPetMap.has(data.pet_id);

        if (alreadyExists) {
          if (mode === 'skip') {
            skipped += 1;
            rowResults.push({
              row: rowNum,
              identifier: data.pet_id,
              label: data.pet_name,
              action: 'skip',
              reason: 'Pet ID already exists in clinic database.',
            });
            return;
          }
          const preservedOwner = existingPetMap.get(data.pet_id) ?? matchedOwnerId;
          updated += 1;
          ops.push({ mode: 'update', ownerUserId: preservedOwner, data });
          rowResults.push({
            row: rowNum,
            identifier: data.pet_id,
            label: data.pet_name,
            action: 'update',
            reason: 'Will update existing pet record.',
          });
        } else {
          inserted += 1;
          ops.push({ mode: 'insert', ownerUserId: matchedOwnerId, data });
          rowResults.push({
            row: rowNum,
            identifier: data.pet_id,
            label: data.pet_name,
            action: 'insert',
            reason: matchedOwnerId
              ? 'New pet linked to registered customer by phone.'
              : 'New pet record ready to insert.',
          });
        }
      });

      if (!dryRun && ops.length > 0) {
        const insertStmt = db.prepare(
          `INSERT INTO pets (
            pet_id, owner_user_id, pet_name, species, breed, age, gender, date_of_birth,
            weight, photo, owner_name, owner_phone, owner_email, is_sample
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, 0)`
        );
        const updateStmt = db.prepare(
          `UPDATE pets SET
            owner_user_id = ?, pet_name = ?, species = ?, breed = ?, age = ?, gender = ?,
            date_of_birth = ?, weight = ?, owner_name = ?, owner_phone = ?, owner_email = ?
           WHERE pet_id = ?`
        );

        db.transaction(() => {
          for (const op of ops) {
            const d = op.data;
            if (op.mode === 'insert') {
              insertStmt.run(
                d.pet_id,
                op.ownerUserId,
                d.pet_name,
                d.species,
                d.breed,
                d.age,
                d.gender,
                d.date_of_birth,
                d.weight,
                d.owner_name,
                d.owner_phone,
                d.owner_email
              );
            } else {
              updateStmt.run(
                op.ownerUserId,
                d.pet_name,
                d.species,
                d.breed,
                d.age,
                d.gender,
                d.date_of_birth,
                d.weight,
                d.owner_name,
                d.owner_phone,
                d.owner_email,
                d.pet_id
              );
            }
          }
        })();
      }

      const result: CsvImportResult = {
        dryRun,
        dataset: 'pets',
        totalRows: parsed.rows.length,
        inserted,
        updated,
        skipped,
        errorsCount,
        rows: rowResults,
      };
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to parse or import Pets CSV.',
      });
    }
  });

  app.post('/api/import/vaccinations', requireDoctor, (req: AuthenticatedRequest, res: Response) => {
    try {
      const csvText = typeof req.body?.csvText === 'string' ? req.body.csvText : '';
      const dryRun = Boolean(req.body?.dryRun);

      const parsed = parseCsvText(csvText);
      const requiredCols = [
        'pet_id',
        'vaccine_name',
        'vaccination_date',
        'next_due_date',
        'veterinarian_name',
      ];
      const missingCols = requiredCols.filter((c) => !parsed.headers.includes(c));
      if (missingCols.length > 0) {
        return res.status(400).json({
          error: `Missing required CSV column(s): ${missingCols.join(', ')}`,
        });
      }

      const registeredPets = new Set(
        (db.prepare('SELECT pet_id FROM pets').all() as { pet_id: string }[]).map((p) =>
          p.pet_id.toUpperCase()
        )
      );

      const existingVaxKeys = new Set(
        (
          db
            .prepare('SELECT pet_id, vaccine_name, vaccination_date FROM vaccinations')
            .all() as { pet_id: string; vaccine_name: string; vaccination_date: string }[]
        ).map(
          (v) => `${v.pet_id.toUpperCase()}|${v.vaccine_name.toLowerCase()}|${v.vaccination_date}`
        )
      );

      const unescapeFormula = (v: string) => v.replace(/^'(?=[=+\-@\t\r])/, '');
      const seenBatchKeys = new Set<string>();

      type ValidatedVax = ReturnType<typeof validateVaccinationInput> extends infer R
        ? R extends { ok: true; data: infer D }
          ? D
          : never
        : never;

      const toInsert: ValidatedVax[] = [];
      const rowResults: CsvImportRowResult[] = [];
      let inserted = 0;
      let skipped = 0;
      let errorsCount = 0;

      parsed.rows.forEach((rowMap, index) => {
        const rowNum = index + 2;
        const getCell = (key: string) => unescapeFormula(rowMap.get(key) ?? '');

        const validation = validateVaccinationInput({
          pet_id: getCell('pet_id'),
          vaccine_name: getCell('vaccine_name'),
          vaccination_date: getCell('vaccination_date'),
          next_due_date: getCell('next_due_date'),
          veterinarian_name: getCell('veterinarian_name'),
          notes: getCell('notes'),
        });

        const rawPetId = getCell('pet_id').toUpperCase() || '—';
        const rawVac = getCell('vaccine_name') || 'Unknown Vaccine';

        if (!validation.ok) {
          errorsCount += 1;
          rowResults.push({
            row: rowNum,
            identifier: rawPetId,
            label: rawVac,
            action: 'error',
            reason: validation.error,
          });
          return;
        }

        const data = validation.data;
        if (!registeredPets.has(data.pet_id)) {
          errorsCount += 1;
          rowResults.push({
            row: rowNum,
            identifier: data.pet_id,
            label: data.vaccine_name,
            action: 'error',
            reason: `Pet ID "${data.pet_id}" is not registered in the clinic database.`,
          });
          return;
        }

        const dedupKey = `${data.pet_id}|${data.vaccine_name.toLowerCase()}|${data.vaccination_date}`;
        if (existingVaxKeys.has(dedupKey) || seenBatchKeys.has(dedupKey)) {
          skipped += 1;
          rowResults.push({
            row: rowNum,
            identifier: data.pet_id,
            label: `${data.vaccine_name} (${data.vaccination_date})`,
            action: 'skip',
            reason: 'Duplicate vaccination record (same Pet ID, vaccine, and date).',
          });
          return;
        }
        seenBatchKeys.add(dedupKey);

        inserted += 1;
        toInsert.push(data);
        rowResults.push({
          row: rowNum,
          identifier: data.pet_id,
          label: `${data.vaccine_name} (${data.vaccination_date})`,
          action: 'insert',
          reason: 'Ready to insert vaccination record.',
        });
      });

      if (!dryRun && toInsert.length > 0) {
        const insertStmt = db.prepare(
          `INSERT INTO vaccinations (
            pet_id, vaccine_name, vaccination_date, next_due_date,
            veterinarian_name, notes, created_by, is_sample
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
        );
        const doctorId = req.authUser?.user_id ?? null;

        db.transaction(() => {
          for (const d of toInsert) {
            insertStmt.run(
              d.pet_id,
              d.vaccine_name,
              d.vaccination_date,
              d.next_due_date,
              d.veterinarian_name,
              d.notes,
              doctorId
            );
          }
        })();
      }

      const result: CsvImportResult = {
        dryRun,
        dataset: 'vaccinations',
        totalRows: parsed.rows.length,
        inserted,
        updated: 0,
        skipped,
        errorsCount,
        rows: rowResults,
      };
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to parse or import Vaccinations CSV.',
      });
    }
  });

  // =========================================================================
  // CUSTOMER-ONLY PORTAL ENDPOINTS (STRICTLY SCOPED BY req.authUser.user_id)
  // =========================================================================

  app.get('/api/customer/dashboard', requireCustomer, (req: AuthenticatedRequest, res: Response) => {
    try {
      const today = getTodayDateString();
      const customerId = req.authUser!.user_id;

      const pets = db
        .prepare('SELECT * FROM pets WHERE owner_user_id = ? ORDER BY created_at DESC')
        .all(customerId) as PetRecord[];

      const vaxRows = db
        .prepare(
          `SELECT v.vaccination_id, v.pet_id, p.pet_name, p.species, p.breed,
                  p.owner_name, p.owner_phone, v.vaccine_name, v.vaccination_date,
                  v.next_due_date, v.veterinarian_name, v.notes, v.created_by, v.is_sample, v.created_at
           FROM vaccinations v
           INNER JOIN pets p ON p.pet_id = v.pet_id
           WHERE p.owner_user_id = ?
           ORDER BY v.next_due_date ASC, v.vaccination_id DESC`
        )
        .all(customerId) as RawJoinedVaccination[];

      const enriched = vaxRows.map((row) => enrichVaccination(row, today));
      const dueToday = enriched.filter((r) => r.status === 'Due Today');
      const dueWithin7Days = enriched.filter(
        (r) => r.status === 'Upcoming' && r.due_within_7_days
      );
      const upcoming = enriched.filter((r) => r.status === 'Upcoming');
      const overdue = enriched.filter((r) => r.status === 'Overdue');
      const completed = enriched.filter((r) => r.status === 'Completed');

      res.json({
        today,
        kpis: {
          myPets: pets.length,
          totalCompleted: completed.length,
          upcomingVaccinations: upcoming.length + dueToday.length,
          overdueVaccinations: overdue.length,
          dueWithin7Days: dueWithin7Days.length,
        },
        alerts: {
          dueToday,
          dueWithin7Days,
          overdue,
        },
        pets,
        upcomingSchedule: [...overdue, ...dueToday, ...upcoming].slice(0, 10),
      });
    } catch (err) {
      console.error('Customer dashboard error:', err);
      res.status(500).json({ error: 'Failed to load Pet Owner dashboard.' });
    }
  });

  app.get('/api/customer/pets', requireCustomer, (req: AuthenticatedRequest, res: Response) => {
    try {
      const today = getTodayDateString();
      const customerId = req.authUser!.user_id;

      const pets = db
        .prepare('SELECT * FROM pets WHERE owner_user_id = ? ORDER BY created_at DESC')
        .all(customerId) as PetRecord[];

      const vaxRows = db
        .prepare(
          `SELECT v.pet_id, v.next_due_date
           FROM vaccinations v
           INNER JOIN pets p ON p.pet_id = v.pet_id
           WHERE p.owner_user_id = ?
           ORDER BY v.next_due_date ASC`
        )
        .all(customerId) as { pet_id: string; next_due_date: string }[];

      const byPet = new Map<
        string,
        { count: number; nextDue: string | null; status: VaccinationStatus | null }
      >();
      const priority: Record<VaccinationStatus, number> = {
        Overdue: 4,
        'Due Today': 3,
        Upcoming: 2,
        Completed: 1,
      };

      for (const v of vaxRows) {
        const computed = computeVaccinationStatus(v.next_due_date, today).status;
        const existing = byPet.get(v.pet_id);
        if (!existing) {
          byPet.set(v.pet_id, { count: 1, nextDue: v.next_due_date, status: computed });
        } else {
          existing.count += 1;
          if (!existing.status || priority[computed] > priority[existing.status]) {
            existing.status = computed;
            existing.nextDue = v.next_due_date;
          }
        }
      }

      res.json(
        pets.map((p) => {
          const summary = byPet.get(p.pet_id);
          return {
            ...p,
            vaccination_count: summary?.count ?? 0,
            latest_status: summary?.status ?? null,
            next_due_date: summary?.nextDue ?? null,
          };
        })
      );
    } catch (err) {
      console.error('Customer pets error:', err);
      res.status(500).json({ error: 'Failed to load your pets.' });
    }
  });

  app.post('/api/customer/pets', requireCustomer, (req: AuthenticatedRequest, res: Response) => {
    try {
      const authUser = req.authUser!;
      const autoPetId = generateNextPetId(db);

      // Strictly derive owner identity from authenticated session — never trust client-supplied owner IDs
      const payloadForValidation: Record<string, unknown> = {
        ...(req.body as Record<string, unknown>),
        pet_id: autoPetId,
        owner_name: authUser.full_name,
        owner_phone: authUser.phone_number,
        owner_email: authUser.email ?? '',
      };

      const validation = validatePetInput(payloadForValidation);
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }
      const data = validation.data;

      db.prepare(
        `INSERT INTO pets (
          pet_id, owner_user_id, pet_name, species, breed, age, gender, date_of_birth,
          weight, photo, owner_name, owner_phone, owner_email, is_sample
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
      ).run(
        data.pet_id,
        authUser.user_id,
        data.pet_name,
        data.species,
        data.breed,
        data.age,
        data.gender,
        data.date_of_birth,
        data.weight,
        data.photo,
        authUser.full_name,
        formatPhoneDisplay(authUser.phone_number),
        authUser.email ?? ''
      );

      const created = db
        .prepare('SELECT * FROM pets WHERE pet_id = ? AND owner_user_id = ?')
        .get(data.pet_id, authUser.user_id) as PetRecord;
      res.status(201).json(created);
    } catch (err) {
      console.error('Customer register pet error:', err);
      res.status(500).json({ error: 'Failed to register your pet.' });
    }
  });

  app.get('/api/customer/vaccinations', requireCustomer, (req: AuthenticatedRequest, res: Response) => {
    try {
      const today = getTodayDateString();
      const customerId = req.authUser!.user_id;
      const petId = String(req.query.petId ?? '').trim().toUpperCase();
      const statusFilter = String(req.query.status ?? '').trim();

      let sql = `
        SELECT v.vaccination_id, v.pet_id, p.pet_name, p.species, p.breed,
               p.owner_name, p.owner_phone, v.vaccine_name, v.vaccination_date,
               v.next_due_date, v.veterinarian_name, v.notes, v.created_by, v.is_sample, v.created_at
        FROM vaccinations v
        INNER JOIN pets p ON p.pet_id = v.pet_id
        WHERE p.owner_user_id = ?
      `;
      const params: unknown[] = [customerId];

      if (petId && petId !== 'ALL') {
        sql += ` AND v.pet_id = ?`;
        params.push(petId);
      }
      sql += ` ORDER BY v.vaccination_date DESC, v.vaccination_id DESC`;

      const rows = db.prepare(sql).all(...params) as RawJoinedVaccination[];
      let enriched = rows.map((row) => enrichVaccination(row, today));

      if (statusFilter && statusFilter !== 'All') {
        if (statusFilter === 'Due Within 7 Days') {
          enriched = enriched.filter(
            (r) => r.status === 'Due Today' || (r.status === 'Upcoming' && r.due_within_7_days)
          );
        } else {
          enriched = enriched.filter((r) => r.status === statusFilter);
        }
      }

      res.json(enriched);
    } catch (err) {
      console.error('Customer vaccinations error:', err);
      res.status(500).json({ error: 'Failed to load vaccination history.' });
    }
  });

  app.get('/api/customer/reports/pet/:petId', requireCustomer, (req: AuthenticatedRequest, res: Response) => {
    try {
      const today = getTodayDateString();
      const customerId = req.authUser!.user_id;
      const petId = String(req.params.petId).trim().toUpperCase();

      const pet = db
        .prepare('SELECT * FROM pets WHERE pet_id = ? AND owner_user_id = ?')
        .get(petId, customerId) as PetRecord | undefined;

      if (!pet) {
        return res.status(403).json({
          error: 'Access denied or pet not found under your account.',
        });
      }

      const rows = db
        .prepare(
          `SELECT v.vaccination_id, v.pet_id, p.pet_name, p.species, p.breed,
                  p.owner_name, p.owner_phone, v.vaccine_name, v.vaccination_date,
                  v.next_due_date, v.veterinarian_name, v.notes, v.created_by, v.is_sample, v.created_at
           FROM vaccinations v
           INNER JOIN pets p ON p.pet_id = v.pet_id
           WHERE v.pet_id = ? AND p.owner_user_id = ?
           ORDER BY v.vaccination_date DESC`
        )
        .all(petId, customerId) as RawJoinedVaccination[];

      res.json({
        pet,
        vaccinations: rows.map((r) => enrichVaccination(r, today)),
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Customer pet report error:', err);
      res.status(500).json({ error: 'Failed to load pet vaccination report.' });
    }
  });

  app.get('/api/customer/profile', requireCustomer, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.authUser });
  });

  app.put('/api/customer/profile', requireCustomer, (req: AuthenticatedRequest, res: Response) => {
    try {
      const customerId = req.authUser!.user_id;
      const full_name = String(req.body.full_name ?? '').trim();
      const email = String(req.body.email ?? '').trim().toLowerCase();

      if (full_name.length < 2 || full_name.length > 100) {
        return res.status(400).json({ error: 'Full name must be 2 to 100 characters.' });
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      if (email) {
        const conflict = db
          .prepare('SELECT user_id FROM users WHERE LOWER(email) = ? AND user_id != ?')
          .get(email, customerId);
        if (conflict) {
          return res.status(409).json({ error: 'This email address is already used by another account.' });
        }
      }

      db.transaction(() => {
        db.prepare('UPDATE users SET full_name = ?, email = ? WHERE user_id = ?').run(
          full_name,
          email || null,
          customerId
        );
        db.prepare('UPDATE pets SET owner_name = ?, owner_email = ? WHERE owner_user_id = ?').run(
          full_name,
          email,
          customerId
        );
      })();

      const updated = db
        .prepare(
          'SELECT user_id, full_name, phone_number, email, role, is_verified, created_at FROM users WHERE user_id = ?'
        )
        .get(customerId) as AuthUser;
      res.json({ user: updated });
    } catch (err) {
      console.error('Customer profile update error:', err);
      res.status(500).json({ error: 'Failed to update profile.' });
    }
  });

  app.post('/api/customer/change-password', requireCustomer, (req: AuthenticatedRequest, res: Response) => {
    try {
      const customerId = req.authUser!.user_id;
      const current_password = String(req.body.current_password ?? '');
      const new_password = String(req.body.new_password ?? '');
      const confirm_password = String(req.body.confirm_password ?? '');

      if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Current and new passwords are required.' });
      }
      if (new_password.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
      }
      if (new_password !== confirm_password) {
        return res.status(400).json({ error: 'New passwords do not match.' });
      }

      const row = db
        .prepare('SELECT password_hash FROM users WHERE user_id = ?')
        .get(customerId) as { password_hash: string } | undefined;

      if (!row || !verifyPassword(current_password, row.password_hash)) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }

      db.prepare('UPDATE users SET password_hash = ? WHERE user_id = ?').run(
        hashPassword(new_password),
        customerId
      );
      res.json({ ok: true, message: 'Password updated successfully.' });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(500).json({ error: 'Failed to change password.' });
    }
  });

  // Vite dev middleware or production static serving
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'));
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pawsitive Care Veterinary Clinic server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
