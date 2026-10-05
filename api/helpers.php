<?php
declare(strict_types=1);

function json_out($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_input(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return $_POST ?: [];
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

function require_method(string ...$methods): void {
    $m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($m, $methods, true)) json_out(['error' => 'Method not allowed'], 405);
}

function csrf_token(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

function csrf_check(): void {
    $tok = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!hash_equals($_SESSION['csrf'] ?? '', (string)$tok)) {
        json_out(['error' => 'CSRF token invalid'], 403);
    }
}

function client_ip(): string {
    return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function rate_limit(string $key, int $limit, int $window): void {
    $file = sys_get_temp_dir() . '/ts_rl_' . md5($key);
    $now = time();
    $data = is_file($file) ? (json_decode((string)file_get_contents($file), true) ?: []) : [];
    $data = array_values(array_filter($data, fn($t) => $t > $now - $window));
    if (count($data) >= $limit) json_out(['error' => 'Слишком много запросов. Попробуйте позже.'], 429);
    $data[] = $now;
    file_put_contents($file, json_encode($data));
}

function log_msg(string $msg, array $ctx = []): void {
    global $CONFIG;
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg;
    if ($ctx) $line .= ' ' . json_encode($ctx, JSON_UNESCAPED_UNICODE);
    @file_put_contents($CONFIG['log_file'], $line . PHP_EOL, FILE_APPEND);
}

function valid_email(string $e): bool { return (bool)filter_var($e, FILTER_VALIDATE_EMAIL); }

function sanitize_str(string $s, int $max = 255): string {
    return mb_substr(trim(strip_tags($s)), 0, $max);
}

function current_user(): ?array {
    if (empty($_SESSION['uid'])) return null;
    static $cache = null;
    $uid = (int)$_SESSION['uid'];
    if ($cache && $cache['id'] === $uid) return $cache;
    $st = db()->prepare("SELECT id,email,company,inn,kpp,phone,address,role,status FROM users WHERE id=?");
    $st->execute([$uid]);
    $cache = $st->fetch() ?: null;
    return $cache;
}

function require_auth(): array {
    $u = current_user();
    if (!$u) json_out(['error' => 'Требуется авторизация'], 401);
    if ($u['status'] === 'blocked') json_out(['error' => 'Аккаунт заблокирован'], 403);
    return $u;
}

function require_admin(): array {
    $u = require_auth();
    if ($u['role'] !== 'admin') json_out(['error' => 'Доступ запрещён'], 403);
    return $u;
}

/** Может ли текущий пользователь видеть оптовые цены? */
function can_see_wholesale(?array $u): bool {
    if (!$u) return false;
    if ($u['role'] === 'admin') return true;
    if ($u['role'] === 'wholesale' && $u['status'] === 'active') return true;
    return false;
}

/** Какую цену показывать пользователю */
function price_for_user(array $product, ?array $u): array {
    if (can_see_wholesale($u)) {
        return [
            'price' => (float)$product['price_wholesale'],
            'type'  => 'wholesale',
            'label' => 'Оптовая цена',
        ];
    }
    return [
        'price' => (float)$product['price_retail'],
        'type'  => 'retail',
        'label' => 'Розничная цена',
    ];
}

function money(float $v): string { return number_format($v, 2, '.', ' '); }

function order_status_label(string $s): string {
    return [
        'new'       => 'Новый',
        'confirmed' => 'Подтверждён',
        'paid'      => 'Оплачен',
        'shipped'   => 'Отгружен',
        'done'      => 'Выполнен',
        'cancelled' => 'Отменён',
    ][$s] ?? $s;
}

function order_number(): string {
    return 'TS-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
}