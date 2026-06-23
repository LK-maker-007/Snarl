# Snarl

Cricket coaching and analytics app. Android-first and on-device: it turns smartphone video of a
delivery into ball tracking and body-pose feedback for players and coaches. Early development.

## Setup
See `BOOTSTRAP.md` for prerequisites (Node 22, JDK 17, Android SDK) and the steps to build and run.

## Layout
- `app/` — React Native (TypeScript) Android app and native (Kotlin) module.
- `ml/` — model training and PyTorch->TFLite conversion (Python; offline, not shipped).

## Engineering standards
- Permissively licensed dependencies only (no AGPL/GPL/non-commercial).
- Privacy by design: informed consent before recording anyone, with parental consent for minors;
  on-device inference, with data minimization and residency for anything stored.
- Strict types, fail-loud error handling, small focused modules, no needless comments.

## Build
```
cd app && npm install        # requires Node >= 22.11
npm run android              # requires JDK 17 + Android SDK + a connected device
npm run lint && npx tsc --noEmit && npm test
```
