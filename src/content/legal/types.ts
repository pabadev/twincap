export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  list?: string[]; // lista con viñetas
  /** Opcional: tabla (p. ej. la de cookies propias). */
  table?: {
    caption?: string;
    headers: string[];
    rows: string[][];
  };
}

export interface LegalDocument {
  slug: string;
  title: string;
  /** Fecha de vigencia visible, p. ej. "2026-09-03". */
  updatedAt: string;
  intro?: string;
  sections: LegalSection[];
}

export interface LegalContent {
  privacy: LegalDocument;
  terms: LegalDocument;
  cookies: LegalDocument;
  dataPolicy: LegalDocument; // Política de Tratamiento de Datos (Ley 1581/2012)
}
