/**
 * Helpers to organize rooms by year (creation year) and by subject
 * (derived from the room title, e.g. "Anamnese - Turma A" -> "Anamnese").
 */

export function getRoomYear(createdAt: string | null | undefined): string {
  if (!createdAt) return "Sem data";
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return "Sem data";
  return String(d.getFullYear());
}

const STOP_SUFFIX = /\s*\((c[óo]pia|copy)[^)]*\)\s*$/i;

/**
 * Extracts the "subject" of a room from its title:
 * strips copy markers, takes the segment before separators (-, –, |, :),
 * removes trailing turma/numbers/dates.
 */
export function getRoomSubject(title: string): string {
  let t = (title || "").trim();
  t = t.replace(STOP_SUFFIX, "").trim();
  const parts = t.split(/\s+[-–—|:/]\s+|[|:]/);
  let subject = (parts[0] || t).trim();
  // remove trailing "turma X", numbers, years
  subject = subject
    .replace(/\s+(turma|grupo|classe)\s*\w*$/i, "")
    .replace(/\s+\d{1,4}([./-]\d{1,4})*$/g, "")
    .trim();
  if (!subject) subject = t || "Sem título";
  return subject;
}

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export interface SubjectGroup<T> {
  subject: string;
  rooms: T[];
}

export function groupBySubject<T extends { title: string }>(rooms: T[]): SubjectGroup<T>[] {
  const map = new Map<string, SubjectGroup<T>>();
  for (const room of rooms) {
    const subject = getRoomSubject(room.title);
    const key = normalize(subject);
    const existing = map.get(key);
    if (existing) existing.rooms.push(room);
    else map.set(key, { subject, rooms: [room] });
  }
  return Array.from(map.values()).sort((a, b) =>
    a.subject.localeCompare(b.subject, "pt-BR")
  );
}

export function groupByYear<T extends { created_at: string | null }>(rooms: T[]): string[] {
  const years = new Set<string>();
  for (const r of rooms) years.add(getRoomYear(r.created_at));
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}
