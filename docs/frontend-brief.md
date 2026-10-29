# Frontend brief: Pera Pera Cafe conjugation trainer

This is the contract between the backend (this repo) and the frontend (a separate repo and deployment). It is the source of truth for endpoints, payloads, errors, the session cookie and CSRF. If something here disagrees with the backend's behaviour, the backend is wrong; report it.

The app drills Japanese verb conjugation. A learner signs in, starts a round, gets prompts like "泳ぐ → te-form", types the answer and gets instant feedback with the rule. Weak rule groups come back more often (spaced repetition). There is no public sign-up: the admin invites every user.

English everywhere in the UI. Japanese appears only as learning content.

## Contents

1. [Connecting: base URL, cookie, CSRF](#1-connecting-base-url-cookie-csrf)
2. [Errors](#2-errors)
3. [Types](#3-types)
4. [Endpoints](#4-endpoints)
5. [Screens](#5-screens)
6. [Drill screen in detail](#6-drill-screen-in-detail)
7. [Look, feel and PWA](#7-look-feel-and-pwa)
8. [Labels for forms and rule groups](#8-labels-for-forms-and-rule-groups)

## 1. Connecting: base URL, cookie, CSRF

- Every path below is under `/api`, e.g. `POST /api/auth/login`.
- Read the base URL from env (e.g. `VITE_API_BASE_URL`). In development, proxy `/api` to `http://localhost:3000` from the dev server, so the frontend and API share an origin, exactly like production behind a proxy.
- Send every request with `credentials: 'include'` and JSON bodies with `Content-Type: application/json`.

### Session cookie

- `POST /auth/login` sets a `session` cookie: `HttpOnly; Secure; SameSite=Lax; Path=/`, valid for 30 days. JavaScript cannot read it and does not need to.
- The session ends on logout, when the admin disables the user, or when the user's password is reset.
- Production must serve frontend and API from the **same site**: either the frontend proxies `/api` (simplest, same origin), or `app.example.com` + `api.example.com`. Cross-site setups do not work with `SameSite=Lax`, on purpose.

### CSRF

Every state-changing request (`POST`, `PATCH`, `DELETE`) of a signed-in user must send the header `X-CSRF-Token`. Otherwise the API answers `403 Missing or invalid CSRF token`.

- `POST /auth/login` returns the token in its body (`csrfToken`).
- After a page reload, get it again with `GET /auth/csrf` (needs the cookie). Keep it in memory only; it is tied to the session and stays the same until sign-out.
- On a `403` with that message, fetch `GET /auth/csrf` once and retry the request once.
- The public endpoints (`login`, `accept-invite`, `reset-password`) do not need the header.

Suggested startup: `GET /auth/me` → on `200` also `GET /auth/csrf`; on `401` show sign in.

### Time zone

The streak and "due today" use the learner's time zone setting (default `UTC`). After sign-in, read `GET /me/settings`; if `timeZone` differs from `Intl.DateTimeFormat().resolvedOptions().timeZone`, send `PATCH /me/settings { timeZone }`.

## 2. Errors

Every error has the same JSON shape:

```json
{ "statusCode": 400, "error": "Bad Request", "message": "This link is invalid or has expired" }
```

`message` is a string, or an array of strings for validation errors (one per invalid field, e.g. `["username should not be empty"]`).

| Status | Meaning | Frontend |
|---|---|---|
| 400 | Invalid input or a rule was broken; `message` says which | Show the message |
| 401 | Not signed in (or session ended) | Go to sign in, then back to the page the user came from |
| 403 | Signed in, not allowed (non-admin on admin routes, CSRF) | "Not allowed" page; for CSRF see above |
| 404 | Not found, including another learner's round | Show not found |
| 409 | Conflict: duplicate username, email or verb, item already answered, round finished | Show the message |
| 429 | Too many attempts (10 a minute per IP on login, accept-invite, reset-password) | "Too many attempts, try again in a minute" |
| 5xx / network | Server or connection problem | Friendly retry message |

Sign-in failures always answer `401 Invalid username or password`, also for unknown, disabled and locked accounts (after 5 wrong passwords an account is locked for 15 minutes). Do not try to tell these apart.

## 3. Types

Dates are ISO 8601 strings in UTC.

```ts
type Role = 'ADMIN' | 'LEARNER'
type UserStatus = 'INVITED' | 'ACTIVE' | 'DISABLED'
type JlptLevel = 'N5' | 'N4' | 'N3'
type VerbClass = 'GODAN' | 'ICHIDAN' | 'IRREGULAR'
type DrillMode = 'STANDARD' | 'CONTRAST' | 'EXAM'

type ConjugationForm =
  | 'POLITE' | 'POLITE_NEGATIVE' | 'POLITE_PAST'
  | 'NEGATIVE' | 'PAST_NEGATIVE' | 'TE' | 'PAST'
  | 'POTENTIAL' | 'PASSIVE' | 'CAUSATIVE' | 'CAUSATIVE_PASSIVE'
  | 'VOLITIONAL' | 'CONDITIONAL_BA' | 'IMPERATIVE' | 'PROHIBITIVE'
  | 'POTENTIAL_CONDITIONAL'

type RuleGroup =
  | 'GODAN_U_TSU_RU' | 'GODAN_MU_BU_NU' | 'GODAN_KU' | 'GODAN_GU' | 'GODAN_SU'
  | 'ICHIDAN' | 'IRREGULAR_SURU' | 'IRREGULAR_KURU' | 'EXCEPTION_IKU' | 'EXCEPTION_ARU'

// Users sign in with their username, which is also the only name shown in the app.
// Usernames are 3–30 characters: lowercase a–z, 0–9, _ and -.
interface User {
  id: string
  username: string
  role: Role
  status: UserStatus
  createdAt: string
  lastActiveAt: string | null
}

// The email is for the admin only: it is returned by the admin user routes, never to the
// user themselves, and never used to sign in.
interface AdminUser extends User {
  email: string
}

interface Settings {
  enabledForms: ConjugationForm[] // at least 1; default: all 16
  jlptLevels: JlptLevel[]         // at least 1; default: ['N5', 'N4']
  roundSize: number               // 5–50; default 20
  romajiInput: boolean            // default false
  showFurigana: boolean           // default true
  timeZone: string                // IANA name; default 'UTC'
}

interface VerbSummary {
  dictionaryForm: string // 泳ぐ (kanji where the verb has it)
  reading: string        // およぐ (hiragana)
  meaning: string        // to swim
}

interface RoundItem {
  id: string
  position: number      // 0-based, items arrive in order
  form: ConjugationForm
  verb: VerbSummary
  choices?: string[]    // EXAM only: 4 options in kana, already shuffled
}

interface Round {
  id: string
  mode: DrillMode
  startedAt: string
  items: RoundItem[]
}

interface AnswerResult {
  isCorrect: boolean
  expected: { kanji: string; kana: string } // 泳いで / およいで
  ruleGroup: RuleGroup
  ruleHint: string      // 'ぐ → いで (泳ぐ → 泳いで)'
  note?: string         // e.g. 'Colloquial. In written / exam Japanese use 見られる.'
}

interface RoundSummary {
  id: string
  mode: DrillMode
  startedAt: string
  finishedAt: string
  total: number         // items in the round
  answered: number
  correct: number
  mistakes: {
    itemId: string
    position: number
    verb: VerbSummary
    form: ConjugationForm
    answer: string      // what the learner typed or picked
    expected: { kanji: string; kana: string }
    ruleHint: string
  }[]
}

interface RuleGroupProgress {
  form: ConjugationForm
  ruleGroup: RuleGroup
  attemptCount: number
  correctCount: number
  accuracy: number        // 0–1, two decimals
  box: number             // Leitner box 0–5
  dueAt: string
  lastPracticedAt: string
}

interface Progress {
  totals: {
    attempts: number
    correct: number
    accuracy: number      // 0–1
    roundsFinished: number // finished rounds with at least one answer
    dueToday: number      // rule groups due by the end of today (learner's time zone)
  }
  streak: number          // days in a row with a finished round that has at least one answer; today without one yet does not break it
  ruleGroups: RuleGroupProgress[] // weakest first
}

interface Verb {
  id: string
  dictionaryForm: string
  reading: string
  meaning: string
  verbClass: VerbClass
  jlptLevel: JlptLevel
  isActive: boolean
  excludedForms: ConjugationForm[] // forms never drilled for this verb
  baseVerbId: string | null        // set on compounds such as 勉強する (base: する)
  createdAt: string
}
```

## 4. Endpoints

Signed in = needs the `session` cookie. CSRF = needs `X-CSRF-Token`.

### Auth

| Method and path | Access | Body | Success |
|---|---|---|---|
| `POST /auth/login` | public | `{ username, password }` | `200 { user: User, csrfToken: string }` + cookie |
| `POST /auth/logout` | signed in, CSRF | – | `204` |
| `GET /auth/me` | signed in | – | `200 User` |
| `GET /auth/csrf` | signed in | – | `200 { csrfToken: string }` |
| `POST /auth/accept-invite` | public | `{ token, password }` | `204` |
| `POST /auth/reset-password` | public | `{ token, password }` | `204` |

- Passwords: 12 to 256 characters.
- `token` comes from the link path: `/invite/:token` and `/reset/:token` on the frontend (the backend builds these links with the first `FRONTEND_ORIGIN`).
- A used, expired or unknown token answers `400 This link is invalid or has expired`. Invite links last 7 days, reset links 24 hours. A new link cancels the previous one.
- After accepting an invite or resetting, the user signs in normally; the endpoints do not sign in.

### Settings (learner)

| Method and path | Access | Body | Success |
|---|---|---|---|
| `GET /me/settings` | signed in | – | `200 Settings` |
| `PATCH /me/settings` | signed in, CSRF | any subset of `Settings` | `200 Settings` |

### Drill (learner)

| Method and path | Access | Body | Success |
|---|---|---|---|
| `POST /drill/rounds` | signed in, CSRF | `{ mode: DrillMode }` | `201 Round` |
| `POST /drill/rounds/:roundId/items/:itemId/answer` | signed in, CSRF | `{ answer: string }` (max 100) | `200 AnswerResult` |
| `POST /drill/rounds/:roundId/finish` | signed in, CSRF | – | `200 RoundSummary` |

- A round never contains expected answers. The backend checks each answer.
- Answers may be kana or kanji; surrounding spaces and a trailing `。` are ignored. For compounds, each part may be kanji or kana (持ってこない, もって来ない). Katakana and romaji are wrong, so convert romaji before sending.
- In `EXAM` mode send the chosen option as `answer`.
- Each item can be answered once: a second answer is `409 This item is already answered`.
- If the admin changed the verb so it no longer has the form, answering is `409 This verb was changed during the round; skip this item`. Move on to the next item; it is left out of the summary's mistakes.
- `finish` may be called with unanswered items; they count in `total`, not in `answered`. Calling it again returns the same summary. Answering after finishing is `409 This round is finished`.
- Contrast rounds come in pairs: items at positions 0+1, 2+3, … are the same verb in two commonly confused forms (potential/passive, te/past, ba/potential + ba).
- Starting a round can fail with `400`:
  - `No verbs match your settings` (e.g. only N3 selected, and no N3 verbs exist yet);
  - `Enable both forms of a pair (potential/passive, te/past, ba/potential-ba) for a contrast round`.
- Another learner's round answers `404 Round not found`.
- There is no endpoint to resume an unfinished round after a reload.

### Progress (learner)

| Method and path | Access | Success |
|---|---|---|
| `GET /progress` | signed in | `200 Progress` |
| `GET /progress/export?format=csv` | signed in | `200` file `progress.csv` |
| `GET /progress/export?format=json` | signed in | `200` file `progress.json` |

Export columns, one row per form + rule group: `form, ruleGroup, attemptCount, accuracy, box, lastPracticedAt`. The response has `Content-Disposition: attachment`, so a plain link (same site, cookie included) downloads it.

### Admin (role `ADMIN` only; others get `403 Admins only`)

| Method and path | Body | Success |
|---|---|---|
| `GET /admin/users` | – | `200 AdminUser[]` (oldest first) |
| `POST /admin/users` | `{ username, email }` | `201 { user: AdminUser, link: string, expiresAt: string }` |
| `PATCH /admin/users/:id` | `{ username?, disabled?: boolean }` | `200 AdminUser` |
| `DELETE /admin/users/:id` | – | `204` |
| `POST /admin/users/:id/reset-link` | – | `201 { link: string, expiresAt: string }` |
| `GET /admin/users/:id/progress` | – | `200 Progress` |
| `GET /admin/verbs?q=` | – | `200 Verb[]` |
| `POST /admin/verbs` | see below | `201 { verb: Verb, warnings: string[] }` |
| `PATCH /admin/verbs/:id` | any subset of the create body | `200 { verb: Verb, warnings: string[] }` |

- New users are learners with status `INVITED`; `link` is their invite link (7 days).
- `reset-link` gives an `ACTIVE` user a reset link, and an `INVITED` user a fresh invite link. A `DISABLED` user gets `400`; enable them first.
- Disabling ends all of the user's sessions. Re-enabling restores `ACTIVE` (or `INVITED` if they never set a password).
- The admin cannot disable or delete their own account (`400`).
- Usernames are lowercased by the API (`New-Learner` becomes `new-learner`); anything outside 3–30 characters of a–z, 0–9, `_` and `-` is `400 username must be 3-30 characters: a-z, 0-9, _ or -`. Sign-in ignores case too.
- Duplicate username or email: `409`.
- Verb create body: `{ dictionaryForm, reading, meaning, jlptLevel, verbClass?, excludedForms?, isActive?, baseVerbId? }`.
  - `reading` in hiragana.
  - For a compound, send `baseVerbId` (e.g. the id of する) and leave out `verbClass`; `dictionaryForm` and `reading` must end in the base verb (勉強する / べんきょうする).
  - Every save runs the verb through the conjugation engine. A broken verb is `400` with the reason. A likely misclassified verb is saved, and `warnings` explains (`帰る is usually godan, not ichidan`): show warnings prominently after saving.
  - Duplicate (same `dictionaryForm` + `reading`): `409`. There is no delete; set `isActive: false`.
- `q` searches kanji, kana and meaning.

## 5. Screens

No sign-up page.

### Public
- **Sign in**: username, password (`autocomplete="username"` and `"current-password"`).
- **Accept invite** (`/invite/:token`): new password + confirmation (min 12 characters), then go to sign in.
- **Reset password** (`/reset/:token`): same layout as accept invite.

### Learner
- **Home**:
  - start buttons for Standard, Contrast and Exam;
  - rule groups due today (`totals.dueToday`);
  - current streak;
  - the 3 weakest areas (first 3 of `ruleGroups`).
- **Drill**: see [section 6](#6-drill-screen-in-detail).
- **Round summary**: score (`correct` / `total`), each mistake with the learner's answer, the expected form and the rule hint, and buttons "Another round" and "Home".
- **Progress**: a table or grid of form × rule group with accuracy and box, weakest first; export buttons for CSV and JSON.
- **Settings**:
  - enabled forms;
  - JLPT levels;
  - round size (5–50);
  - romaji input on/off;
  - furigana on/off.
  - The time zone is set automatically (section 1).

### Admin (only when `user.role === 'ADMIN'`)
- **Users**:
  - list with username, email, status and last active;
  - create user (username + email), then show the invite link with a copy button and its expiry;
  - enable/disable;
  - delete after a confirmation dialog;
  - create a reset link (copy button and expiry);
  - open a user's progress (same view as the learner's progress).
- **Verbs**: searchable list; create and edit forms that show the backend's `warnings`; compound support (pick the base verb); toggle forms in `excludedForms`; active/inactive.

## 6. Drill screen in detail

This is the core of the app; get it exactly right.

- One prompt at a time:
  - the verb in kanji with furigana via `<ruby>` (`dictionaryForm` + `reading`), hidden when `showFurigana` is off;
  - the English meaning;
  - the requested form as a clear label, e.g. **"te-form (て形)"** (see [section 8](#8-labels-for-forms-and-rule-groups)).
- One large text input:
  - `lang="ja"`, autofocused, `autocapitalize="off"`, `autocomplete="off"`, `autocorrect="off"`, `spellcheck="false"`;
  - with a visible label (it can be visually subtle).
- **IME-safe submit**: Enter submits only when no IME composition is active. Check `event.isComposing` (and `keyCode === 229` for older Safari) or track `compositionstart` / `compositionend`. Pressing Enter to confirm a kana → kanji conversion must **never** submit.
- **Romaji input** (setting, off by default): convert to kana while typing with WanaKana (`wanakana.bind` or `toKana` on input). Send kana, never romaji.
- After submit:
  - show ✓ or ✗;
  - show the expected form (kanji + kana);
  - show `ruleHint` and `note` when present;
  - announce the result through an `aria-live="polite"` region.
  - The input stays disabled until "Next"; Enter or the Next button goes to the next item.
- A progress bar: answered / total (e.g. 7 / 20).
- **Contrast mode**: on the second item of each pair (odd `position`), show a small "compare" label, ideally with the first item's form.
- **Exam mode**: 3–4 large choice buttons (from `choices`) instead of the input, with keyboard shortcuts 1–4. The choices are in kana.
- Never show or receive the expected answer before submitting.
- Leaving mid-round asks for confirmation. After the last item, call `finish` and show the summary.

## 7. Look, feel and PWA

- Mobile first: large touch targets, calm and clean.
- Light and dark mode following the system setting.
- A font that renders Japanese well: the system Japanese font stack, or Noto Sans JP loaded efficiently (subset, `font-display: swap`).
- Accessible: labels, visible focus states, enough contrast, feedback via `aria-live`.
- PWA: manifest and icons so it installs on a phone. The service worker caches the app shell only, **never API responses**.
- Fast on slow connections: small bundle, route-level code splitting, no heavy UI kit.
- No third-party analytics or trackers.

## 8. Labels for forms and rule groups

| `ConjugationForm` | Label | Example (書く) |
|---|---|---|
| `POLITE` | polite (ます形) | 書きます |
| `POLITE_NEGATIVE` | polite negative | 書きません |
| `POLITE_PAST` | polite past | 書きました |
| `NEGATIVE` | negative (ない形) | 書かない |
| `PAST_NEGATIVE` | past negative | 書かなかった |
| `TE` | te-form (て形) | 書いて |
| `PAST` | past (た形) | 書いた |
| `POTENTIAL` | potential (可能形) | 書ける |
| `PASSIVE` | passive (受身形) | 書かれる |
| `CAUSATIVE` | causative (使役形) | 書かせる |
| `CAUSATIVE_PASSIVE` | causative-passive (使役受身形) | 書かせられる |
| `VOLITIONAL` | volitional (意向形) | 書こう |
| `CONDITIONAL_BA` | ba-conditional (ば形) | 書けば |
| `IMPERATIVE` | imperative (命令形) | 書け |
| `PROHIBITIVE` | prohibitive (〜な) | 書くな |
| `POTENTIAL_CONDITIONAL` | potential + ba (可能形 + ば) | 書ければ |

| `RuleGroup` | Label |
|---|---|
| `GODAN_U_TSU_RU` | godan う・つ・る |
| `GODAN_MU_BU_NU` | godan む・ぶ・ぬ |
| `GODAN_KU` | godan く |
| `GODAN_GU` | godan ぐ |
| `GODAN_SU` | godan す |
| `ICHIDAN` | ichidan |
| `IRREGULAR_SURU` | する |
| `IRREGULAR_KURU` | 来る |
| `EXCEPTION_IKU` | 行く (exception) |
| `EXCEPTION_ARU` | ある (exception) |
