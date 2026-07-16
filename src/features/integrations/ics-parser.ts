/**
 * Minimal, dependency-free iCalendar (RFC 5545) VEVENT parser.
 *
 * Handles the cases student calendars actually emit: folded lines, UID/SUMMARY/
 * DESCRIPTION/LOCATION, and DTSTART/DTEND in date (`YYYYMMDD`), UTC
 * (`YYYYMMDDTHHMMSSZ`) and floating/`TZID` (`YYYYMMDDTHHMMSS`) forms. Floating
 * and TZID times are treated as UTC (best-effort) — good enough for import;
 * full VTIMEZONE resolution is intentionally out of scope.
 */
export interface IcsEvent {
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date | null;
  allDay: boolean;
}

export function parseIcs(raw: string): IcsEvent[] {
  // Unfold: a CRLF (or LF) followed by a space or tab continues the prior line.
  const unfolded = raw.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events: IcsEvent[] = [];
  let cur: Record<string, { value: string; params: Record<string, string> }> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (trimmed === 'END:VEVENT') {
      if (cur) {
        const ev = buildEvent(cur);
        if (ev) events.push(ev);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;

    const colon = trimmed.indexOf(':');
    if (colon <= 0) continue;
    const namePart = trimmed.slice(0, colon);
    const value = trimmed.slice(colon + 1);
    const [name, ...paramParts] = namePart.split(';');
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const eq = p.indexOf('=');
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
    }
    cur[name.toUpperCase()] = { value, params };
  }

  return events;
}

function buildEvent(fields: Record<string, { value: string; params: Record<string, string> }>): IcsEvent | null {
  const dtstart = fields['DTSTART'];
  if (!dtstart) return null;
  const start = parseIcsDate(dtstart.value);
  if (!start) return null;

  const allDay = /^\d{8}$/.test(dtstart.value) || dtstart.params['VALUE'] === 'DATE';
  const end = fields['DTEND'] ? parseIcsDate(fields['DTEND'].value) : null;

  return {
    uid: fields['UID']?.value?.trim() || `${dtstart.value}-${fields['SUMMARY']?.value ?? ''}`.slice(0, 500),
    title: unescapeText(fields['SUMMARY']?.value ?? '(untitled)').slice(0, 500),
    description: fields['DESCRIPTION'] ? unescapeText(fields['DESCRIPTION'].value) : null,
    location: fields['LOCATION'] ? unescapeText(fields['LOCATION'].value) : null,
    start,
    end,
    allDay,
  };
}

function parseIcsDate(value: string): Date | null {
  const v = value.trim();
  // Date only: YYYYMMDD
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  // Date-time (UTC 'Z' or floating): YYYYMMDDTHHMMSS[Z]
  m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(v);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function unescapeText(s: string): string {
  return s
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}
