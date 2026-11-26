import { jsPDF } from 'jspdf';
import type { PetReportData } from '../types/clinic.ts';

export function downloadPetVaccinationPdf(report: PetReportData): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 44;
  let y = 52;

  // Clinic Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('Pawsitive Care Veterinary Clinic', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(13, 148, 136);
  doc.text('Official Pet Vaccination & Immunization Report', margin, y + 16);

  doc.setTextColor(100, 116, 139);
  doc.text(`Issued: ${new Date().toISOString().slice(0, 10)}`, 440, y);

  y += 32;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, 550, y);
  y += 22;

  // Patient & Owner Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`${report.pet.pet_name} (${report.pet.pet_id})`, margin, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Species: ${report.pet.species}   |   Breed: ${report.pet.breed}   |   Gender: ${report.pet.gender}   |   DOB: ${report.pet.date_of_birth}`,
    margin,
    y
  );
  y += 16;
  const weightTxt = report.pet.weight ? `${report.pet.weight} kg` : 'Not recorded';
  doc.text(
    `Owner: ${report.pet.owner_name}   |   Phone: ${report.pet.owner_phone}   |   Weight: ${weightTxt}`,
    margin,
    y
  );

  y += 24;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, 550, y);
  y += 20;

  // Table Headers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('VACCINE', margin, y);
  doc.text('ADMINISTERED', margin + 120, y);
  doc.text('NEXT DUE', margin + 210, y);
  doc.text('STATUS', margin + 295, y);
  doc.text('VETERINARIAN', margin + 375, y);
  y += 8;
  doc.line(margin, y, 550, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);

  if (report.vaccinations.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.text('No vaccinations recorded yet.', margin, y);
  } else {
    for (const v of report.vaccinations) {
      if (y > 740) {
        doc.addPage();
        y = 52;
      }
      doc.setTextColor(15, 23, 42);
      doc.text(v.vaccine_name.slice(0, 20), margin, y);
      doc.text(v.vaccination_date, margin + 120, y);
      doc.text(v.next_due_date, margin + 210, y);
      doc.text(v.status, margin + 295, y);
      doc.text(v.veterinarian_name.slice(0, 26), margin + 375, y);
      y += 14;

      if (v.notes) {
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Notes: ${v.notes.slice(0, 92)}`, margin + 8, y);
        doc.setFontSize(9.5);
        y += 14;
      }
      y += 4;
    }
  }

  const safeName = report.pet.pet_name.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Pawsitive_Care_${safeName}_${report.pet.pet_id}_Report.pdf`);
}
