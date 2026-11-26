"""
sample_data.py — Demonstration dataset seeder for Pawsitive Care Veterinary Clinic.
Populates 24 synthetic pets (dogs, cats, rabbits) and 60+ multi-month/multi-year
vaccination records clearly labeled as sample demonstration data.
"""

from __future__ import annotations

from datetime import date, timedelta

from database import get_connection


def _offset(days: int) -> str:
    return (date.today() + timedelta(days=days)).strftime("%Y-%m-%d")


def _clamp_past(candidate: str) -> str:
    today_str = date.today().strftime("%Y-%m-%d")
    return today_str if candidate > today_str else candidate


def seed_sample_data_if_empty() -> None:
    """Seed demonstration pets and vaccination records when database is empty."""
    with get_connection() as conn:
        count = conn.execute("SELECT COUNT(*) FROM pets").fetchone()[0]
        if count > 0:
            return

        y_now = date.today().year
        y_prev1 = y_now - 1
        y_prev2 = y_now - 2

        pets = [
            ("PET-1001", "Bella", "Dog", "Golden Retriever", 4.5, "Female", f"{y_now-4}-05-14", "Jordan Avery (Demo)", "(555) 010-1001", "jordan.avery@demo.clinic.test"),
            ("PET-1002", "Max", "Dog", "German Shepherd", 5.0, "Male", f"{y_now-5}-09-22", "Elena Rostova (Demo)", "(555) 010-1002", "elena.rostova@demo.clinic.test"),
            ("PET-1003", "Luna", "Cat", "Domestic Shorthair", 3.0, "Female", f"{y_now-3}-03-10", "Marcus Bennett (Demo)", "(555) 010-1003", "marcus.bennett@demo.clinic.test"),
            ("PET-1004", "Charlie", "Dog", "Labrador Retriever", 6.0, "Male", f"{y_now-6}-01-19", "Priya Nair (Demo)", "(555) 010-1004", "priya.nair@demo.clinic.test"),
            ("PET-1005", "Milo", "Cat", "Maine Coon", 2.5, "Male", f"{y_now-2}-04-08", "Hannah Brooks (Demo)", "(555) 010-1005", "hannah.brooks@demo.clinic.test"),
            ("PET-1006", "Clover", "Rabbit", "Holland Lop", 2.0, "Female", f"{y_now-2}-07-15", "Devon Patel (Demo)", "(555) 010-1006", "devon.patel@demo.clinic.test"),
            ("PET-1007", "Cooper", "Dog", "French Bulldog", 3.5, "Male", f"{y_now-3}-06-11", "Sofia Morales (Demo)", "(555) 010-1007", "sofia.morales@demo.clinic.test"),
            ("PET-1008", "Oliver", "Cat", "Siamese", 4.0, "Male", f"{y_now-4}-02-27", "Liam OConnor (Demo)", "(555) 010-1008", "liam.oconnor@demo.clinic.test"),
            ("PET-1009", "Daisy", "Dog", "Beagle", 5.5, "Female", f"{y_now-5}-04-03", "Nora Lindqvist (Demo)", "(555) 010-1009", "nora.lindqvist@demo.clinic.test"),
            ("PET-1010", "Thumper", "Rabbit", "Netherland Dwarf", 1.5, "Male", f"{y_now-1}-05-18", "Caleb Foster (Demo)", "(555) 010-1010", "caleb.foster@demo.clinic.test"),
            ("PET-1011", "Lucy", "Dog", "Miniature Poodle", 7.0, "Female", f"{y_now-7}-08-12", "Maya Chen (Demo)", "(555) 010-1011", "maya.chen@demo.clinic.test"),
            ("PET-1012", "Cleo", "Cat", "British Shorthair", 3.0, "Female", f"{y_now-3}-10-04", "Owen Wright (Demo)", "(555) 010-1012", "owen.wright@demo.clinic.test"),
            ("PET-1013", "Rocky", "Dog", "Boxer", 4.0, "Male", f"{y_now-4}-11-01", "Tessa Kim (Demo)", "(555) 010-1013", "tessa.kim@demo.clinic.test"),
            ("PET-1014", "Willow", "Cat", "Ragdoll", 2.0, "Female", f"{y_now-2}-02-19", "Isaac Rivera (Demo)", "(555) 010-1014", "isaac.rivera@demo.clinic.test"),
            ("PET-1015", "Biscuit", "Dog", "Pembroke Welsh Corgi", 2.5, "Male", f"{y_now-2}-06-25", "Chloe Vance (Demo)", "(555) 010-1015", "chloe.vance@demo.clinic.test"),
            ("PET-1016", "Hazel", "Rabbit", "Mini Rex", 3.0, "Female", f"{y_now-3}-01-29", "Ethan Shaw (Demo)", "(555) 010-1016", "ethan.shaw@demo.clinic.test"),
            ("PET-1017", "Sadie", "Dog", "Border Collie", 3.5, "Female", f"{y_now-3}-07-09", "Grace Alvarez (Demo)", "(555) 010-1017", "grace.alvarez@demo.clinic.test"),
            ("PET-1018", "Simba", "Cat", "Bengal", 4.5, "Male", f"{y_now-4}-03-30", "Lucas Mercer (Demo)", "(555) 010-1018", "lucas.mercer@demo.clinic.test"),
            ("PET-1019", "Ruby", "Dog", "Dachshund", 6.5, "Female", f"{y_now-6}-08-05", "Amelia Grant (Demo)", "(555) 010-1019", "amelia.grant@demo.clinic.test"),
            ("PET-1020", "Nala", "Cat", "Persian", 5.0, "Female", f"{y_now-5}-05-21", "Noah Sterling (Demo)", "(555) 010-1020", "noah.sterling@demo.clinic.test"),
            ("PET-1021", "Mochi", "Rabbit", "Lionhead", 1.5, "Female", f"{y_now-1}-06-14", "Zoe Takahashi (Demo)", "(555) 010-1021", "zoe.takahashi@demo.clinic.test"),
            ("PET-1022", "Duke", "Dog", "Australian Shepherd", 4.0, "Male", f"{y_now-4}-09-16", "Julian Cole (Demo)", "(555) 010-1022", "julian.cole@demo.clinic.test"),
            ("PET-1023", "Pepper", "Dog", "Shih Tzu", 8.0, "Female", f"{y_now-8}-02-11", "Natalie Reed (Demo)", "(555) 010-1023", "natalie.reed@demo.clinic.test"),
            ("PET-1024", "Jasper", "Cat", "Scottish Fold", 2.0, "Male", f"{y_now-2}-08-28", "Simon Hayes (Demo)", "(555) 010-1024", "simon.hayes@demo.clinic.test"),
        ]

        conn.executemany(
            """
            INSERT INTO pets (
                pet_id, pet_name, species, breed, age, gender,
                date_of_birth, owner_name, owner_phone, owner_email, is_sample
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            """,
            pets,
        )

        vaccinations = [
            # Overdue
            ("PET-1002", "Bordetella", _offset(-385), _offset(-20), "Dr. Claire Vance", "Annual kennel cough booster overdue."),
            ("PET-1004", "Leptospirosis", _offset(-378), _offset(-13), "Dr. Samuel Cho", "Outdoor trail exposure risk; priority booster."),
            ("PET-1008", "FVRCP", _offset(-372), _offset(-7), "Dr. Priya Kapoor", "Core feline booster past due date."),
            ("PET-1013", "Rabies", _offset(-395), _offset(-30), "Dr. Claire Vance", "1-year rabies tag renewal overdue."),
            ("PET-1019", "DHPP", _offset(-369), _offset(-4), "Dr. Elena Alvarez", "Routine annual distemper-parvo follow-up."),
            ("PET-1016", "RHDV2", _offset(-380), _offset(-15), "Dr. Samuel Cho", "Rabbit hemorrhagic disease booster overdue."),
            # Due Today
            ("PET-1001", "Bordetella", _offset(-365), _offset(0), "Dr. Claire Vance", "Scheduled morning appointment for oral booster."),
            ("PET-1005", "FVRCP", _offset(-365), _offset(0), "Dr. Priya Kapoor", "Due today; indoor/outdoor wellness check."),
            ("PET-1011", "Lyme", _offset(-365), _offset(0), "Dr. Elena Alvarez", "Annual tick-borne disease booster due today."),
            # Upcoming within 7 days
            ("PET-1003", "Rabies", _offset(-363), _offset(2), "Dr. Priya Kapoor", "Upcoming renewal in 2 days."),
            ("PET-1006", "RHDV2", _offset(-361), _offset(4), "Dr. Samuel Cho", "Exotics clinic slot reserved."),
            ("PET-1007", "DHPP", _offset(-360), _offset(5), "Dr. Claire Vance", "Core canine booster approaching."),
            ("PET-1012", "FeLV", _offset(-359), _offset(6), "Dr. Priya Kapoor", "Feline leukemia annual check."),
            ("PET-1022", "Canine Influenza", _offset(-362), _offset(3), "Dr. Elena Alvarez", "Boarding clearance prerequisite."),
            # Upcoming 8-30 days
            ("PET-1009", "Rabies", _offset(-350), _offset(15), "Dr. Claire Vance", "Routine annual rabies check."),
            ("PET-1010", "RHDV2", _offset(-347), _offset(18), "Dr. Samuel Cho", "Rabbit wellness & RHDV2 booster."),
            ("PET-1014", "FVRCP", _offset(-343), _offset(22), "Dr. Priya Kapoor", "Annual core feline immunization."),
            ("PET-1015", "Bordetella", _offset(-340), _offset(25), "Dr. Elena Alvarez", "Daycare immunization update."),
            ("PET-1018", "Rabies", _offset(-337), _offset(28), "Dr. Priya Kapoor", "1-year purevax rabies follow-up."),
            # Completed this month
            ("PET-1001", "Rabies", _offset(-5), _offset(360), "Dr. Claire Vance", "Administered left hind; tolerated well."),
            ("PET-1003", "FVRCP", _offset(-3), _offset(362), "Dr. Priya Kapoor", "No post-vaccine lethargy reported."),
            ("PET-1007", "Bordetella", _offset(-8), _offset(357), "Dr. Claire Vance", "Intranasal dose administered."),
            ("PET-1017", "DHPP", _offset(-2), _offset(363), "Dr. Elena Alvarez", "Routine wellness visit."),
            ("PET-1021", "RHDV2", _offset(-6), _offset(359), "Dr. Samuel Cho", "Subcutaneous dose; appetite normal."),
            ("PET-1023", "Rabies", _offset(-1), _offset(364), "Dr. Claire Vance", "Senior wellness panel clear."),
            ("PET-1024", "FVRCP", _offset(-4), _offset(361), "Dr. Priya Kapoor", "Completed on schedule."),
            # Historical current year spread
            ("PET-1001", "DHPP", _clamp_past(f"{y_now}-01-14"), f"{y_now+1}-01-14", "Dr. Claire Vance", "Winter core canine immunization."),
            ("PET-1002", "Rabies", _clamp_past(f"{y_now}-01-22"), f"{y_now+1}-01-22", "Dr. Samuel Cho", "Routine annual certificate issued."),
            ("PET-1004", "DHPP", _clamp_past(f"{y_now}-02-09"), f"{y_now+1}-02-09", "Dr. Claire Vance", "Labrador wellness checkup."),
            ("PET-1005", "FeLV", _clamp_past(f"{y_now}-02-18"), f"{y_now+1}-02-18", "Dr. Priya Kapoor", "Negative FeLV/FIV snap test."),
            ("PET-1009", "DHPP", _clamp_past(f"{y_now}-03-07"), f"{y_now+1}-03-07", "Dr. Elena Alvarez", "Spring checkup completed."),
            ("PET-1010", "RHDV2", _clamp_past(f"{y_now}-03-19"), f"{y_now+1}-03-19", "Dr. Samuel Cho", "Initial rabbit immunization series."),
            ("PET-1011", "Rabies", _clamp_past(f"{y_now}-03-27"), f"{y_now+1}-03-27", "Dr. Claire Vance", "Healthy vitals on exam."),
            ("PET-1012", "FVRCP", _clamp_past(f"{y_now}-04-06"), f"{y_now+1}-04-06", "Dr. Priya Kapoor", "Spring feline wellness."),
            ("PET-1013", "Bordetella", _clamp_past(f"{y_now}-04-17"), f"{y_now+1}-04-17", "Dr. Elena Alvarez", "Updated for training classes."),
            ("PET-1015", "DHPP", _clamp_past(f"{y_now}-05-04"), f"{y_now+1}-05-04", "Dr. Claire Vance", "Normal temperature and weight."),
            ("PET-1017", "Leptospirosis", _clamp_past(f"{y_now}-05-21"), f"{y_now+1}-05-21", "Dr. Samuel Cho", "Recommended for agility trails."),
            ("PET-1018", "FVRCP", _clamp_past(f"{y_now}-06-11"), f"{y_now+1}-06-11", "Dr. Priya Kapoor", "Summer checkup."),
            ("PET-1019", "Rabies", _clamp_past(f"{y_now}-06-24"), f"{y_now+1}-06-24", "Dr. Claire Vance", "3-year rabies series."),
            ("PET-1020", "FVRCP", _clamp_past(f"{y_now}-07-08"), f"{y_now+1}-07-08", "Dr. Priya Kapoor", "Indoor feline booster."),
            ("PET-1022", "DHPP", _clamp_past(f"{y_now}-07-19"), f"{y_now+1}-07-19", "Dr. Elena Alvarez", "Active herding breed wellness."),
            ("PET-1022", "Lyme", _clamp_past(f"{y_now}-08-05"), f"{y_now+1}-08-05", "Dr. Elena Alvarez", "Late summer tick prophylaxis."),
            ("PET-1023", "Bordetella", _clamp_past(f"{y_now}-08-22"), f"{y_now+1}-08-22", "Dr. Claire Vance", "Grooming salon requirement."),
            ("PET-1015", "Rabies", _clamp_past(f"{y_now}-09-10"), f"{y_now+1}-09-10", "Dr. Samuel Cho", "Autumn wellness exam."),
            ("PET-1024", "Rabies", _clamp_past(f"{y_now}-09-25"), f"{y_now+1}-09-25", "Dr. Priya Kapoor", "Purevax 1-year feline rabies."),
            ("PET-1014", "FeLV", _clamp_past(f"{y_now}-10-08"), f"{y_now+1}-10-08", "Dr. Priya Kapoor", "Annual booster cleared."),
            ("PET-1020", "Rabies", _clamp_past(f"{y_now}-10-19"), f"{y_now+1}-10-19", "Dr. Claire Vance", "Calm demeanor during exam."),
            # Prior year (y_prev1)
            ("PET-1001", "DHPP", f"{y_prev1}-01-12", f"{y_now}-01-12", "Dr. Claire Vance", "Prior year core canine dose."),
            ("PET-1002", "Rabies", f"{y_prev1}-02-15", f"{y_now}-02-15", "Dr. Samuel Cho", "Prior year rabies renewal."),
            ("PET-1003", "FVRCP", f"{y_prev1}-03-20", f"{y_now}-03-20", "Dr. Priya Kapoor", "Prior year feline wellness."),
            ("PET-1004", "Rabies", f"{y_prev1}-04-11", f"{y_now}-04-11", "Dr. Claire Vance", "Annual exam clear."),
            ("PET-1007", "Canine Influenza", f"{y_prev1}-05-09", f"{y_now}-05-09", "Dr. Elena Alvarez", "Bivalent flu booster."),
            ("PET-1008", "Rabies", f"{y_prev1}-06-18", f"{y_now}-06-18", "Dr. Priya Kapoor", "Prior year feline rabies."),
            ("PET-1009", "Leptospirosis", f"{y_prev1}-07-23", f"{y_now}-07-23", "Dr. Samuel Cho", "Initial 2-dose series."),
            ("PET-1011", "DHPP", f"{y_prev1}-08-14", f"{y_now}-08-14", "Dr. Claire Vance", "Routine senior check."),
            ("PET-1013", "DHPP", f"{y_prev1}-09-19", f"{y_now}-09-19", "Dr. Elena Alvarez", "Autumn canine wellness."),
            ("PET-1016", "RHDV2", f"{y_prev1}-10-05", f"{y_now}-10-05", "Dr. Samuel Cho", "Prior year rabbit immunization."),
            ("PET-1017", "Rabies", f"{y_prev1}-11-12", f"{y_now}-11-12", "Dr. Claire Vance", "Updated registration certificate."),
            ("PET-1019", "Bordetella", f"{y_prev1}-12-03", f"{y_now}-12-03", "Dr. Elena Alvarez", "Winter boarding clearance."),
            # Two years prior (y_prev2)
            ("PET-1001", "Rabies", f"{y_prev2}-03-14", f"{y_prev1}-03-14", "Dr. Claire Vance", "Baseline clinic registration dose."),
            ("PET-1002", "DHPP", f"{y_prev2}-05-10", f"{y_prev1}-05-10", "Dr. Samuel Cho", "Baseline core series."),
            ("PET-1004", "Bordetella", f"{y_prev2}-06-22", f"{y_prev1}-06-22", "Dr. Claire Vance", "Baseline kennel cough dose."),
            ("PET-1009", "Rabies", f"{y_prev2}-08-19", f"{y_prev1}-08-19", "Dr. Elena Alvarez", "Baseline rabies dose."),
            ("PET-1011", "Rabies", f"{y_prev2}-09-28", f"{y_prev1}-09-28", "Dr. Claire Vance", "Baseline senior wellness."),
            ("PET-1023", "DHPP", f"{y_prev2}-11-04", f"{y_prev1}-11-04", "Dr. Samuel Cho", "Baseline annual booster."),
        ]

        conn.executemany(
            """
            INSERT INTO vaccinations (
                pet_id, vaccine_name, vaccination_date, next_due_date,
                veterinarian_name, notes, is_sample
            ) VALUES (?, ?, ?, ?, ?, ?, 1)
            """,
            vaccinations,
        )
        conn.commit()
