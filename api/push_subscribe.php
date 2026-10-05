ф<?php
require_once __DIR__ . '/bootstrap.php';

$action = $_GET['action'] ?? 'subscribe';

if ($action === 'subscribe') {
    require_method('POST');
    $in = json_input();
    $sub = $in['subscription'] ?? null;
    if (!$sub || empty($sub['endpoint']) || empty($sub['keys']['p256dh']) || empty($sub['keys']['auth'])) {
        json_out(['error' => 'Неверная подписка'], 400);
    }
    db()->prepare("INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth, user_agent) VALUES (?,?,?,?)")
        ->execute([$sub['endpoint'], $sub['keys']['p256dh'], $sub['keys']['auth'], $_SERVER['HTTP_USER_AGENT'] ?? '']);
    json_out(['success' => true]);
}

if ($action === 'unsubscribe') {
    require_method('POST');
    $in = json_input();
    if (!empty($in['endpoint'])) {
        db()->prepare("DELETE FROM push_subscriptions WHERE endpoint=?")->execute([$in['endpoint']]);
    }
    json_out(['success' => true]);
}

if ($action === 'count') {
    $c = (int)db()->query("SELECT COUNT(*) c FROM push_subscriptions")->fetch()['c'];
    json_out(['count' => $c]);
}

json_out(['error' => 'Unknown action'], 404);