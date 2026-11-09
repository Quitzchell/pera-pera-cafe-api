import {
  accuracy,
  currentStreak,
  localDate,
  RuleGroupStats,
  exportRow,
  fileStamp,
  flattenMistake,
  MISTAKE_COLUMNS,
  RULE_PROGRESS_COLUMNS,
  toCsv,
  weakestFirst,
} from './progress-stats'

describe('localDate', () => {
  it.each([
    ['2026-10-29T23:30:00Z', 'UTC', '2026-10-29'],
    ['2026-10-29T23:30:00Z', 'Europe/Amsterdam', '2026-10-30'],
    ['2026-10-29T16:30:00Z', 'Asia/Tokyo', '2026-10-30'],
    ['2026-10-30T03:00:00Z', 'America/New_York', '2026-10-29'],
  ])('%s in %s is %s', (iso, timeZone, day) => {
    expect(localDate(new Date(iso), timeZone)).toBe(day)
  })
})

describe('fileStamp', () => {
  it.each([
    ['2026-10-29T23:05:00Z', 'UTC', '2026-10-29-2305'],
    ['2026-10-29T23:05:00Z', 'Europe/Amsterdam', '2026-10-30-0005'],
    ['2026-10-29T16:30:00Z', 'Asia/Tokyo', '2026-10-30-0130'],
  ])('%s in %s is %s', (iso, timeZone, stamp) => {
    expect(fileStamp(new Date(iso), timeZone)).toBe(stamp)
  })
})

describe('currentStreak', () => {
  const days = (...list: string[]) => new Set(list)

  it.each([
    [days(), '2026-10-29', 0],
    [days('2026-10-29'), '2026-10-29', 1],
    [days('2026-10-27', '2026-10-28', '2026-10-29'), '2026-10-29', 3],
    [days('2026-10-27', '2026-10-28'), '2026-10-29', 2],
    [days('2026-10-26', '2026-10-27'), '2026-10-29', 2],
    [days('2026-10-25', '2026-10-27', '2026-10-28', '2026-10-29'), '2026-10-29', 4],
    [days('2026-02-28', '2026-03-01'), '2026-03-01', 2],
    [days('2025-12-31', '2026-01-01'), '2026-01-01', 2],
    // two misses in a row are forgiven, today still open
    [days('2026-10-25'), '2026-10-28', 1],
    // a third miss in a row resets, whatever came before
    [days('2026-10-22', '2026-10-23', '2026-10-27'), '2026-10-27', 1],
    [days('2026-10-22', '2026-10-23'), '2026-10-27', 0],
  ])('%o on %s → %i', (roundDays, today, streak) => {
    expect(currentStreak(roundDays, today).streak).toBe(streak)
  })

  const october = (...dates: number[]) =>
    days(...dates.map((date) => `2026-10-${String(date).padStart(2, '0')}`))

  it('returns a skip seven days after it was spent', () => {
    expect(currentStreak(october(1, 4, 5, 6, 7, 8, 10), '2026-10-10').streak).toBe(7)
  })

  it('resets on a miss six days after the skips were spent', () => {
    expect(currentStreak(october(1, 4, 5, 6, 7, 9), '2026-10-09').streak).toBe(1)
  })

  it('still has both skips after a long absence', () => {
    expect(currentStreak(october(1, 20, 23), '2026-10-23').streak).toBe(2)
  })

  it.each([
    ['no misses', october(1, 2, 3), '2026-10-03', 2],
    ['today still open', october(1, 2), '2026-10-03', 2],
    ['one miss', october(1, 3), '2026-10-03', 1],
    ['two misses', october(1, 4), '2026-10-04', 0],
    ['six days after a miss', october(1, 3, 4, 5, 6, 7, 8), '2026-10-08', 1],
    ['seven days after a miss', october(1, 3, 4, 5, 6, 7, 8, 9), '2026-10-09', 2],
  ])('reports the skips left with %s', (_, roundDays, today, skipsLeft) => {
    expect(currentStreak(roundDays, today).streakSkipsLeft).toBe(skipsLeft)
  })

  it('reports both skips before the first round', () => {
    expect(currentStreak(days(), '2026-10-03').streakSkipsLeft).toBe(2)
  })
})

const stats = (overrides: Partial<RuleGroupStats>): RuleGroupStats => ({
  form: 'TE',
  ruleGroup: 'GODAN_KU',
  attemptCount: 4,
  correctCount: 2,
  accuracy: 0.5,
  box: 1,
  dueAt: new Date('2026-11-01T00:00:00Z'),
  lastPracticedAt: new Date('2026-10-29T10:00:00Z'),
  ...overrides,
})

describe('accuracy and ordering', () => {
  it('rounds to two decimals and handles no attempts', () => {
    expect(accuracy(2, 3)).toBe(0.67)
    expect(accuracy(0, 0)).toBe(0)
  })

  it('sorts weakest first: accuracy, then box, then most practised', () => {
    const rows = [
      stats({ ruleGroup: 'GODAN_GU', accuracy: 0.9 }),
      stats({ ruleGroup: 'GODAN_SU', accuracy: 0.5, box: 2 }),
      stats({ ruleGroup: 'GODAN_KU', accuracy: 0.5, box: 1, attemptCount: 2 }),
      stats({ ruleGroup: 'ICHIDAN', accuracy: 0.5, box: 1, attemptCount: 8 }),
    ]
    expect(rows.sort(weakestFirst).map((r) => r.ruleGroup)).toEqual([
      'ICHIDAN',
      'GODAN_KU',
      'GODAN_SU',
      'GODAN_GU',
    ])
  })
})

describe('toCsv', () => {
  it('writes a header and one line per rule group, dueAt included', () => {
    expect(toCsv(RULE_PROGRESS_COLUMNS, [exportRow(stats({}))])).toBe(
      'form,ruleGroup,attemptCount,accuracy,box,lastPracticedAt,dueAt\n' +
        'TE,GODAN_KU,4,0.5,1,2026-10-29T10:00:00.000Z,2026-11-01T00:00:00.000Z\n',
    )
    expect(toCsv(RULE_PROGRESS_COLUMNS, [])).toBe(
      'form,ruleGroup,attemptCount,accuracy,box,lastPracticedAt,dueAt\n',
    )
  })

  it.each([
    ['plain', 'plain'],
    ['書いて', '書いて'],
    ['a,b', '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ['two\nlines', '"two\nlines"'],
    ['=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
    ['+1', "'+1"],
    ['-1', "'-1"],
    ['@SUM(A1)', "'@SUM(A1)"],
  ])('writes the answer %p as %p', (answer, field) => {
    expect(toCsv(['answer'], [{ answer }])).toBe(`answer\n${field}\n`)
  })

  it('writes a mistake as one flat row, with empty cells when there is no expected form', () => {
    const mistake = {
      createdAt: new Date('2026-10-31T09:00:00Z'),
      mode: 'EXAM',
      verb: { dictionaryForm: '書く', reading: 'かく' },
      form: 'TE' as const,
      ruleGroup: 'GODAN_KU' as const,
      expected: { kanji: '書いて', kana: 'かいて' },
      answer: 'かきて',
    }
    const rows = [flattenMistake(mistake), flattenMistake({ ...mistake, expected: null })]
    expect(toCsv(MISTAKE_COLUMNS, rows)).toBe(
      'createdAt,mode,dictionaryForm,reading,form,ruleGroup,expectedKanji,expectedKana,answer\n' +
        '2026-10-31T09:00:00.000Z,EXAM,書く,かく,TE,GODAN_KU,書いて,かいて,かきて\n' +
        '2026-10-31T09:00:00.000Z,EXAM,書く,かく,TE,GODAN_KU,,,かきて\n',
    )
  })
})
