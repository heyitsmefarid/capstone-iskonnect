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
    'smtp_pass'   => getenv('RESEND_API_KEY') ?: ((($s = @include __DIR__ . '/secrets.local.php') && isset($s['resend_api_key'])) ? $s['resend_api_key'] : ''),
    'mail_from'   => 'noreply@iskonnect.me',
    'mail_from_name' => 'ISKONNECT',

    // CA bundle for verifying the Resend API's TLS certificate. On this dev
    // machine Avast intercepts TLS with its own root, so we point at the Avast
    // root PEM when it exists. On a public host that file is absent, so this
    // resolves to '' and cURL falls back to the system CA store — meaning the
    // same config works both locally and when deployed.
    'smtp_cafile' => is_file('C:\\Users\\galla\\avast-root.pem') ? 'C:\\Users\\galla\\avast-root.pem' : (getenv('OTP_CAFILE') ?: ''),

    // Environment — set to 'production' before deploying. In 'development' mode
    // the OTP is returned in the HTTP response body when email is not configured,
    // so you can test without a real SMTP/Resend key. NEVER leave 'development'
    // in a public/production deployment.
    'env' => 'production',

    // OTP behaviour
    'otp_ttl_seconds' => 600,   // code valid for 10 minutes
    'otp_max_attempts' => 3,    // wrong tries before a new code is required

    // Where to keep the (hashed) codes. Created automatically; keep it
    // non-public if possible.
    'store_dir' => __DIR__ . '/otp_data',

    // CORS — the origin(s) of your scholar app. '*' is fine for local testing.
    'allow_origin' => '*',
];
