/**
 * Utilitaires de semaine pour le planning — purs, importables côté client ET serveur.
 *
 * Tout est en **heure locale** : une date de planning est un jour civil (« lundi 11 »),
 * pas un instant. On manipule des chaînes 'YYYY-MM-DD' construites depuis les composantes
 * locales (jamais `toISOString`, qui bascule en UTC et peut décaler d'un jour). Le format
 * étant à largeur fixe, les comparaisons chronologiques se font par comparaison de chaînes.
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * 'YYYY-MM-DD' local d'un objet Date.
 * @param {Date} date
 */
export function toISO(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Objet Date à minuit local depuis 'YYYY-MM-DD'. Renvoie null si invalide.
 * @param {string} iso
 */
export function parseISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Vrai si `iso` est une date 'YYYY-MM-DD' valide. */
export function isValidISO(iso) {
  return parseISO(iso) !== null;
}

/** 'YYYY-MM-DD' d'aujourd'hui (local). */
export function todayISO() {
  return toISO(new Date());
}

/**
 * Décale une date ISO de `n` jours (n peut être négatif).
 * @param {string} iso
 * @param {number} n
 */
export function dayOffset(iso, n) {
  const d = parseISO(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/**
 * Lundi de la semaine contenant `date` (ou aujourd'hui), en 'YYYY-MM-DD'.
 * @param {Date} [date]
 */
export function mondayOf(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay() : 0=dimanche … 6=samedi. Indice lundi-first : (getDay()+6)%7 → 0 pour lundi.
  const mondayFirst = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayFirst);
  return toISO(d);
}

/**
 * Décale un lundi de `n` semaines.
 * @param {string} weekStart
 * @param {number} n
 */
export function addWeeks(weekStart, n) {
  return dayOffset(weekStart, n * 7);
}

/**
 * Date ISO d'un jour de la semaine.
 * @param {string} weekStart lundi 'YYYY-MM-DD'
 * @param {number} dayOfWeek 0=lundi … 6=dimanche
 */
export function dateOfDay(weekStart, dayOfWeek) {
  return dayOffset(weekStart, dayOfWeek);
}

/**
 * Vrai si le jour (weekStart + dayOfWeek) est strictement antérieur à aujourd'hui.
 * @param {string} weekStart
 * @param {number} dayOfWeek
 */
export function isPastDay(weekStart, dayOfWeek) {
  return dateOfDay(weekStart, dayOfWeek) < todayISO();
}

/**
 * Les 7 jours d'une semaine, du lundi au dimanche.
 * @param {string} weekStart lundi 'YYYY-MM-DD'
 * @returns {{ dayOfWeek: number, dateISO: string, isToday: boolean, isPast: boolean }[]}
 */
export function weekDays(weekStart) {
  const today = todayISO();
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const dateISO = dateOfDay(weekStart, dayOfWeek);
    return {
      dayOfWeek,
      dateISO,
      isToday: dateISO === today,
      isPast: dateISO < today
    };
  });
}
