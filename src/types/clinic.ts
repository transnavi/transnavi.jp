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
  verificationStatus: string;
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
