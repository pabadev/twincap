/**
 * R14-Fase O — Identidad legal centralizada (single source of truth, language-neutral).
 *
 * Valores reales del fundador (dirección, ciudad/país, correo de contacto).
 * RAZÓN SOCIAL y NIT quedan como placeholders literales hasta el registro
 * mercantil en Cámara de Comercio (decisión R14-O, beta controlada).
 * Revisar con abogado antes de abrir al público.
 *
 * CONTACT_EMAIL: paba.online@gmail.com (elegido sobre fjpaba1989@gmail.com;
 * cambiar aquí y se propaga a ambos idiomas).
 */
export const LEGAL_IDENTITY = {
  /** Placeholder pendiente de registro mercantil — NO es un dato real */
  companyName: "[RAZÓN SOCIAL]",
  /** Placeholder pendiente de registro mercantil — NO es un dato real */
  taxId: "[NIT]",
  /** Dato real (fundador) */
  address: "Calle 4 # 3 - 57 Barrio centro",
  /** Dato real (fundador) */
  cityCountry: "San Sebastián de Buenavista, Colombia",
  /** Dato real (fundador) — cambiar aquí para propagar a ambos idiomas */
  contactEmail: "paba.online@gmail.com",
} as const;
