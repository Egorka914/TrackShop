<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$action = $_GET['action'] ?? 'list';
$u = current_user();

if ($action === 'list') {
    $rows = db()->query("SELECT * FROM products WHERE is_active=1 ORDER BY id DESC")->fetchAll();
    $showWholesale = can_see_wholesale($u);

    foreach ($rows as &$r) {
        $r['price_retail']    = (float)$r['price_retail'];
        $r['price_wholesale'] = (float)$r['price_wholesale'];
        $r['stock']           = (int)$r['stock'];

        if ($showWholesale) {
            $r['display_price'] = $r['price_wholesale'];
            $r['price_type']    = 'wholesale';
        } else {
            $r['display_price'] = $r['price_retail'];
            $r['price_type']    = 'retail';
            // Оптовую цену скрываем от розницы
            $r['price_wholesale'] = null;
        }
    }

    json_out([
        'products'      => $rows,
        'show_wholesale'=> $showWholesale,
        'user'          => $u ? ['role'=>$u['role'],'status'=>$u['status'],'company'=>$u['company']] : null,
    ]);
}

if ($action === 'save') {
    require_admin();
    csrf_check();
    $in = json_input();

    $fields = [
        'sku'             => sanitize_str($in['sku'] ?? '', 60),
        'name'            => sanitize_str($in['name'] ?? '', 200),
        'category'        => sanitize_str($in['category'] ?? '', 100),
        'brand'           => sanitize_str($in['brand'] ?? '', 100),
        'description'     => mb_substr(trim(strip_tags($in['description'] ?? '')), 0, 5000),
        'price_retail'    => (float)($in['price_retail'] ?? 0),
        'price_wholesale' => (float)($in['price_wholesale'] ?? 0),
        'stock'           => (int)($in['stock'] ?? 0),
        'min_order'       => max(1, (int)($in['min_order'] ?? 1)),
        'pack_qty'        => max(1, (int)($in['pack_qty'] ?? 1)),
        'unit'            => sanitize_str($in['unit'] ?? 'шт', 20),
        'image_url'       => filter_var($in['image_url'] ?? '', FILTER_SANITIZE_URL),
        'is_active'       => (int)!empty($in['is_active']),
    ];

    if ($fields['sku'] === '' || $fields['name'] === '') json_out(['error' => 'SKU и название обязательны'], 400);
    if ($fields['price_retail'] <= 0) json_out(['error' => 'Розничная цена должна быть > 0'], 400);

    $id = (int)($in['id'] ?? 0);
    try {
        if ($id === 0) {
            $keys = implode(',', array_keys($fields));
            $ph   = rtrim(str_repeat('?,', count($fields)), ',');
            db()->prepare("INSERT INTO products ($keys) VALUES ($ph)")->execute(array_values($fields));
            $id = (int)db()->lastInsertId();
        } else {
            $sets = implode(',', array_map(fn($k) => "$k=?", array_keys($fields)));
            db()->prepare("UPDATE products SET $sets, updated_at=CURRENT_TIMESTAMP WHERE id=?")
                ->execute([...array_values($fields), $id]);
        }
        json_out(['ok' => true, 'id' => $id]);
    } catch (PDOException $e) {
        json_out(['error' => 'SKU уже существует'], 409);
    }
}

if ($action === 'delete') {
    require_admin();
    csrf_check();
    $in = json_input();
    db()->prepare("UPDATE products SET is_active=0 WHERE id=?")->execute([(int)$in['id']]);
    json_out(['ok' => true]);
}

json_out(['error' => 'Unknown action'], 404);