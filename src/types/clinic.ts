export interface ClinicReport {
  /** One reported detail, as the source puts it. */
  text: string;
  /** Who reported it: 「通院している方からのメール」, 「MtF.wiki」, an account name. */
  source: string;
  /** When it was reported: YYYY, YYYY-MM or YYYY-MM-DD. */
  date?: string;
  url?: string;
}

export interface Clinic {
  id: string;
  name: string;
  displayName: string;
  prefecture: string;
  /** Set for overseas facilities (e.g. 'タイ', '韓国'); absent/undefined means
   *  domestic (Japan). For overseas entries `prefecture` holds the country too,
   *  so the list groups them under a country heading. */
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  urls: string[];
  services: string[];
  source: {
    project: string;
    path: string;
    license: string;
  };
  /** 要確認 until the care listed is confirmed on the facility's own site; then 確認済み. */
  verificationStatus: string;
  /** The day the facility's own site was read for a 確認済み record (YYYY-MM-DD). */
  verifiedAt?: string;
  /** What patients or contributors report and the facility's own site does not say. Shown
   *  apart from the confirmed details and marked 未確認. */
  reports?: ClinicReport[];
  importedAt: string;
  notes: string;
  lat?: number;
  lng?: number;
  geoSource?: string;
  /** Present once the facility has closed. The record then keeps only its name
   *  and place: phone, links, services and notes are removed. */
  closed?: {
    /** When it closed, as precisely as the source says: YYYY, YYYY-MM or YYYY-MM-DD. */
    date?: string;
    /** Where the closure is stated. */
    source?: string;
    /** The day the closure was confirmed. */
    confirmedAt: string;
  };
}
