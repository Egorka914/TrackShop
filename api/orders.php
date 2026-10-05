<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/pdf.php';
require_once __DIR__ . '/push_helper.php';

$action = $_GET['action'] ?? '';

// ---- CREATE ----
if ($action === 'create') {
    require_method('POST');
    $u = require_auth();
    csrf_check();

    $pdo = db();
    $st = $pdo->prepare("SELECT c.qty, p.id, p.sku, p.name, p.unit, p.price_retail, p.price_wholesale,
                                p.min_order, p.stock
                         FROM cart c JOIN products p ON p.id=c.product_id
                         WHERE c.user_id=?");
    $st->execute([$u['id']]);
    $items = $st->fetchAll();
    if (!$items) json_out(['error' => 'Корзина пуста'], 400);

    $wholesale = can_see_wholesale($u);
    $in = json_input();
    $subtotal = 0.0;

    foreach ($items as $it) {
        if ($it['qty'] < $it['min_order']) json_out(['error' => "Минимум {$it['min_order']} для «{$it['name']}»"], 400);
        if ($it['qty'] > $it['stock']) json_out(['error' => "Недостаточно товара «{$it['name']}» на складе"], 400);
        $price = $wholesale ? (float)$it['price_wholesale'] : (float)$it['price_retail'];
        $subtotal += $price * $it['qty'];
    }
    $vat = $subtotal * 20 / 120;
    $total = $subtotal;

    $pdo->beginTransaction();
    try {
        $num = order_number();
        $ins = $pdo->prepare("INSERT INTO orders
            (order_number,user_id,status,subtotal,vat,total,delivery_method,delivery_address,comment,price_type)
            VALUES (?,?,?,?,?,?,?,?,?,?)");
        $ins->execute([
            $num, $u['id'], 'new', $subtotal, $vat, $total,
            sanitize_str($in['delivery_method'] ?? 'pickup', 30),
            sanitize_str($in['delivery_address'] ?? '', 300),
            sanitize_str($in['comment'] ?? '', 1000),
            $wholesale ? 'wholesale' : 'retail',
        ]);
        $oid = (int)$pdo->lastInsertId();

        $insI = $pdo->prepare("INSERT INTO order_items (order_id,product_id,sku,name,unit,qty,price,sum) VALUES (?,?,?,?,?,?,?,?)");
        foreach ($items as $it) {
            $price = $wholesale ? (float)$it['price_wholesale'] : (float)$it['price_retail'];
            $insI->execute([$oid, $it['id'], $it['sku'], $it['name'], $it['unit'], $it['qty'], $price, $price * $it['qty']]);
            $pdo->prepare("UPDATE products SET stock=stock-? WHERE id=?")->execute([$it['qty'], $it['id']]);
        }
        $pdo->prepare("INSERT INTO order_history (order_id,status,note,user_id) VALUES (?,?,?,?)")
            ->execute([$oid, 'new', 'Заказ создан клиентом', $u['id']]);
        $pdo->prepare("DELETE FROM cart WHERE user_id=?")->execute([$u['id']]);
        $pdo->commit();

        $order = $pdo->query("SELECT * FROM orders WHERE id=$oid")->fetch();
        $fullU = $pdo->query("SELECT * FROM users WHERE id={$u['id']}")->fetch();
        $fullItems = $pdo->query("SELECT * FROM order_items WHERE order_id=$oid")->fetchAll();

        $pdfBin = build_invoice($order, $fullU, $fullItems);
        $pdfPath = $CONFIG['invoices_dir'] . "/invoice-$num.pdf";
        file_put_contents($pdfPath, $pdfBin);
        $pdo->prepare("UPDATE orders SET invoice_path=? WHERE id=?")->execute([$pdfPath, $oid]);

        try { (new Mailer())->notifyOrderCreated($order, $fullU, $fullItems, $pdfPath); } catch (Throwable $e) { log_msg('mail order: ' . $e->getMessage()); }

        // Push админу
        try {
            send_push_to_all(
                '🛒 Новый заказ ' . $num,
                $fullU['company'] . ' — ' . number_format($total, 2, '.', ' ') . ' ₽' . ($wholesale ? ' (опт)' : ''),
                $oid
            );
        } catch (Throwable $e) { log_msg('push order: ' . $e->getMessage()); }

        json_out(['ok' => true, 'order_number' => $num, 'id' => $oid]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        log_msg('Order create failed: ' . $e->getMessage());
        json_out(['error' => 'Ошибка создания заказа'], 500);
    }
}

// ---- MY ----
if ($action === 'my') {
    $u = require_auth();
    $st = db()->prepare("SELECT * FROM orders WHERE user_id=? ORDER BY id DESC");
    $st->execute([$u['id']]);
    $orders = $st->fetchAll();
    foreach ($orders as &$o) {
        $s = db()->prepare("SELECT * FROM order_items WHERE order_id=?");
        $s->execute([$o['id']]);
        $o['items'] = $s->fetchAll();
    }
    json_out(['orders' => $orders]);
}

// ---- INVOICE PDF ----
if ($action === 'invoice') {
    $u = require_auth();
    $id = (int)($_GET['id'] ?? 0);
    $st = db()->prepare("SELECT * FROM orders WHERE id=?");
    $st->execute([$id]);
    $o = $st->fetch();
    if (!$o) json_out(['error' => 'Not found'], 404);
    if ($o['user_id'] != $u['id'] && $u['role'] !== 'admin') json_out(['error' => 'Forbidden'], 403);

    $path = $o['invoice_path'];
    if (!$path || !is_file($path)) {
        $user = db()->query("SELECT * FROM users WHERE id={$o['user_id']}")->fetch();
        $items = db()->query("SELECT * FROM order_items WHERE order_id={$o['id']}")->fetchAll();
        $pdfBin = build_invoice($o, $user, $items);
        $path = $CONFIG['invoices_dir'] . "/invoice-{$o['order_number']}.pdf";
        file_put_contents($path, $pdfBin);
        db()->prepare("UPDATE orders SET invoice_path=? WHERE id=?")->execute([$path, $o['id']]);
    }
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="invoice-' . $o['order_number'] . '.pdf"');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

// ---- ADMIN: LIST ----
if ($action === 'list') {
    require_admin();
    $status = $_GET['status'] ?? '';
    $q = $_GET['q'] ?? '';
    $sql = "SELECT o.*, u.company, u.email, u.phone, u.inn, u.role AS user_role
            FROM orders o JOIN users u ON u.id=o.user_id WHERE 1=1";
    $p = [];
    if ($status) { $sql .= " AND o.status=?"; $p[] = $status; }
    if ($q) { $sql .= " AND (o.order_number LIKE ? OR u.company LIKE ? OR u.email LIKE ?)"; $p[] = "%$q%"; $p[] = "%$q%"; $p[] = "%$q%"; }
    $sql .= " ORDER BY o.id DESC LIMIT 500";
    $st = db()->prepare($sql);
    $st->execute($p);
    $orders = $st->fetchAll();
    foreach ($orders as &$o) {
        $s = db()->prepare("SELECT * FROM order_items WHERE order_id=?");
        $s->execute([$o['id']]);
        $o['items'] = $s->fetchAll();
    }
    json_out(['orders' => $orders]);
}

if ($action === 'update_status') {
    require_admin();
    csrf_check();
    $in = json_input();
    $allowed = ['new','confirmed','paid','shipped','done','cancelled'];
    if (!in_array($in['status'] ?? '', $allowed, true)) json_out(['error' => 'Bad status'], 400);

    $oid = (int)$in['id'];
    $pdo = db();
    $pdo->prepare("UPDATE orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
        ->execute([$in['status'], $oid]);
    $pdo->prepare("INSERT INTO order_history (order_id,status,note,user_id) VALUES (?,?,?,?)")
        ->execute([$oid, $in['status'], sanitize_str($in['note'] ?? '', 500), $_SESSION['uid']]);

    $order = $pdo->query("SELECT * FROM orders WHERE id=$oid")->fetch();
    $user  = $pdo->query("SELECT * FROM users WHERE id={$order['user_id']}")->fetch();
    try { (new Mailer())->notifyStatusChanged($order, $user, $in['status']); } catch (Throwable $e) { log_msg('mail status: ' . $e->getMessage()); }

    json_out(['ok' => true]);
}

if ($action === 'history') {
    require_admin();
    $st = db()->prepare("SELECT h.*, u.email AS user_email FROM order_history h
                         LEFT JOIN users u ON u.id=h.user_id
                         WHERE h.order_id=? ORDER BY h.id DESC");
    $st->execute([(int)$_GET['id']]);
    json_out(['history' => $st->fetchAll()]);
}

if ($action === 'stats') {
    require_admin();
    $pdo = db();
    json_out(['stats' => [
        'orders_total'  => (int)$pdo->query("SELECT COUNT(*) c FROM orders")->fetch()['c'],
        'orders_new'    => (int)$pdo->query("SELECT COUNT(*) c FROM orders WHERE status='new'")->fetch()['c'],
        'orders_done'   => (int)$pdo->query("SELECT COUNT(*) c FROM orders WHERE status='done'")->fetch()['c'],
        'revenue'       => (float)$pdo->query("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status IN ('paid','shipped','done')")->fetch()['s'],
        'users_total'   => (int)$pdo->query("SELECT COUNT(*) c FROM users WHERE role!='admin'")->fetch()['c'],
        'users_pending' => (int)$pdo->query("SELECT COUNT(*) c FROM users WHERE status='pending'")->fetch()['c'],
        'products'      => (int)$pdo->query("SELECT COUNT(*) c FROM products WHERE is_active=1")->fetch()['c'],
    ]]);
}

json_out(['error' => 'Unknown'], 404);