<?php
// POST { "email": "...", "otp": "123456" }  ->  verifies the code.
require __DIR__ . '/_bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['error' => 'Method not allowed']);
}

$body  = read_json_body();
$email = strtolower(trim($body['email'] ?? ''));
$otp   = trim((string) ($body['otp'] ?? ''));

if (!is_valid_email($email)) {
    respond(400, ['error' => 'A valid email address is required.']);
}
if ($otp === '') {
    respond(400, ['error' => 'Verification code is required.']);
}

$record = otp_load($CONFIG, $email);
if ($record === null) {
    respond(400, ['error' => 'No active verification code found. Please request a new one.']);
}

if (time() > (int) $record['expiresAt']) {
    otp_delete($CONFIG, $email);
    respond(400, ['error' => 'Verification code has expired. Please request a new one.']);
}

if ((int) $record['attempts'] >= (int) $CONFIG['otp_max_attempts']) {
    otp_delete($CONFIG, $email);
    respond(400, ['error' => 'Too many incorrect attempts. Please request a new verification code.']);
}

// Constant-time compare of the hashes.
if (!hash_equals($record['hash'], hash('sha256', $otp))) {
    $attempts = otp_bump_attempts($CONFIG, $email, $record);
    $remaining = (int) $CONFIG['otp_max_attempts'] - $attempts;
    respond(400, [
        'error' => $remaining > 0
            ? "Incorrect code. $remaining attempt" . ($remaining !== 1 ? 's' : '') . ' remaining.'
            : 'Too many incorrect attempts. Please request a new verification code.',
    ]);
}

// Correct — consume the code so it can't be reused.
otp_delete($CONFIG, $email);
respond(200, ['success' => true, 'message' => 'Email address verified successfully.']);
