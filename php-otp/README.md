# Email-OTP backend (Resend HTTP API)

A tiny backend that sends/verifies the registration email code by calling the
**Resend** HTTP API with cURL (no PHPMailer, no SMTP, no Firebase Blaze). No
database needed (codes are kept hashed in `otp_data/`).

Endpoints:
- `POST send_otp.php`   body `{ "email": "..." }`            → emails a 6-digit code
- `POST verify_otp.php` body `{ "email": "...", "otp": "123456" }` → verifies it

## 1. Configure the Resend API key
The key is read from either the `RESEND_API_KEY` env var or `secrets.local.php`
(gitignored). Copy `secrets.example.php` → `secrets.local.php` and paste your key:
```php
return [ 'resend_api_key' => 're_xxxxxxxx' ];
```
Sending uses the verified sender domain in `config.php` (`mail_from`), so codes
land in the inbox for any recipient.

## 2. Start the OTP server
The scholar app targets `http://localhost:8090` by default (see
`ApiConfig.otpBaseUrl`). Start the backend there — **it must be running before
you use email verification or password reset**:
```
powershell -ExecutionPolicy Bypass -File php-otp\start-otp-server.ps1
```
The script auto-detects PHP (Laragon/XAMPP/PATH) and runs
`php -S localhost:8090 -t php-otp`. To use a different host/port, run the scholar
app with `--dart-define=OTP_BASE_URL=https://yourhost.example/php-otp`.

## 3. Run the scholar app
```
flutter run -d chrome
```
(defaults to `OTP_BASE_URL=http://localhost:8090`; pass the flag above to override).

## 4. Test
Register → **Send Verification Code** → the email arrives → type the code → verify.

## Notes
- `otp_data/` is created automatically and holds only hashed codes with expiry.
- Codes expire in 10 minutes and allow 3 wrong attempts (configurable in `config.php`).
- Keep `config.php` private — it contains the app password once you fill it in.
