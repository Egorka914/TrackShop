<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$u = require_auth();
$action = $_GET['action'] ?? 'list';

if ($action === 'list') {
    $st = db()->prepare("SELECT c.qty, p.id, p.sku, p.name, p.unit, p.stock, p.min_order, p.pack_qty,
                                p.price_retail, p.price_wholesale, p.image_url
                         FROM cart c JOIN products p ON p.id=c.product_id
                         WHERE c.user_id=?");
    $st->execute([$u['id']]);
    $rows = $st->fetchAll();

    $wholesale = can_see_wholesale($u);
    foreach ($rows as &$r) {
        $r['price']      = $wholesale ? (float)$r['price_wholesale'] : (float)$r['price_retail'];
        $r['price_type'] = $wholesale ? 'wholesale' : 'retail';
    }
    json_out(['items' => $rows, 'price_type' => $wholesale ? 'wholesale' : 'retail']);
}

if ($action === 'add' || $action === 'update' || $action === 'remove') {
    require_method('POST');
    csrf_check();
    $in  = json_input();
    $pid = (int)($in['product_id'] ?? 0);
    $qty = max(1, (int)($in['qty'] ?? 1));
    if ($pid <= 0) json_out(['error' => 'Invalid product'], 400);

    if ($action === 'add') {
        db()->prepare("INSERT INTO cart (user_id,product_id,qty) VALUES (?,?,?)
                       ON CONFLICT(user_id,product_id) DO UPDATE SET qty=qty+excluded.qty")
            ->execute([$u['id'], $pid, $qty]);
    } elseif ($action === 'update') {
        db()->prepare("UPDATE cart SET qty=? WHERE user_id=? AND product_id=?")
            ->execute([$qty, $u['id'], $pid]);
    } else {
        db()->prepare("DELETE FROM cart WHERE user_id=? AND product_id=?")
            ->execute([$u['id'], $pid]);
    }
    json_out(['ok' => true]);
}

json_out(['error' => 'Unknown'], 404);