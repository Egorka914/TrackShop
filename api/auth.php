<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$action = $_GET['action'] ?? '';

if ($action === 'csrf') json_out(['csrf' => csrf_token()]);

if ($action === 'register') {
    require_method('POST');
    rate_limit('reg:' . client_ip(), 5, 3600);
    $in = json_input();
    $email = strtolower(sanitize_str($in['email'] ?? ''));
    $pass  = (string)($in['password'] ?? '');
    $company = sanitize_str($in['company'] ?? '', 200);

    if (!valid_email($email)) json_out(['error' => 'Некорректный email'], 400);
    if (mb_strlen($pass) < 8) json_out(['error' => 'Пароль минимум 8 символов'], 400);
    if ($company === '') json_out(['error' => 'Укажите название компании'], 400);

    try {
        $st = db()->prepare("INSERT INTO users (email,password_hash,company,inn,kpp,phone,address,role,status) VALUES (?,?,?,?,?,?,?,?,?)");
        $st->execute([
            $email, password_hash($pass, PASSWORD_DEFAULT), $company,
            sanitize_str($in['inn'] ?? '', 20), sanitize_str($in['kpp'] ?? '', 20),
            sanitize_str($in['phone'] ?? '', 30), sanitize_str($in['address'] ?? '', 300),
            'wholesale', 'pending'
        ]);
        $user = db()->query("SELECT * FROM users WHERE id=" . (int)db()->lastInsertId())->fetch();
        (new Mailer())->notifyRegistration($user);
        json_out(['ok' => true, 'message' => 'Заявка отправлена. Менеджер свяжется с вами.']);
    } catch (PDOException $e) {
        json_out(['error' => 'Email уже зарегистрирован'], 409);
    }
}

if ($action === 'login') {
    require_method('POST');
    rate_limit('login:' . client_ip(), 10, 300);
    $in = json_input();
    $email = strtolower(trim((string)($in['email'] ?? '')));
    $st = db()->prepare("SELECT * FROM users WHERE email=?");
    $st->execute([$email]);
    $u = $st->fetch();
    if (!$u || !password_verify((string)($in['password'] ?? ''), $u['password_hash'])) {
        json_out(['error' => 'Неверный email или пароль'], 401);
    }
    if ($u['status'] === 'blocked') json_out(['error' => 'Аккаунт заблокирован'], 403);
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$u['id'];
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    json_out(['ok' => true, 'user' => [
        'id' => (int)$u['id'], 'email' => $u['email'], 'company' => $u['company'],
        'role' => $u['role'], 'status' => $u['status']
    ], 'csrf' => $_SESSION['csrf']]);
}

if ($action === 'me') {
    $u = current_user();
    json_out(['user' => $u, 'csrf' => $_SESSION['csrf'] ?? csrf_token()]);
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    json_out(['ok' => true]);
}

json_out(['error' => 'Unknown action'], 404);