import type Database from 'better-sqlite3';
import { addDays, getTodayDateString } from './validation.ts';

interface SeedPet {
  pet_id: string;
  pet_name: string;
  species: 'Dog' | 'Cat' | 'Rabbit';
  breed: string;
  age: number;
  gender: 'Male' | 'Female';
  date_of_birth: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
}

interface SeedVaccination {
  pet_id: string;
  vaccine_name: string;
  vaccination_date: string;
  next_due_date: string;
  veterinarian_name: string;
  notes: string;
}

function clampPastDate(candidate: string, today: string): string {
  return candidate > today ? today : candidate;
}

export function seedDatabaseIfEmpty(db: Database.Database): void {
  const countRow = db.prepare('SELECT COUNT(*) AS count FROM pets').get() as { count: number };
  if (countRow.count > 0) {
    return;
  }

  const today = getTodayDateString();
  const currentYear = Number(today.slice(0, 4));
  const yPrev1 = currentYear - 1;
  const yPrev2 = currentYear - 2;

  const samplePets: SeedPet[] = [
    { pet_id: 'PET-1001', pet_name: 'Bella', species: 'Dog', breed: 'Golden Retriever', age: 4.5, gender: 'Female', date_of_birth: `${currentYear - 4}-05-14`, owner_name: 'Jordan Avery (Demo)', owner_phone: '(555) 010-1001', owner_email: 'jordan.avery@demo.clinic.test' },
    { pet_id: 'PET-1002', pet_name: 'Max', species: 'Dog', breed: 'German Shepherd', age: 5.0, gender: 'Male', date_of_birth: `${currentYear - 5}-09-22`, owner_name: 'Elena Rostova (Demo)', owner_phone: '(555) 010-1002', owner_email: 'elena.rostova@demo.clinic.test' },
    { pet_id: 'PET-1003', pet_name: 'Luna', species: 'Cat', breed: 'Domestic Shorthair', age: 3.0, gender: 'Female', date_of_birth: `${currentYear - 3}-03-10`, owner_name: 'Marcus Bennett (Demo)', owner_phone: '(555) 010-1003', owner_email: 'marcus.bennett@demo.clinic.test' },
    { pet_id: 'PET-1004', pet_name: 'Charlie', species: 'Dog', breed: 'Labrador Retriever', age: 6.0, gender: 'Male', date_of_birth: `${currentYear - 6}-01-19`, owner_name: 'Priya Nair (Demo)', owner_phone: '(555) 010-1004', owner_email: 'priya.nair@demo.clinic.test' },
    { pet_id: 'PET-1005', pet_name: 'Milo', species: 'Cat', breed: 'Maine Coon', age: 2.5, gender: 'Male', date_of_birth: `${currentYear - 2}-04-08`, owner_name: 'Hannah Brooks (Demo)', owner_phone: '(555) 010-1005', owner_email: 'hannah.brooks@demo.clinic.test' },
    { pet_id: 'PET-1006', pet_name: 'Clover', species: 'Rabbit', breed: 'Holland Lop', age: 2.0, gender: 'Female', date_of_birth: `${currentYear - 2}-07-15`, owner_name: 'Devon Patel (Demo)', owner_phone: '(555) 010-1006', owner_email: 'devon.patel@demo.clinic.test' },
    { pet_id: 'PET-1007', pet_name: 'Cooper', species: 'Dog', breed: 'French Bulldog', age: 3.5, gender: 'Male', date_of_birth: `${currentYear - 3}-06-11`, owner_name: 'Sofia Morales (Demo)', owner_phone: '(555) 010-1007', owner_email: 'sofia.morales@demo.clinic.test' },
    { pet_id: 'PET-1008', pet_name: 'Oliver', species: 'Cat', breed: 'Siamese', age: 4.0, gender: 'Male', date_of_birth: `${currentYear - 4}-02-27`, owner_name: 'Liam OConnor (Demo)', owner_phone: '(555) 010-1008', owner_email: 'liam.oconnor@demo.clinic.test' },
    { pet_id: 'PET-1009', pet_name: 'Daisy', species: 'Dog', breed: 'Beagle', age: 5.5, gender: 'Female', date_of_birth: `${currentYear - 5}-04-03`, owner_name: 'Nora Lindqvist (Demo)', owner_phone: '(555) 010-1009', owner_email: 'nora.lindqvist@demo.clinic.test' },
    { pet_id: 'PET-1010', pet_name: 'Thumper', species: 'Rabbit', breed: 'Netherland Dwarf', age: 1.5, gender: 'Male', date_of_birth: `${currentYear - 1}-05-18`, owner_name: 'Caleb Foster (Demo)', owner_phone: '(555) 010-1010', owner_email: 'caleb.foster@demo.clinic.test' },
    { pet_id: 'PET-1011', pet_name: 'Lucy', species: 'Dog', breed: 'Miniature Poodle', age: 7.0, gender: 'Female', date_of_birth: `${currentYear - 7}-08-12`, owner_name: 'Maya Chen (Demo)', owner_phone: '(555) 010-1011', owner_email: 'maya.chen@demo.clinic.test' },
    { pet_id: 'PET-1012', pet_name: 'Cleo', species: 'Cat', breed: 'British Shorthair', age: 3.0, gender: 'Female', date_of_birth: `${currentYear - 3}-10-04`, owner_name: 'Owen Wright (Demo)', owner_phone: '(555) 010-1012', owner_email: 'owen.wright@demo.clinic.test' },
    { pet_id: 'PET-1013', pet_name: 'Rocky', species: 'Dog', breed: 'Boxer', age: 4.0, gender: 'Male', date_of_birth: `${currentYear - 4}-11-01`, owner_name: 'Tessa Kim (Demo)', owner_phone: '(555) 010-1013', owner_email: 'tessa.kim@demo.clinic.test' },
    { pet_id: 'PET-1014', pet_name: 'Willow', species: 'Cat', breed: 'Ragdoll', age: 2.0, gender: 'Female', date_of_birth: `${currentYear - 2}-02-19`, owner_name: 'Isaac Rivera (Demo)', owner_phone: '(555) 010-1014', owner_email: 'isaac.rivera@demo.clinic.test' },
    { pet_id: 'PET-1015', pet_name: 'Biscuit', species: 'Dog', breed: 'Pembroke Welsh Corgi', age: 2.5, gender: 'Male', date_of_birth: `${currentYear - 2}-06-25`, owner_name: 'Chloe Vance (Demo)', owner_phone: '(555) 010-1015', owner_email: 'chloe.vance@demo.clinic.test' },
    { pet_id: 'PET-1016', pet_name: 'Hazel', species: 'Rabbit', breed: 'Mini Rex', age: 3.0, gender: 'Female', date_of_birth: `${currentYear - 3}-01-29`, owner_name: 'Ethan Shaw (Demo)', owner_phone: '(555) 010-1016', owner_email: 'ethan.shaw@demo.clinic.test' },
    { pet_id: 'PET-1017', pet_name: 'Sadie', species: 'Dog', breed: 'Border Collie', age: 3.5, gender: 'Female', date_of_birth: `${currentYear - 3}-07-09`, owner_name: 'Grace Alvarez (Demo)', owner_phone: '(555) 010-1017', owner_email: 'grace.alvarez@demo.clinic.test' },
    { pet_id: 'PET-1018', pet_name: 'Simba', species: 'Cat', breed: 'Bengal', age: 4.5, gender: 'Male', date_of_birth: `${currentYear - 4}-03-30`, owner_name: 'Lucas Mercer (Demo)', owner_phone: '(555) 010-1018', owner_email: 'lucas.mercer@demo.clinic.test' },
    { pet_id: 'PET-1019', pet_name: 'Ruby', species: 'Dog', breed: 'Dachshund', age: 6.5, gender: 'Female', date_of_birth: `${currentYear - 6}-08-05`, owner_name: 'Amelia Grant (Demo)', owner_phone: '(555) 010-1019', owner_email: 'amelia.grant@demo.clinic.test' },
    { pet_id: 'PET-1020', pet_name: 'Nala', species: 'Cat', breed: 'Persian', age: 5.0, gender: 'Female', date_of_birth: `${currentYear - 5}-05-21`, owner_name: 'Noah Sterling (Demo)', owner_phone: '(555) 010-1020', owner_email: 'noah.sterling@demo.clinic.test' },
    { pet_id: 'PET-1021', pet_name: 'Mochi', species: 'Rabbit', breed: 'Lionhead', age: 1.5, gender: 'Female', date_of_birth: `${currentYear - 1}-06-14`, owner_name: 'Zoe Takahashi (Demo)', owner_phone: '(555) 010-1021', owner_email: 'zoe.takahashi@demo.clinic.test' },
    { pet_id: 'PET-1022', pet_name: 'Duke', species: 'Dog', breed: 'Australian Shepherd', age: 4.0, gender: 'Male', date_of_birth: `${currentYear - 4}-09-16`, owner_name: 'Julian Cole (Demo)', owner_phone: '(555) 010-1022', owner_email: 'julian.cole@demo.clinic.test' },
    { pet_id: 'PET-1023', pet_name: 'Pepper', species: 'Dog', breed: 'Shih Tzu', age: 8.0, gender: 'Female', date_of_birth: `${currentYear - 8}-02-11`, owner_name: 'Natalie Reed (Demo)', owner_phone: '(555) 010-1023', owner_email: 'natalie.reed@demo.clinic.test' },
    { pet_id: 'PET-1024', pet_name: 'Jasper', species: 'Cat', breed: 'Scottish Fold', age: 2.0, gender: 'Male', date_of_birth: `${currentYear - 2}-08-28`, owner_name: 'Simon Hayes (Demo)', owner_phone: '(555) 010-1024', owner_email: 'simon.hayes@demo.clinic.test' },
  ];

  // Dynamic status records anchored to `today` so Due Today, 7-Day Upcoming, Overdue, and Completed this month always populate accurately
  const sampleVaccinations: SeedVaccination[] = [
    // --- OVERDUE (next_due_date < today) ---
    { pet_id: 'PET-1002', vaccine_name: 'Bordetella', vaccination_date: addDays(today, -385), next_due_date: addDays(today, -20), veterinarian_name: 'Dr. Claire Vance', notes: 'Annual kennel cough booster overdue; owner contacted by desk.' },
    { pet_id: 'PET-1004', vaccine_name: 'Leptospirosis', vaccination_date: addDays(today, -378), next_due_date: addDays(today, -13), veterinarian_name: 'Dr. Samuel Cho', notes: 'Outdoor trail exposure risk; priority booster.' },
    { pet_id: 'PET-1008', vaccine_name: 'FVRCP', vaccination_date: addDays(today, -372), next_due_date: addDays(today, -7), veterinarian_name: 'Dr. Priya Kapoor', notes: 'Core feline booster past due date.' },
    { pet_id: 'PET-1013', vaccine_name: 'Rabies', vaccination_date: addDays(today, -395), next_due_date: addDays(today, -30), veterinarian_name: 'Dr. Claire Vance', notes: '1-year rabies tag renewal overdue.' },
    { pet_id: 'PET-1019', vaccine_name: 'DHPP', vaccination_date: addDays(today, -369), next_due_date: addDays(today, -4), veterinarian_name: 'Dr. Elena Alvarez', notes: 'Routine annual distemper-parvo follow-up.' },
    { pet_id: 'PET-1016', vaccine_name: 'RHDV2', vaccination_date: addDays(today, -380), next_due_date: addDays(today, -15), veterinarian_name: 'Dr. Samuel Cho', notes: 'Rabbit hemorrhagic disease annual booster overdue.' },

    // --- DUE TODAY (next_due_date === today) ---
    { pet_id: 'PET-1001', vaccine_name: 'Bordetella', vaccination_date: addDays(today, -365), next_due_date: today, veterinarian_name: 'Dr. Claire Vance', notes: 'Scheduled morning appointment for annual oral booster.' },
    { pet_id: 'PET-1005', vaccine_name: 'FVRCP', vaccination_date: addDays(today, -365), next_due_date: today, veterinarian_name: 'Dr. Priya Kapoor', notes: 'Due today; indoor/outdoor wellness check.' },
    { pet_id: 'PET-1011', vaccine_name: 'Lyme', vaccination_date: addDays(today, -365), next_due_date: today, veterinarian_name: 'Dr. Elena Alvarez', notes: 'Annual tick-borne disease booster due today.' },

    // --- UPCOMING WITHIN 7 DAYS (next_due_date +2 to +6 days) ---
    { pet_id: 'PET-1003', vaccine_name: 'Rabies', vaccination_date: addDays(today, -363), next_due_date: addDays(today, 2), veterinarian_name: 'Dr. Priya Kapoor', notes: 'Upcoming renewal in 2 days.' },
    { pet_id: 'PET-1006', vaccine_name: 'RHDV2', vaccination_date: addDays(today, -361), next_due_date: addDays(today, 4), veterinarian_name: 'Dr. Samuel Cho', notes: 'Exotics clinic slot reserved.' },
    { pet_id: 'PET-1007', vaccine_name: 'DHPP', vaccination_date: addDays(today, -360), next_due_date: addDays(today, 5), veterinarian_name: 'Dr. Claire Vance', notes: 'Core canine booster approaching.' },
    { pet_id: 'PET-1012', vaccine_name: 'FeLV', vaccination_date: addDays(today, -359), next_due_date: addDays(today, 6), veterinarian_name: 'Dr. Priya Kapoor', notes: 'Feline leukemia annual check.' },
    { pet_id: 'PET-1022', vaccine_name: 'Canine Influenza', vaccination_date: addDays(today, -362), next_due_date: addDays(today, 3), veterinarian_name: 'Dr. Elena Alvarez', notes: 'Boarding clearance prerequisite.' },

    // --- UPCOMING 8–30 DAYS ---
    { pet_id: 'PET-1009', vaccine_name: 'Rabies', vaccination_date: addDays(today, -350), next_due_date: addDays(today, 15), veterinarian_name: 'Dr. Claire Vance', notes: 'Routine annual rabies check.' },
    { pet_id: 'PET-1010', vaccine_name: 'RHDV2', vaccination_date: addDays(today, -347), next_due_date: addDays(today, 18), veterinarian_name: 'Dr. Samuel Cho', notes: 'Rabbit wellness & RHDV2 booster.' },
    { pet_id: 'PET-1014', vaccine_name: 'FVRCP', vaccination_date: addDays(today, -343), next_due_date: addDays(today, 22), veterinarian_name: 'Dr. Priya Kapoor', notes: 'Annual core feline immunization.' },
    { pet_id: 'PET-1015', vaccine_name: 'Bordetella', vaccination_date: addDays(today, -340), next_due_date: addDays(today, 25), veterinarian_name: 'Dr. Elena Alvarez', notes: 'Daycare immunization update.' },
    { pet_id: 'PET-1018', vaccine_name: 'Rabies', vaccination_date: addDays(today, -337), next_due_date: addDays(today, 28), veterinarian_name: 'Dr. Priya Kapoor', notes: '1-year purevax rabies follow-up.' },

    // --- COMPLETED THIS MONTH (administered in current month, next_due_date +365 days) ---
    { pet_id: 'PET-1001', vaccine_name: 'Rabies', vaccination_date: addDays(today, -5), next_due_date: addDays(today, 360), veterinarian_name: 'Dr. Claire Vance', notes: 'Administered left hind; tolerated well.' },
    { pet_id: 'PET-1003', vaccine_name: 'FVRCP', vaccination_date: addDays(today, -3), next_due_date: addDays(today, 362), veterinarian_name: 'Dr. Priya Kapoor', notes: 'No post-vaccine lethargy reported.' },
    { pet_id: 'PET-1007', vaccine_name: 'Bordetella', vaccination_date: addDays(today, -8), next_due_date: addDays(today, 357), veterinarian_name: 'Dr. Claire Vance', notes: 'Intranasal dose administered.' },
    { pet_id: 'PET-1017', vaccine_name: 'DHPP', vaccination_date: addDays(today, -2), next_due_date: addDays(today, 363), veterinarian_name: 'Dr. Elena Alvarez', notes: 'Routine wellness visit.' },
    { pet_id: 'PET-1021', vaccine_name: 'RHDV2', vaccination_date: addDays(today, -6), next_due_date: addDays(today, 359), veterinarian_name: 'Dr. Samuel Cho', notes: 'Subcutaneous dose; appetite normal.' },
    { pet_id: 'PET-1023', vaccine_name: 'Rabies', vaccination_date: addDays(today, -1), next_due_date: addDays(today, 364), veterinarian_name: 'Dr. Claire Vance', notes: 'Senior wellness panel clear.' },
    { pet_id: 'PET-1024', vaccine_name: 'FVRCP', vaccination_date: addDays(today, -4), next_due_date: addDays(today, 361), veterinarian_name: 'Dr. Priya Kapoor', notes: 'Completed on schedule.' },

    // --- HISTORICAL MULTI-MONTH & MULTI-YEAR RECORDS (2024, 2025, 2026) ---
    // Current year monthly spread (Jan–Oct)
    { pet_id: 'PET-1001', vaccine_name: 'DHPP', vaccination_date: clampPastDate(`${currentYear}-01-14`, today), next_due_date: `${currentYear + 1}-01-14`, veterinarian_name: 'Dr. Claire Vance', notes: 'Winter core canine immunization.' },
    { pet_id: 'PET-1002', vaccine_name: 'Rabies', vaccination_date: clampPastDate(`${currentYear}-01-22`, today), next_due_date: `${currentYear + 1}-01-22`, veterinarian_name: 'Dr. Samuel Cho', notes: 'Routine annual certificate issued.' },
    { pet_id: 'PET-1004', vaccine_name: 'DHPP', vaccination_date: clampPastDate(`${currentYear}-02-09`, today), next_due_date: `${currentYear + 1}-02-09`, veterinarian_name: 'Dr. Claire Vance', notes: 'Labrador wellness checkup.' },
    { pet_id: 'PET-1005', vaccine_name: 'FeLV', vaccination_date: clampPastDate(`${currentYear}-02-18`, today), next_due_date: `${currentYear + 1}-02-18`, veterinarian_name: 'Dr. Priya Kapoor', notes: 'Negative FeLV/FIV snap test prior to dose.' },
    { pet_id: 'PET-1009', vaccine_name: 'DHPP', vaccination_date: clampPastDate(`${currentYear}-03-07`, today), next_due_date: `${currentYear + 1}-03-07`, veterinarian_name: 'Dr. Elena Alvarez', notes: 'Spring checkup completed.' },
    { pet_id: 'PET-1010', vaccine_name: 'RHDV2', vaccination_date: clampPastDate(`${currentYear}-03-19`, today), next_due_date: `${currentYear + 1}-03-19`, veterinarian_name: 'Dr. Samuel Cho', notes: 'Initial rabbit immunization series.' },
    { pet_id: 'PET-1011', vaccine_name: 'Rabies', vaccination_date: clampPastDate(`${currentYear}-03-27`, today), next_due_date: `${currentYear + 1}-03-27`, veterinarian_name: 'Dr. Claire Vance', notes: 'Healthy vitals on exam.' },
    { pet_id: 'PET-1012', vaccine_name: 'FVRCP', vaccination_date: clampPastDate(`${currentYear}-04-06`, today), next_due_date: `${currentYear + 1}-04-06`, veterinarian_name: 'Dr. Priya Kapoor', notes: 'Spring feline wellness.' },
    { pet_id: 'PET-1013', vaccine_name: 'Bordetella', vaccination_date: clampPastDate(`${currentYear}-04-17`, today), next_due_date: `${currentYear + 1}-04-17`, veterinarian_name: 'Dr. Elena Alvarez', notes: 'Updated for training classes.' },
    { pet_id: 'PET-1015', vaccine_name: 'DHPP', vaccination_date: clampPastDate(`${currentYear}-05-04`, today), next_due_date: `${currentYear + 1}-05-04`, veterinarian_name: 'Dr. Claire Vance', notes: 'Normal temperature and weight.' },
    { pet_id: 'PET-1017', vaccine_name: 'Leptospirosis', vaccination_date: clampPastDate(`${currentYear}-05-21`, today), next_due_date: `${currentYear + 1}-05-21`, veterinarian_name: 'Dr. Samuel Cho', notes: 'Recommended for agility trails.' },
    { pet_id: 'PET-1018', vaccine_name: 'FVRCP', vaccination_date: clampPastDate(`${currentYear}-06-11`, today), next_due_date: `${currentYear + 1}-06-11`, veterinarian_name: 'Dr. Priya Kapoor', notes: 'Summer checkup.' },
    { pet_id: 'PET-1019', vaccine_name: 'Rabies', vaccination_date: clampPastDate(`${currentYear}-06-24`, today), next_due_date: `${currentYear + 1}-06-24`, veterinarian_name: 'Dr. Claire Vance', notes: '3-year rabies series.' },
    { pet_id: 'PET-1020', vaccine_name: 'FVRCP', vaccination_date: clampPastDate(`${currentYear}-07-08`, today), next_due_date: `${currentYear + 1}-07-08`, veterinarian_name: 'Dr. Priya Kapoor', notes: 'Indoor feline booster.' },
    { pet_id: 'PET-1022', vaccine_name: 'DHPP', vaccination_date: clampPastDate(`${currentYear}-07-19`, today), next_due_date: `${currentYear + 1}-07-19`, veterinarian_name: 'Dr. Elena Alvarez', notes: 'Active herding breed wellness.' },
    { pet_id: 'PET-1022', vaccine_name: 'Lyme', vaccination_date: clampPastDate(`${currentYear}-08-05`, today), next_due_date: `${currentYear + 1}-08-05`, veterinarian_name: 'Dr. Elena Alvarez', notes: 'Late summer tick prophylaxis.' },
    { pet_id: 'PET-1023', vaccine_name: 'Bordetella', vaccination_date: clampPastDate(`${currentYear}-08-22`, today), next_due_date: `${currentYear + 1}-08-22`, veterinarian_name: 'Dr. Claire Vance', notes: 'Grooming salon requirement.' },
    { pet_id: 'PET-1015', vaccine_name: 'Rabies', vaccination_date: clampPastDate(`${currentYear}-09-10`, today), next_due_date: `${currentYear + 1}-09-10`, veterinarian_name: 'Dr. Samuel Cho', notes: 'Autumn wellness exam.' },
    { pet_id: 'PET-1024', vaccine_name: 'Rabies', vaccination_date: clampPastDate(`${currentYear}-09-25`, today), next_due_date: `${currentYear + 1}-09-25`, veterinarian_name: 'Dr. Priya Kapoor', notes: 'Purevax 1-year feline rabies.' },
    { pet_id: 'PET-1014', vaccine_name: 'FeLV', vaccination_date: clampPastDate(`${currentYear}-10-08`, today), next_due_date: `${currentYear + 1}-10-08`, veterinarian_name: 'Dr. Priya Kapoor', notes: 'Annual booster cleared.' },
    { pet_id: 'PET-1020', vaccine_name: 'Rabies', vaccination_date: clampPastDate(`${currentYear}-10-19`, today), next_due_date: `${currentYear + 1}-10-19`, veterinarian_name: 'Dr. Claire Vance', notes: 'Calm demeanor during exam.' },

    // Previous year (yPrev1)
    { pet_id: 'PET-1001', vaccine_name: 'DHPP', vaccination_date: `${yPrev1}-01-12`, next_due_date: `${currentYear}-01-12`, veterinarian_name: 'Dr. Claire Vance', notes: 'Prior year core canine dose.' },
    { pet_id: 'PET-1002', vaccine_name: 'Rabies', vaccination_date: `${yPrev1}-02-15`, next_due_date: `${currentYear}-02-15`, veterinarian_name: 'Dr. Samuel Cho', notes: 'Prior year rabies renewal.' },
    { pet_id: 'PET-1003', vaccine_name: 'FVRCP', vaccination_date: `${yPrev1}-03-20`, next_due_date: `${currentYear}-03-20`, veterinarian_name: 'Dr. Priya Kapoor', notes: 'Prior year feline wellness.' },
    { pet_id: 'PET-1004', vaccine_name: 'Rabies', vaccination_date: `${yPrev1}-04-11`, next_due_date: `${currentYear}-04-11`, veterinarian_name: 'Dr. Claire Vance', notes: 'Annual exam clear.' },
    { pet_id: 'PET-1007', vaccine_name: 'Canine Influenza', vaccination_date: `${yPrev1}-05-09`, next_due_date: `${currentYear}-05-09`, veterinarian_name: 'Dr. Elena Alvarez', notes: 'Bivalent flu booster.' },
    { pet_id: 'PET-1008', vaccine_name: 'Rabies', vaccination_date: `${yPrev1}-06-18`, next_due_date: `${currentYear}-06-18`, veterinarian_name: 'Dr. Priya Kapoor', notes: 'Prior year feline rabies.' },
    { pet_id: 'PET-1009', vaccine_name: 'Leptospirosis', vaccination_date: `${yPrev1}-07-23`, next_due_date: `${currentYear}-07-23`, veterinarian_name: 'Dr. Samuel Cho', notes: 'Completed initial 2-dose series.' },
    { pet_id: 'PET-1011', vaccine_name: 'DHPP', vaccination_date: `${yPrev1}-08-14`, next_due_date: `${currentYear}-08-14`, veterinarian_name: 'Dr. Claire Vance', notes: 'Routine senior check.' },
    { pet_id: 'PET-1013', vaccine_name: 'DHPP', vaccination_date: `${yPrev1}-09-19`, next_due_date: `${currentYear}-09-19`, veterinarian_name: 'Dr. Elena Alvarez', notes: 'Autumn canine wellness.' },
    { pet_id: 'PET-1016', vaccine_name: 'RHDV2', vaccination_date: `${yPrev1}-10-05`, next_due_date: `${currentYear}-10-05`, veterinarian_name: 'Dr. Samuel Cho', notes: 'Prior year rabbit immunization.' },
    { pet_id: 'PET-1017', vaccine_name: 'Rabies', vaccination_date: `${yPrev1}-11-12`, next_due_date: `${currentYear}-11-12`, veterinarian_name: 'Dr. Claire Vance', notes: 'Updated registration certificate.' },
    { pet_id: 'PET-1019', vaccine_name: 'Bordetella', vaccination_date: `${yPrev1}-12-03`, next_due_date: `${currentYear}-12-03`, veterinarian_name: 'Dr. Elena Alvarez', notes: 'Winter boarding clearance.' },

    // Two years prior (yPrev2)
    { pet_id: 'PET-1001', vaccine_name: 'Rabies', vaccination_date: `${yPrev2}-03-14`, next_due_date: `${yPrev1}-03-14`, veterinarian_name: 'Dr. Claire Vance', notes: 'Baseline clinic registration dose.' },
    { pet_id: 'PET-1002', vaccine_name: 'DHPP', vaccination_date: `${yPrev2}-05-10`, next_due_date: `${yPrev1}-05-10`, veterinarian_name: 'Dr. Samuel Cho', notes: 'Baseline core series.' },
    { pet_id: 'PET-1004', vaccine_name: 'Bordetella', vaccination_date: `${yPrev2}-06-22`, next_due_date: `${yPrev1}-06-22`, veterinarian_name: 'Dr. Claire Vance', notes: 'Baseline kennel cough dose.' },
    { pet_id: 'PET-1009', vaccine_name: 'Rabies', vaccination_date: `${yPrev2}-08-19`, next_due_date: `${yPrev1}-08-19`, veterinarian_name: 'Dr. Elena Alvarez', notes: 'Baseline rabies dose.' },
    { pet_id: 'PET-1011', vaccine_name: 'Rabies', vaccination_date: `${yPrev2}-09-28`, next_due_date: `${yPrev1}-09-28`, veterinarian_name: 'Dr. Claire Vance', notes: 'Baseline senior wellness.' },
    { pet_id: 'PET-1023', vaccine_name: 'DHPP', vaccination_date: `${yPrev2}-11-04`, next_due_date: `${yPrev1}-11-04`, veterinarian_name: 'Dr. Samuel Cho', notes: 'Baseline annual booster.' },
  ];

  const insertPet = db.prepare(`
    INSERT INTO pets (
      pet_id, pet_name, species, breed, age, gender, date_of_birth,
      owner_name, owner_phone, owner_email, is_sample
    ) VALUES (
      @pet_id, @pet_name, @species, @breed, @age, @gender, @date_of_birth,
      @owner_name, @owner_phone, @owner_email, 1
    )
  `);

  const insertVaccination = db.prepare(`
    INSERT INTO vaccinations (
      pet_id, vaccine_name, vaccination_date, next_due_date,
      veterinarian_name, notes, is_sample
    ) VALUES (
      @pet_id, @vaccine_name, @vaccination_date, @next_due_date,
      @veterinarian_name, @notes, 1
    )
  `);

  const seedTransaction = db.transaction(() => {
    for (const pet of samplePets) {
      insertPet.run(pet);
    }
    for (const vax of sampleVaccinations) {
      insertVaccination.run(vax);
    }
  });

  seedTransaction();
}
