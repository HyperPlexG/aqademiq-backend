# Google + Apple sign-in — setup

The Flutter side is **wired** (native sign-in → Supabase `signInWithIdToken`):
- `signInWithGoogle()` / `signInWithApple()` in `lib/data/auth/api_auth_repository.dart`
- Sign-in screen buttons trigger them via `AuthController`
- Config via dart-defines: `GOOGLE_SERVER_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`

What's left is the **console + native project** setup (accounts you own).

## 1. Google Cloud Console — create 3 OAuth clients
APIs & Services → Credentials → Create OAuth client ID (configure the consent screen first).

| Client type | Fields | Used as |
|---|---|---|
| **Web application** | Authorized redirect URI: `https://qwvuoooentacjslzpbqy.supabase.co/auth/v1/callback` | Supabase provider + app's `GOOGLE_SERVER_CLIENT_ID` (serverClientId) |
| **Android** | Package name `com.aqademiq.aqademiq` + signing **SHA-1** (see §4) | native Android sign-in |
| **iOS** | Bundle ID `com.aqademiq.aqademiq` | app's `GOOGLE_IOS_CLIENT_ID` (+ iOS URL scheme) |

## 2. Supabase dashboard → Authentication → Providers
- **Google**: enable. Paste the **Web** client ID + secret. In "Authorized Client IDs" add the **Android** and **iOS** client IDs (so native id-tokens are accepted).
- **Apple**: enable. Add bundle id `com.aqademiq.aqademiq` to the client IDs list. (A Services ID + key is only needed if you also want Apple sign-in on Android/web.)

## 3. Apple Developer
- Certificates, IDs & Profiles → your App ID `com.aqademiq.aqademiq` → enable the **Sign in with Apple** capability.
- In Xcode: Runner target → Signing & Capabilities → **+ Capability → Sign in with Apple**. A `Runner.entitlements` (already created in `ios/Runner/`) declares it — Xcode will pick it up / wire `CODE_SIGN_ENTITLEMENTS`.

## 4. Native project config
### iOS — Google URL scheme (`ios/Runner/Info.plist`)
Add your **reversed iOS client ID** as a URL scheme (from the iOS client — it's `com.googleusercontent.apps.XXXXXX`):
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.YOUR_IOS_CLIENT_ID_SUFFIX</string>
    </array>
  </dict>
</array>
```

### Android — SHA-1 for the Android OAuth client
```bash
# debug SHA-1 (for testing)
keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android | grep SHA1
# release SHA-1: use your upload keystore (android/key.properties)
keytool -list -v -alias upload -keystore /path/to/aqademiq-upload.jks | grep SHA1
```
Add both SHA-1s to the Android OAuth client in Google Cloud Console. No `google-services.json` is needed (google_sign_in 7.x uses `serverClientId` via Credential Manager).

## 5. Build with the client IDs
```bash
flutter run --dart-define=USE_MOCKS=false \
  --dart-define=API_BASE_URL=https://qwvuoooentacjslzpbqy.supabase.co/functions/v1/api \
  --dart-define=SUPABASE_URL=https://qwvuoooentacjslzpbqy.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=<anon or sb_publishable_ key> \
  --dart-define=GOOGLE_SERVER_CLIENT_ID=<WEB client id>.apps.googleusercontent.com \
  --dart-define=GOOGLE_IOS_CLIENT_ID=<iOS client id>.apps.googleusercontent.com
```

Notes:
- Apple requires Sign-in-with-Apple wherever you offer Google — both buttons are wired, so you're covered on that App Review rule.
- The nonce for Apple is handled in code (SHA-256 to Apple, raw to Supabase).
