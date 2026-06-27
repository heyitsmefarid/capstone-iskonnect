<?php
// POST { "email": "..." }  ->  emails a 6-digit password-reset code.
// Verification of the code is done via verify_otp.php (shared OTP store); the
// app then sets the new password in Firestore once the code checks out.
require __DIR__ . '/_bootstrap.php';

if (is_file(__DIR__ . '/vendor/autoload.php')) {
    require __DIR__ . '/vendor/autoload.php';
} else {
    require __DIR__ . '/PHPMailer/src/Exception.php';
    require __DIR__ . '/PHPMailer/src/PHPMailer.php';
    require __DIR__ . '/PHPMailer/src/SMTP.php';
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

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

$mail = new PHPMailer(true);
try {
    $mail->isSMTP();
    $mail->Host       = $CONFIG['smtp_host'];
    $mail->Port       = (int) $CONFIG['smtp_port'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $CONFIG['smtp_user'];
    $mail->Password   = $CONFIG['smtp_pass'];
    $mail->SMTPSecure = $CONFIG['smtp_secure'];
    $mail->CharSet    = 'UTF-8';
    if (!empty($CONFIG['smtp_cafile'])) {
        $mail->SMTPOptions = ['ssl' => [
            'cafile' => $CONFIG['smtp_cafile'],
            'verify_peer' => true,
            'verify_peer_name' => false,
        ]];
    }

    $mail->setFrom($CONFIG['mail_from'], $CONFIG['mail_from_name']);
    $mail->addAddress($email);
    $mail->isHTML(true);
    $mail->Subject = 'ISKONNECT — Password Reset Code';
    $mail->Body    =
        '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">'
        . '<h2 style="color:#1B4D5C;margin-bottom:8px">Password Reset</h2>'
        . '<p style="color:#555;margin-bottom:24px">Use the code below to reset your ISKONNECT password.</p>'
        . '<div style="background:#f4f9fb;border:1px solid #c9e4ec;border-radius:8px;padding:20px 32px;text-align:center">'
        . '<span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1B4D5C">' . $code . '</span>'
        . '</div>'
        . '<p style="color:#888;font-size:13px;margin-top:16px">This code expires in <strong>10 minutes</strong>. If you didn\'t request this, you can ignore this email.</p>'
        . '</div>';
    $mail->AltBody = "Your ISKONNECT password reset code is: $code (expires in 10 minutes).";

    $mail->send();
    // Generic message — don't reveal whether the account exists.
    respond(200, ['success' => true, 'message' => 'If an account exists for that email, a reset code has been sent.']);
} catch (Exception $e) {
    error_log('[request_password_reset] ' . $mail->ErrorInfo);
    respond(502, ['error' => 'Could not send the reset email. Please try again.']);
}
