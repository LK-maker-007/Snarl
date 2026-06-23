# Bootstrap — setup to build and run

The app scaffold (`app/`, React Native 0.86) is generated, but a fresh machine needs these
prerequisites to build/run on a phone. Versions are required, not optional.

## Prerequisites
- Node >= 22.11.0 (React Native 0.86 requires it). Upgrade before `npm install`.
- JDK 17 — required for the Android Gradle build.
- Android SDK + `adb` — required to build the APK and sideload to a phone.
- A physical Android phone with USB debugging enabled.

## 1. Node 22 (via nvm)
```
nvm install 22 && nvm use 22   # repo pins Node 22 in .nvmrc
node -v                        # expect v22.x
```

## 2. JDK 17 (Ubuntu)
```
sudo apt update && sudo apt install -y openjdk-17-jdk
java -version                  # expect 17.x
# add to your shell profile:
export JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(which java)")")")"
```

## 3. Android SDK
Easiest: install Android Studio (bundles the SDK + platform-tools). Otherwise install the
command-line tools and use `sdkmanager`. Then set:
```
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
adb version                    # confirms platform-tools on PATH
```
Install the SDK platform + build-tools versions React Native 0.86 expects — read the exact
numbers from `app/android/build.gradle` (compileSdkVersion / buildToolsVersion); do not guess.

## 4. App dependencies
```
cd app
npm install                    # generates package-lock.json (CI uses it)
```
Then add the on-device CV libraries, each per its own install guide (follow the docs for exact
peer dependencies and native setup):
- react-native-vision-camera (camera + frame processors)
- react-native-fast-tflite (run the .tflite models)
- vision-camera-resize-plugin (frame -> tensor preprocessing)
- a pose provider: MediaPipe Tasks via a native Kotlin module (or a maintained community wrapper),
  decided at the pose-integration step.

## 5. Run on a device
```
cd app
npm run android                # builds and installs to the connected phone
```

## 6. Quality checks (must pass)
```
cd app
npm run lint                   # ESLint, strict rules, no disabled rules
npx tsc --noEmit               # strict type-check
npm test                       # Jest
```

## 7. ML training area (Python)
```
cd ml
python3 -m venv .venv && source .venv/bin/activate
pip install ruff mypy          # add torch / training deps when training starts
ruff check . && mypy .
```

## Notes
- `.github/workflows/ci.yml` activates once `app/package-lock.json` is committed.
- Model training runs on an external GPU (e.g. Kaggle/Colab), not the dev laptop.
- App name "Snarl" / package `com.snarl.app` are placeholders — rename before any store release.
