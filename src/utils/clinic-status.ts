import type { Clinic } from '../types/clinic';

// A facility that has closed stays in the data as a record of where it was and
// that it is gone, so someone looking for it learns it has closed. It is left
// out of every list of places to go.
export const isClosed = (clinic: Clinic): boolean => Boolean(clinic.closed);

export const activeClinics = (clinics: Clinic[]): Clinic[] => clinics.filter((clinic) => !isClosed(clinic));

export const closedClinics = (clinics: Clinic[]): Clinic[] => clinics.filter(isClosed);

/** 「2026年9月30日」「2024年6月」「2021年」 from the precision the date is recorded in. */
export function closedDateLabel(clinic: Clinic): string {
  const [year, month, day] = (clinic.closed?.date ?? '').split('-').map(Number);
  if (!year) return '';
  return `${year}年${month ? `${month}月` : ''}${month && day ? `${day}日` : ''}`;
}

/** 「2026年9月30日に閉院」, or 「閉院」 when the date is not known. */
export function closedLabel(clinic: Clinic): string {
  const date = closedDateLabel(clinic);
  return date ? `${date}に閉院` : '閉院';
}
