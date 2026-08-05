<?php
// POST { "email": "..." } -> generates a 6-digit OTP, stores it, emails it via Resend HTTP API.
// No PHPMailer required — uses cURL only.
// Dev fallback: when no API key is configured or the email fails, returns the
// code as "devCode" in the response body so the Flutter app can display it.
require __DIR__ . '/_bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['error' => 'Method not allowed']);
}

$body  = read_json_body();
$email = strtolower(trim($body['email'] ?? ''));

if (!is_valid_email($email)) {
    respond(400, ['error' => 'A valid email address is required.']);
}

$code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
otp_save($CONFIG, $email, $code);

$apiKey = $CONFIG['smtp_pass'] ?? '';
$emailSent = false;

if ($apiKey !== '' && $apiKey !== 'PASTE_YOUR_RESEND_API_KEY_HERE') {
    $htmlBody =
        '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">'
        . '<h2 style="color:#1B4D5C;margin-bottom:8px">Email Verification</h2>'
        . '<p style="color:#555;margin-bottom:24px">Use the code below to verify your email address.</p>'
        . '<div style="background:#f4f9fb;border:1px solid #c9e4ec;border-radius:8px;padding:20px 32px;text-align:center">'
        . '<span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1B4D5C">' . $code . '</span>'
        . '</div>'
        . '<p style="color:#888;font-size:13px;margin-top:16px">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>'
        . '</div>';

    $payload = json_encode([
        'from'    => $CONFIG['mail_from_name'] . ' <' . $CONFIG['mail_from'] . '>',
        'to'      => [$email],
        'subject' => 'ISKONNECT — Email Verification Code',
        'html'    => $htmlBody,
        'text'    => "Your ISKONNECT verification code is: $code (expires in 10 minutes).",
    ]);

    $ch = curl_init('https://api.resend.com/emails');
    $curlOpts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ];
    // Use the custom CA bundle when configured (handles Avast TLS interception).
    if (!empty($CONFIG['smtp_cafile'])) {
        $curlOpts[CURLOPT_CAINFO] = $CONFIG['smtp_cafile'];
    }
    curl_setopt_array($ch, $curlOpts);
    $resp     = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    $emailSent = ($httpCode >= 200 && $httpCode < 300);
    if (!$emailSent) {
        error_log('[send_otp] Resend API error (' . $httpCode . '): ' . $resp);
    }
}

error_log('[send_otp] issued OTP for ' . $email);

if ($emailSent) {
    respond(200, ['success' => true, 'message' => 'Verification code sent. Check your email.']);
}

$isDev = ($CONFIG['env'] ?? '') === 'development';

if ($isDev && !$emailSent) {
    // Dev-only: return the code so the app can display it without a real SMTP key.
    // This branch is gated behind env=development in config.php and is never
    // reached when a valid API key is configured and email sending succeeds.
    respond(200, [
        'success' => true,
        'message' => 'Email service not configured — showing code below for testing.',
        'devCode' => $code,
    ]);
}

// Production: email failed — return a generic error (no code disclosure).
respond(502, ['error' => 'Could not send the verification email. Please try again.']);
