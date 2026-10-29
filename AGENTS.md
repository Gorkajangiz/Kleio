# AGENTS.md

Kleio is an encrypted personal diary: a standalone Angular 22 SPA with Firebase Auth/Firestore, packaged for Android with Capacitor 8. User-facing copy is Spanish; keep it Spanish.

## Commands

```bash
npm ci
npm start                  # ng serve (development config)
npm run build              # production build; output goes to dist/Kleio/browser
npm test -- --watch=false  # all specs (Vitest + jsdom)
npx ng test --watch=false --include=src/app/utils/auth-errors.spec.ts  # one file
npx ng test --watch=false --filter="^App"                             # filter by suite/test name
```

- Tests run in jsdom via `@angular/build:unit-test` with Vitest globals (`tsconfig.spec.json`); there is no Karma/Jasmine config.
- No lint, typecheck, or format npm scripts. Use `npx prettier --write <files>` (`.prettierrc`); `ng build` is the real TS/template check. No CI workflows exist.

## Architecture

- Single Angular project, no NgModules. Bootstrap: `src/main.ts` -> `app.config.ts` -> `app.routes.ts`. Components are standalone.
- Zoneless change detection (no zone.js): use signals/computed; component specs should `await fixture.whenStable()`.
- Routes: `/login`, `/register`, `/unlock`, `/pin-setup`, `/diario`; `''` and `**` go to `/diario` and the guards redirect from there.
- Guards in `src/app/guards/`: `authGuard` waits for Firebase auth, `guestGuard` sends authenticated users to diary/unlock, `unlockedGuard` requires the diary key, `lockedGuard` redirects unlocked users away from `/unlock`, and `pinConfiguredGuard` forces PIN setup before `/diario`.
- Core services in `src/app/services/`: `AuthService`, `CryptoService`, `LocalKeyStore`, `PinAttemptsService`, `DiaryService`, `PreferencesService`, `ToastService`, `PlatformService`.
- Ionic is configured (`provideIonicAngular` + global Ionic CSS) but templates use plain HTML/CSS, not `<ion-*>` components.
- Firebase config is hardcoded in `src/app/firebase.config.ts` (Analytics initialized at import). There are no Angular environments or `.env` loading.
- `tsconfig.json` does not enable `strict`; it does enable `noImplicitReturns`, `noImplicitOverride`, and `noPropertyAccessFromIndexSignature` (hence `data['field']` for Firestore maps).

## Crypto and data invariants

- The master key is a random 256-bit AES-GCM key held only in memory. On registration it is wrapped twice with PBKDF2-SHA256 (600k iterations): the Firestore `users/{uid}.crypto.recovery` copy is wrapped with the account password, and the device copy is wrapped with the 4-digit PIN in `localStorage['kleio.lock.v2.<uid>']`. Never persist the raw key.
- Normal launches restore the Firebase session automatically, then `/unlock` asks for the PIN. The account password is only needed on a new device, after storage is cleared, or for PIN recovery.
- `entries` docs keep `uid` and `date` in clear; `entry` and `mood` are AES-GCM ciphertext, base64 with the 12-byte IV prepended. `mood` is encrypted as a string.
- Every entry read/write requires an unlocked key; `DiaryService` throws otherwise. Registration (`PinSetupComponent`) creates the PIN envelope; login on a new device recovers with the password first.
- Do not call `crypto.restoreKey()` or reintroduce `diary.masterKey.v1`; that legacy raw-key cache was removed.
- On diary load, `DiaryComponent.getEntries()` calls `fillMissingDays()`, which writes empty encrypted entries for every missing day from the earliest entry through yesterday. Visiting `/diario` mutates Firestore; account for this before changing calendar/history logic.
- Preferences use `localStorage` keys prefixed `kleio-`; PIN envelopes use `kleio.lock.v2.` and PIN attempt counters `kleio.pin.attempts.`.

## UI and Android quirks

- Themes are `dark` and `cushy`. A page sets `class="cushy-theme"` on its host and imports a parallel `*Cushy.css` in `styleUrls`; global Android overrides are in `src/app/android/android-overrides.css` (wired in `angular.json`).
- `AndroidShellComponent` renders only on Android and moves `.drawer-shell .drawer-panel` into a fixed sheet via `MutationObserver`/`appendChild`. Its back-button handler clicks `.entry-modal-close` / `.settings-modal-close`. Renaming those classes or the drawer DOM breaks native behavior.
- Capacitor flow: `npm run build`, then `npx cap sync android` (or `npx cap open android`). `webDir` is `dist/Kleio/browser`; `cap sync` regenerates `android/app/capacitor.build.gradle` and `android/capacitor.settings.gradle`.
