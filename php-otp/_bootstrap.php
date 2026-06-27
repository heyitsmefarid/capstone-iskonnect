<?php
// Shared helpers: CORS, JSON output, and a simple file-based OTP store (so no
// database setup is required).

$CONFIG = require __DIR__ . '/config.php';

// ── CORS ────────────────────────────────────────────────────────────────────
header('Access-Control-Allow-Origin: ' . $CONFIG['allow_origin']);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Preflight
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond($status, $payload)
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function read_json_body()
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function is_valid_email($email)
{
    return is_string($email) && filter_var($email, FILTER_VALIDATE_EMAIL);
}

// ── File-based OTP store ─────────────────────────────────────────────────────
function otp_path($CONFIG, $email)
{
    if (!is_dir($CONFIG['store_dir'])) {
        @mkdir($CONFIG['store_dir'], 0700, true);
    }
    $key = sha1(strtolower(trim($email)));
    return $CONFIG['store_dir'] . '/' . $key . '.json';
}

function otp_save($CONFIG, $email, $code)
{
    $record = [
        'hash'      => hash('sha256', $code),
        'expiresAt' => time() + (int) $CONFIG['otp_ttl_seconds'],
        'attempts'  => 0,
    ];
    file_put_contents(otp_path($CONFIG, $email), json_encode($record), LOCK_EX);
}

function otp_load($CONFIG, $email)
{
    $path = otp_path($CONFIG, $email);
    if (!is_file($path)) {
        return null;
    }
    $data = json_decode(file_get_contents($path), true);
    return is_array($data) ? $data : null;
}

function otp_delete($CONFIG, $email)
{
    @unlink(otp_path($CONFIG, $email));
}

function otp_bump_attempts($CONFIG, $email, $record)
{
    $record['attempts'] = (int) $record['attempts'] + 1;
    file_put_contents(otp_path($CONFIG, $email), json_encode($record), LOCK_EX);
    return $record['attempts'];
}
