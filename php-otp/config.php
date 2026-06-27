<?php
// ── Email OTP backend configuration ─────────────────────────────────────────
// Sends via Resend SMTP from the verified domain iskonnect.me (proper SPF/DKIM/
// DMARC → lands in inbox, not spam). Paste your Resend API key as smtp_pass.

return [
    // SMTP (Resend) — username is literally "resend"; password is the API key.
    'smtp_host'   => 'smtp.resend.com',
    'smtp_port'   => 587,
    'smtp_secure' => 'tls',                 // STARTTLS on 587
    'smtp_user'   => 'resend',
    'smtp_pass'   => 'PASTE_YOUR_RESEND_API_KEY_HERE',
    'mail_from'   => 'noreply@iskonnect.me',
    'mail_from_name' => 'ISKONNECT',

    // CA bundle for verifying the SMTP server's TLS certificate. Leave empty in
    // production (uses PHP's default CAs). On this machine Avast intercepts TLS
    // with its own root, so point at the Avast root PEM so verification passes.
    'smtp_cafile' => 'C:\\Users\\galla\\avast-root.pem',

    // OTP behaviour
    'otp_ttl_seconds' => 600,   // code valid for 10 minutes
    'otp_max_attempts' => 3,    // wrong tries before a new code is required

    // Where to keep the (hashed) codes. Created automatically; keep it
    // non-public if possible.
    'store_dir' => __DIR__ . '/otp_data',

    // CORS — the origin(s) of your scholar app. '*' is fine for local testing.
    'allow_origin' => '*',
];
