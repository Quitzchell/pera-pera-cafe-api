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
    [days('2026-10-26', '2026-10-27'), '2026-10-29', 0],
    [days('2026-10-25', '2026-10-27', '2026-10-28', '2026-10-29'), '2026-10-29', 3],
    [days('2026-02-28', '2026-03-01'), '2026-03-01', 2],
    [days('2025-12-31', '2026-01-01'), '2026-01-01', 2],
  ])('%o on %s → %i', (roundDays, today, streak) => {
    expect(currentStreak(roundDays, today)).toBe(streak)
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
