import Database from 'better-sqlite3';
import path from 'path';
import { seedDatabaseIfEmpty } from './seed.ts';

let dbInstance: Database.Database | null = null;

function tableHasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = path.resolve(process.cwd(), 'clinic.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone_number TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('doctor', 'customer')),
      is_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS otp_verifications (
      otp_id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'reset')),
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      consumed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pets (
      pet_id TEXT PRIMARY KEY,
      owner_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
      pet_name TEXT NOT NULL,
      species TEXT NOT NULL,
      breed TEXT NOT NULL,
      age REAL NOT NULL,
      gender TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      weight REAL,
      photo TEXT NOT NULL DEFAULT '',
      owner_name TEXT NOT NULL,
      owner_phone TEXT NOT NULL,
      owner_email TEXT NOT NULL DEFAULT '',
      is_sample INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vaccinations (
      vaccination_id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_id TEXT NOT NULL,
      vaccine_name TEXT NOT NULL,
      vaccination_date TEXT NOT NULL,
      next_due_date TEXT NOT NULL,
      veterinarian_name TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
      is_sample INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (pet_id) REFERENCES pets(pet_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    );
  `);

  // Safe non-destructive migrations for existing v1 clinic.db databases
  if (!tableHasColumn(db, 'pets', 'owner_user_id')) {
    db.exec('ALTER TABLE pets ADD COLUMN owner_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;');
  }
  if (!tableHasColumn(db, 'pets', 'weight')) {
    db.exec('ALTER TABLE pets ADD COLUMN weight REAL;');
  }
  if (!tableHasColumn(db, 'pets', 'photo')) {
    db.exec("ALTER TABLE pets ADD COLUMN photo TEXT NOT NULL DEFAULT '';");
  }
  if (!tableHasColumn(db, 'vaccinations', 'created_by')) {
    db.exec('ALTER TABLE vaccinations ADD COLUMN created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL;');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_pets_owner_user_id ON pets(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_vaccinations_pet_id ON vaccinations(pet_id);
    CREATE INDEX IF NOT EXISTS idx_vaccinations_dates ON vaccinations(vaccination_date, next_due_date);
    CREATE INDEX IF NOT EXISTS idx_vaccinations_vaccine ON vaccinations(vaccine_name);
    CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications(phone_number, created_at);
  `);

  seedDatabaseIfEmpty(db);
  dbInstance = db;
  return db;
}
