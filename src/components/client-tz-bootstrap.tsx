"use client";

import { useEffect } from "react";

const COOKIE_NAME = "CLIENT_TZ_OFFSET";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Writes the client's civil-clock offset (`Date.getTimezoneOffset()`, minutes
 * EAST of UTC: 300 for UTC-5) into a cookie that Server Components read.
 *
 * Root cause it closes (founder report 2026-09-30, fixed "for real"): the
 * dashboard's initial server render derived the current CIVIL month from the
 * server's UTC clock — at month-end evenings (e.g. 21:33 in Bogotá = 02:33
 * UTC on the NEXT day) the page rendered "Datos al 1 oct 2026" with empty
 * current-month cards, even though the client-corrected action path (A2)
 * existed. The NEXT_LOCALE cookie is the established pattern the server can
 * read before hydration; this applies it to the civil clock.
 *
 * SameSite=Lax + path=/ + 1 year; re-written on every mount so it survives
 * timezone changes and long absences. Pure bootstrap — no context, no state.
 */
export function ClientTzBootstrap() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const offset = new Date().getTimezoneOffset();
    document.cookie = `${COOKIE_NAME}=${offset};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
  }, []);
  return null;
}
