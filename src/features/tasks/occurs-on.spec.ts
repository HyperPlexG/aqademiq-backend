import { occursOn, parseOccurrenceId, occurrenceId, ymd, dayDiff } from './occurs-on';

/**
 * §4.2 engine unit tests. Run with `npm test` once jest + ts-jest are installed
 * (devDeps not yet present). The same assertions are mirrored in a dependency-
 * free harness used during development.
 */

const series = (repeat_kind: string, anchor_date: string, repeat_interval = 1, until_date: string | null = null) =>
  ({ repeat_kind, anchor_date, repeat_interval, until_date });

describe('occursOn — §4.2', () => {
  describe('none', () => {
    const s = series('none', '2026-06-15');
    it('matches the anchor day only', () => {
      expect(occursOn(s, '2026-06-15')).toBe(true);
      expect(occursOn(s, '2026-06-16')).toBe(false);
      expect(occursOn(s, '2026-06-14')).toBe(false);
    });
  });

  describe('daily', () => {
    const s = series('daily', '2026-06-15');
    it('every day on/after anchor, never before', () => {
      expect(occursOn(s, '2026-06-15')).toBe(true);
      expect(occursOn(s, '2026-06-16')).toBe(true);
      expect(occursOn(s, '2026-12-31')).toBe(true);
      expect(occursOn(s, '2026-06-14')).toBe(false);
    });
  });

  describe('weekdays', () => {
    const s = series('weekdays', '2026-06-15'); // Mon
    it('Mon–Fri only', () => {
      expect(occursOn(s, '2026-06-15')).toBe(true); // Mon
      expect(occursOn(s, '2026-06-19')).toBe(true); // Fri
      expect(occursOn(s, '2026-06-20')).toBe(false); // Sat
      expect(occursOn(s, '2026-06-21')).toBe(false); // Sun
    });
  });

  describe('weekly', () => {
    const s = series('weekly', '2026-06-15'); // Mon
    it('same weekday as anchor', () => {
      expect(occursOn(s, '2026-06-22')).toBe(true); // +7
      expect(occursOn(s, '2026-06-29')).toBe(true); // +14
      expect(occursOn(s, '2026-06-16')).toBe(false);
      expect(occursOn(s, '2026-06-21')).toBe(false);
    });
  });

  describe('monthly (clamp to last day)', () => {
    it('same day-of-month', () => {
      const s = series('monthly', '2026-01-15');
      expect(occursOn(s, '2026-02-15')).toBe(true);
      expect(occursOn(s, '2026-03-15')).toBe(true);
      expect(occursOn(s, '2026-02-14')).toBe(false);
    });
    it('31st clamps to month end (Feb 28, Apr 30)', () => {
      const s = series('monthly', '2026-01-31');
      expect(occursOn(s, '2026-02-28')).toBe(true); // clamped (2026 not leap)
      expect(occursOn(s, '2026-02-27')).toBe(false);
      expect(occursOn(s, '2026-04-30')).toBe(true); // clamped
      expect(occursOn(s, '2026-03-31')).toBe(true); // exact
    });
    it('29th clamps to Feb 29 in a leap year', () => {
      const s = series('monthly', '2024-01-29');
      expect(occursOn(s, '2024-02-29')).toBe(true);
    });
  });

  describe('everyNDays', () => {
    const s = series('everyNDays', '2026-06-15', 3);
    it('diff % N == 0', () => {
      expect(occursOn(s, '2026-06-15')).toBe(true);
      expect(occursOn(s, '2026-06-18')).toBe(true);
      expect(occursOn(s, '2026-06-21')).toBe(true);
      expect(occursOn(s, '2026-06-16')).toBe(false);
      expect(occursOn(s, '2026-06-17')).toBe(false);
    });
  });

  describe('everyNWeeks', () => {
    const s = series('everyNWeeks', '2026-06-15', 2); // every 14 days
    it('diff % (7N) == 0', () => {
      expect(occursOn(s, '2026-06-29')).toBe(true); // +14
      expect(occursOn(s, '2026-07-13')).toBe(true); // +28
      expect(occursOn(s, '2026-06-22')).toBe(false); // +7
    });
  });

  describe('everyNMonths', () => {
    const s = series('everyNMonths', '2026-01-15', 3); // quarterly
    it('monthDiff % N == 0 AND same DoM', () => {
      expect(occursOn(s, '2026-04-15')).toBe(true); // +3 months
      expect(occursOn(s, '2026-07-15')).toBe(true); // +6 months
      expect(occursOn(s, '2026-02-15')).toBe(false); // +1 month
      expect(occursOn(s, '2026-04-16')).toBe(false); // wrong DoM
    });
  });

  describe('until_date bound', () => {
    const s = series('daily', '2026-06-15', 1, '2026-06-20');
    it('stops after until_date', () => {
      expect(occursOn(s, '2026-06-20')).toBe(true);
      expect(occursOn(s, '2026-06-21')).toBe(false);
    });
  });

  describe('DST safety (UTC day precision)', () => {
    it('counts whole days across a spring-forward boundary', () => {
      // EU DST 2026-03-29; everyNDays must not skew by the lost hour.
      const s = series('everyNDays', '2026-03-27', 2);
      expect(occursOn(s, '2026-03-29')).toBe(true); // +2 days
      expect(occursOn(s, '2026-03-31')).toBe(true); // +4 days
      expect(occursOn(s, '2026-03-30')).toBe(false);
    });
  });
});

describe('occurrence id helpers', () => {
  it('round-trips {series}@{yyyy-MM-dd}', () => {
    const id = occurrenceId('abc-123', '2026-06-15');
    expect(id).toBe('abc-123@2026-06-15');
    expect(parseOccurrenceId(id)).toEqual({ seriesId: 'abc-123', date: '2026-06-15' });
  });
  it('tolerates uuid series ids and rejects malformed ids', () => {
    const uuid = '238e70d3-3b30-4305-9a72-275f119379d5';
    expect(parseOccurrenceId(`${uuid}@2026-06-15`)).toEqual({ seriesId: uuid, date: '2026-06-15' });
    expect(parseOccurrenceId('no-date-here')).toBeNull();
    expect(parseOccurrenceId('s@2026-6-5')).toBeNull();
  });
  it('ymd/dayDiff at UTC precision', () => {
    expect(ymd('2026-06-15T23:30:00')).toBe('2026-06-15');
    expect(dayDiff('2026-06-15', '2026-06-18')).toBe(3);
  });
});

// ---- 2026-07-18 regression coverage: DB-row adapter + null-anchor guard ----
import { taskRowToSeries } from './occurs-on';

describe('taskRowToSeries — DB row adapter', () => {
  it('parses a JSON repeat_rule string', () => {
    const s = taskRowToSeries({
      due_at: '2026-06-15',
      repeat_rule: JSON.stringify({ repeat_kind: 'weekly', repeat_interval: 2, until_date: '2026-08-01' }),
    });
    expect(s.repeat_kind).toBe('weekly');
    expect(s.repeat_interval).toBe(2);
    expect(s.until_date).toBe('2026-08-01');
    expect(occursOn(s, '2026-06-15')).toBe(true);
  });

  it('degrades corrupt repeat_rule JSON to a one-off, never throws', () => {
    const s = taskRowToSeries({ due_at: '2026-06-15', repeat_rule: '{not json' });
    expect(s.repeat_kind).toBe('none');
    expect(occursOn(s, '2026-06-15')).toBe(true);
    expect(occursOn(s, '2026-06-16')).toBe(false);
  });

  it('falls back due_at → scheduled_start_at → created_at for the anchor', () => {
    expect(taskRowToSeries({ scheduled_start_at: '2026-06-20' }).anchor_date).toBe('2026-06-20');
    expect(taskRowToSeries({ created_at: '2026-06-01' }).anchor_date).toBe('2026-06-01');
  });

  it('row with no dates at all yields a series that never occurs (the /v1/subjects 500 regression)', () => {
    const s = taskRowToSeries({ repeat_rule: null });
    expect(s.anchor_date).toBeNull();
    expect(occursOn(s, '2026-06-15')).toBe(false); // must not throw
  });
});

describe('occursOn — null anchor guard', () => {
  it('returns false instead of throwing on a null anchor', () => {
    expect(occursOn({ anchor_date: null, repeat_kind: 'daily', repeat_interval: 1 }, '2026-06-15')).toBe(false);
  });
});
