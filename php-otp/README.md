# PHP + PHPMailer email-OTP backend

A tiny backend that sends/verifies the registration email code over Gmail SMTP —
so email verification works **without** Firebase Blaze. No database needed (codes
are kept hashed in `otp_data/`).

Endpoints:
- `POST send_otp.php`   body `{ "email": "..." }`            → emails a 6-digit code
- `POST verify_otp.php` body `{ "email": "...", "otp": "123456" }` → verifies it

## 1. Get a PHP host
PHPMailer needs PHP with outbound SMTP. Easiest = **XAMPP** (local):
1. Install XAMPP (free) → start **Apache**.
2. Copy this whole `php-otp` folder into `C:\xampp\htdocs\` → `C:\xampp\htdocs\php-otp`.

(For a deployed app later, host it anywhere that allows outbound SMTP — many free
hosts block port 587, so verify before relying on one.)

## 2. Add PHPMailer
From inside `php-otp`, either:
- **Composer:** `composer require phpmailer/phpmailer`  (creates `vendor/`), or
- **Manual:** download https://github.com/PHPMailer/PHPMailer (Code → Download ZIP),
  and copy its `src` folder to `php-otp/PHPMailer/src` (so `PHPMailer/src/PHPMailer.php` exists).

`send_otp.php` auto-detects either layout.

## 3. Paste the Gmail App Password
Open `config.php` and set `smtp_pass` to the **App Password** — it's the
`SMTP_PASS` value already in `backend/functions/.env` (a 16-character Gmail app
password, not your normal password). Everything else (host/user/from) is prefilled.

## 4. Point the scholar app at it
Run the scholar app with the base URL of this folder:
```
flutter run -d chrome --dart-define=OTP_BASE_URL=http://localhost/php-otp
```
(omit the flag to fall back to the Cloud Functions). For a deployed PHP host, use
its public URL, e.g. `--dart-define=OTP_BASE_URL=https://yourhost.example/php-otp`.

## 5. Test
Register → **Send Verification Code** → the email arrives → type the code → verify.

## Notes
- `otp_data/` is created automatically and holds only hashed codes with expiry.
- Codes expire in 10 minutes and allow 3 wrong attempts (configurable in `config.php`).
- Keep `config.php` private — it contains the app password once you fill it in.
