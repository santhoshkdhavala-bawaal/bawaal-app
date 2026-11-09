# BAWAAL Flutter — Registration

Production registration surface matching the BAWAAL wireframe tokens:

- Background `#0E0F13`
- Surface card `#1E1F23`
- Accent / button `#F36017`

## Setup

```bash
cd flutter_app
cp .env.example .env
# Fill SUPABASE_URL + SUPABASE_ANON_KEY (same project as the Expo app)
flutter pub get
flutter run
```

Or without a file:

```bash
flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
```

## Flow

1. Validate form (Continue disabled until Terms checked).
2. `Supabase.instance.client.auth.signUp(email, password)` — password is generated securely client-side (no password field on the wireframe).
3. Upsert row into `public.profiles`.
4. Open OTP modal → `verifyOTP(type: signup)` → re-upsert profile on success.

## Key files

| Path | Role |
|---|---|
| `lib/screens/registration_page.dart` | Full registration UI |
| `lib/widgets/sports_picker_sheet.dart` | Grouped searchable sports sheet |
| `lib/data/sports_categories.dart` | `sportsCategories` map |
| `lib/services/registration_service.dart` | signUp + profiles + OTP |
| `lib/screens/terms_screen.dart` | Terms & Conditions |
