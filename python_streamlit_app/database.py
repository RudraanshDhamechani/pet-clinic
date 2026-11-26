"""
database.py — SQLite persistence, input validation, and dynamic status engine
for Pawsitive Care Veterinary Clinic.
"""

from __future__ import annotations

import re
import sqlite3
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

DB_PATH = Path(__file__).resolve().parent / "clinic.db"

ALLOWED_SPECIES = ["Dog", "Cat", "Rabbit", "Bird", "Other"]
ALLOWED_GENDERS = ["Male", "Female"]
COMMON_VACCINES = [
    "Rabies",
    "DHPP",
    "FVRCP",
    "Bordetella",
    "Leptospirosis",
    "FeLV",
    "Lyme",
    "RHDV2",
    "Canine Influenza",
]


def get_connection() -> sqlite3.Connection:
    """Open a SQLite connection with foreign-key constraints enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_database() -> None:
    """Create the pets and vaccinations tables if they do not exist."""
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS pets (
                pet_id TEXT PRIMARY KEY,
                pet_name TEXT NOT NULL,
                species TEXT NOT NULL,
                breed TEXT NOT NULL,
                age REAL NOT NULL,
                gender TEXT NOT NULL,
                date_of_birth TEXT NOT NULL,
                owner_name TEXT NOT NULL,
                owner_phone TEXT NOT NULL,
                owner_email TEXT NOT NULL,
                is_sample INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS vaccinations (
                vaccination_id INTEGER PRIMARY KEY AUTOINCREMENT,
                pet_id TEXT NOT NULL,
                vaccine_name TEXT NOT NULL,
                vaccination_date TEXT NOT NULL,
                next_due_date TEXT NOT NULL,
                veterinarian_name TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                is_sample INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pet_id) REFERENCES pets(pet_id)
                    ON UPDATE CASCADE
                    ON DELETE CASCADE
            );
            """
        )
        conn.commit()


def compute_status(next_due_str: str, today: Optional[date] = None) -> Tuple[str, int, bool]:
    """
    Dynamically calculate vaccination status against today's date.
    Returns (status_label, days_until_due, due_within_7_days).
    """
    ref_day = today or date.today()
    due_day = datetime.strptime(next_due_str, "%Y-%m-%d").date()
    delta = (due_day - ref_day).days

    if delta < 0:
        return "Overdue", delta, False
    if delta == 0:
        return "Due Today", 0, True
    if delta <= 30:
        return "Upcoming", delta, delta <= 7
    return "Completed", delta, False


def validate_pet_data(
    pet_id: str,
    pet_name: str,
    species: str,
    breed: str,
    age: float,
    gender: str,
    dob: date,
    owner_name: str,
    owner_phone: str,
    owner_email: str,
) -> Optional[str]:
    """Return an error string if validation fails, otherwise None."""
    clean_id = pet_id.strip().upper()
    if not re.match(r"^[A-Z0-9-]{3,20}$", clean_id):
        return "Pet ID must be 3–20 characters using letters, numbers, or hyphens."
    if not pet_name.strip():
        return "Pet name is required."
    if species not in ALLOWED_SPECIES:
        return "Invalid species selected."
    if not breed.strip():
        return "Breed is required."
    if age < 0 or age > 40:
        return "Age must be between 0 and 40 years."
    if gender not in ALLOWED_GENDERS:
        return "Gender must be Male or Female."
    if dob > date.today():
        return "Date of birth cannot be in the future."
    if len(owner_name.strip()) < 2:
        return "Owner name is required."
    digits = re.sub(r"\D", "", owner_phone)
    if len(digits) < 10 or len(digits) > 15:
        return "Owner phone number must have 10 to 15 digits."
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", owner_email.strip()):
        return "Please enter a valid owner email address."
    return None


def validate_vaccination_data(
    pet_id: str,
    vaccine_name: str,
    vaccination_date: date,
    next_due_date: date,
    veterinarian_name: str,
) -> Optional[str]:
    """Validate vaccination date bounds, required fields, and pet existence."""
    if not pet_id.strip():
        return "Please select a registered pet."
    if not vaccine_name.strip():
        return "Vaccine name is required."
    if vaccination_date > date.today():
        return "Vaccination date cannot be in the future."
    if next_due_date < vaccination_date:
        return "Next due date cannot be earlier than vaccination date."
    if len(veterinarian_name.strip()) < 2:
        return "Veterinarian name is required."
    return None


def add_pet(payload: Dict[str, Any]) -> Tuple[bool, str]:
    """Insert a new pet record after verifying uniqueness."""
    clean_id = payload["pet_id"].strip().upper()
    try:
        with get_connection() as conn:
            exists = conn.execute(
                "SELECT 1 FROM pets WHERE pet_id = ?", (clean_id,)
            ).fetchone()
            if exists:
                return False, f"Pet ID '{clean_id}' already exists."

            conn.execute(
                """
                INSERT INTO pets (
                    pet_id, pet_name, species, breed, age, gender,
                    date_of_birth, owner_name, owner_phone, owner_email, is_sample
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    clean_id,
                    payload["pet_name"].strip(),
                    payload["species"],
                    payload["breed"].strip(),
                    float(payload["age"]),
                    payload["gender"],
                    payload["date_of_birth"],
                    payload["owner_name"].strip(),
                    payload["owner_phone"].strip(),
                    payload["owner_email"].strip().lower(),
                    int(payload.get("is_sample", 0)),
                ),
            )
            conn.commit()
        return True, f"Pet '{payload['pet_name']}' ({clean_id}) registered successfully."
    except sqlite3.Error as exc:
        return False, f"Database error: {exc}"


def update_pet(pet_id: str, payload: Dict[str, Any]) -> Tuple[bool, str]:
    """Update an existing pet record."""
    try:
        with get_connection() as conn:
            conn.execute(
                """
                UPDATE pets SET
                    pet_name = ?, species = ?, breed = ?, age = ?, gender = ?,
                    date_of_birth = ?, owner_name = ?, owner_phone = ?, owner_email = ?
                WHERE pet_id = ?
                """,
                (
                    payload["pet_name"].strip(),
                    payload["species"],
                    payload["breed"].strip(),
                    float(payload["age"]),
                    payload["gender"],
                    payload["date_of_birth"],
                    payload["owner_name"].strip(),
                    payload["owner_phone"].strip(),
                    payload["owner_email"].strip().lower(),
                    pet_id,
                ),
            )
            conn.commit()
        return True, f"Updated pet record {pet_id}."
    except sqlite3.Error as exc:
        return False, f"Database error: {exc}"


def delete_pet(pet_id: str) -> Tuple[bool, str]:
    """Delete a pet and cascade associated vaccination records."""
    try:
        with get_connection() as conn:
            conn.execute("DELETE FROM pets WHERE pet_id = ?", (pet_id,))
            conn.commit()
        return True, f"Deleted pet {pet_id} and associated vaccination records."
    except sqlite3.Error as exc:
        return False, f"Database error: {exc}"


def get_pets_df() -> pd.DataFrame:
    """Return all registered pets as a Pandas DataFrame."""
    with get_connection() as conn:
        return pd.read_sql_query("SELECT * FROM pets ORDER BY pet_id ASC", conn)


def add_vaccination(payload: Dict[str, Any]) -> Tuple[bool, str]:
    """Insert a vaccination record while enforcing FK & duplicate protection."""
    clean_id = payload["pet_id"].strip().upper()
    try:
        with get_connection() as conn:
            pet_exists = conn.execute(
                "SELECT 1 FROM pets WHERE pet_id = ?", (clean_id,)
            ).fetchone()
            if not pet_exists:
                return False, f"Pet ID '{clean_id}' is not registered."

            dup = conn.execute(
                """
                SELECT 1 FROM vaccinations
                WHERE pet_id = ? AND LOWER(vaccine_name) = LOWER(?) AND vaccination_date = ?
                """,
                (clean_id, payload["vaccine_name"].strip(), payload["vaccination_date"]),
            ).fetchone()
            if dup:
                return False, "Duplicate vaccination record for this pet, vaccine, and date."

            conn.execute(
                """
                INSERT INTO vaccinations (
                    pet_id, vaccine_name, vaccination_date, next_due_date,
                    veterinarian_name, notes, is_sample
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    clean_id,
                    payload["vaccine_name"].strip(),
                    payload["vaccination_date"],
                    payload["next_due_date"],
                    payload["veterinarian_name"].strip(),
                    payload.get("notes", "").strip(),
                    int(payload.get("is_sample", 0)),
                ),
            )
            conn.commit()
        return True, f"Logged {payload['vaccine_name']} vaccination for {clean_id}."
    except sqlite3.Error as exc:
        return False, f"Database error: {exc}"


def update_vaccination(vaccination_id: int, payload: Dict[str, Any]) -> Tuple[bool, str]:
    """Update an existing vaccination record."""
    try:
        with get_connection() as conn:
            conn.execute(
                """
                UPDATE vaccinations SET
                    pet_id = ?, vaccine_name = ?, vaccination_date = ?,
                    next_due_date = ?, veterinarian_name = ?, notes = ?
                WHERE vaccination_id = ?
                """,
                (
                    payload["pet_id"].strip().upper(),
                    payload["vaccine_name"].strip(),
                    payload["vaccination_date"],
                    payload["next_due_date"],
                    payload["veterinarian_name"].strip(),
                    payload.get("notes", "").strip(),
                    vaccination_id,
                ),
            )
            conn.commit()
        return True, f"Updated vaccination record #{vaccination_id}."
    except sqlite3.Error as exc:
        return False, f"Database error: {exc}"


def delete_vaccination(vaccination_id: int) -> Tuple[bool, str]:
    """Delete a vaccination record by primary key."""
    try:
        with get_connection() as conn:
            conn.execute(
                "DELETE FROM vaccinations WHERE vaccination_id = ?", (vaccination_id,)
            )
            conn.commit()
        return True, f"Deleted vaccination record #{vaccination_id}."
    except sqlite3.Error as exc:
        return False, f"Database error: {exc}"


def get_vaccinations_df() -> pd.DataFrame:
    """Return joined vaccination records with dynamic status columns."""
    with get_connection() as conn:
        df = pd.read_sql_query(
            """
            SELECT v.vaccination_id, v.pet_id, p.pet_name, p.species, p.breed,
                   p.owner_name, p.owner_phone, v.vaccine_name, v.vaccination_date,
                   v.next_due_date, v.veterinarian_name, v.notes, v.is_sample
            FROM vaccinations v
            INNER JOIN pets p ON p.pet_id = v.pet_id
            ORDER BY v.vaccination_date DESC, v.vaccination_id DESC
            """,
            conn,
        )

    if df.empty:
        df["status"] = []
        df["days_until_due"] = []
        df["due_within_7_days"] = []
        return df

    df = df.drop_duplicates(subset=["vaccination_id"]).copy()
    today = date.today()
    computed = df["next_due_date"].apply(lambda d: compute_status(d, today))
    df["status"] = [c[0] for c in computed]
    df["days_until_due"] = [c[1] for c in computed]
    df["due_within_7_days"] = [c[2] for c in computed]
    return df
