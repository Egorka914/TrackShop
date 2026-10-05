<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

require_admin();
$action = $_GET['action'] ?? 'list';

if ($action === 'list') {
    $rows = db()->query("SELECT id,email,company,inn,kpp,phone,role,status,created_at
                         FROM users ORDER BY id DESC")->fetchAll();
    json_out(['users' => $rows]);
}

if ($action === 'status') {
    require_method('POST');
    csrf_check();
    $in = json_input();
    $allowed = ['pending','active','blocked'];
    if (!in_array($in['status'] ?? '', $allowed, true)) json_out(['error' => 'Bad status'], 400);

    db()->prepare("UPDATE users SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
        ->execute([$in['status'], (int)$in['id']]);

    if ($in['status'] === 'active') {
        $user = db()->query("SELECT * FROM users WHERE id=" . (int)$in['id'])->fetch();
        try { (new Mailer())->notifyActivated($user); } catch (Throwable $e) { log_msg('mail activate: ' . $e->getMessage()); }
    }
    json_out(['ok' => true]);
}

json_out(['error' => 'Unknown'], 404);