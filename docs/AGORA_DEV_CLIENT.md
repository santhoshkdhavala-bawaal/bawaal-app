# Agora RTC — Dev Client build (required)

`react-native-agora` is a **native module**. It does **not** work in Expo Go.

## 1. Env

In `.env`:

```bash
EXPO_PUBLIC_AGORA_APP_ID=your_agora_app_id
EXPO_PUBLIC_AGORA_TOKEN=   # optional if App Certificate is disabled
```

Restart Metro after changing env (`npx expo start --dev-client -c`).

## 2. Config plugins

`app.json` includes:

- `expo-dev-client`
- `expo-camera` (permissions)
- `./plugins/withAgora.js` (extra camera/mic native permissions for Agora)

## 3. Local native rebuild

```bash
npx expo prebuild --clean
npx expo run:android
# or
npx expo run:ios
```

## 4. EAS development build

```bash
npx eas-cli@latest build --profile development --platform android
# or
npx eas-cli@latest build --profile development --platform ios
```

Install the APK/IPA, then:

```bash
npx expo start --dev-client
```

## 5. Verify

If Agora linked correctly you should **not** see:

```text
[agora] Native module unavailable
```

Host / Challenger Cam On should show local preview (`RtcSurfaceView` uid `0`).
