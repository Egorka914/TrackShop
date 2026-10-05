<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/excel.php';

require_admin();
$type = $_GET['type'] ?? '';

if ($type === 'orders') {
    $orders = db()->query("SELECT o.*, u.company, u.email, u.inn, u.phone, u.role AS user_role
                          FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC")->fetchAll();
    $rows = array_map(fn($o) => [
        $o['order_number'], $o['created_at'], $o['company'], $o['inn'], $o['email'], $o['phone'],
        $o['price_type'] === 'wholesale' ? 'Опт' : 'Розница',
        order_status_label($o['status']),
        number_format((float)$o['subtotal'], 2, '.', ''),
        number_format((float)$o['vat'], 2, '.', ''),
        number_format((float)$o['total'], 2, '.', ''),
    ], $orders);
    excel_download('orders-' . date('Y-m-d') . '.xls', 'Заказы',
        ['№', 'Дата', 'Компания', 'ИНН', 'Email', 'Телефон', 'Тип цены', 'Статус', 'Без НДС', 'НДС', 'Итого'],
        $rows);
}

if ($type === 'products') {
    $rows = [];
    foreach (db()->query("SELECT * FROM products ORDER BY id")->fetchAll() as $p) {
        $rows[] = [$p['sku'], $p['name'], $p['category'], $p['brand'],
                   $p['price_retail'], $p['price_wholesale'], $p['stock'],
                   $p['min_order'], $p['unit'], $p['is_active'] ? 'да' : 'нет'];
    }
    excel_download('products-' . date('Y-m-d') . '.xls', 'Товары',
        ['SKU', 'Название', 'Категория', 'Бренд', 'Розница', 'Опт', 'Остаток', 'Мин.', 'Ед.', 'Активен'],
        $rows);
}

if ($type === 'users') {
    $rows = [];
    foreach (db()->query("SELECT * FROM users ORDER BY id")->fetchAll() as $u) {
        $rows[] = [$u['id'], $u['company'], $u['email'], $u['inn'], $u['kpp'],
                   $u['phone'], $u['role'], $u['status'], $u['created_at']];
    }
    excel_download('users-' . date('Y-m-d') . '.xls', 'Клиенты',
        ['ID', 'Компания', 'Email', 'ИНН', 'КПП', 'Телефон', 'Роль', 'Статус', 'Дата'],
        $rows);
}

if ($type === 'order_items') {
    $id = (int)($_GET['order_id'] ?? 0);
    $items = db()->prepare("SELECT * FROM order_items WHERE order_id=?");
    $items->execute([$id]);
    $items = $items->fetchAll();
    $rows = array_map(fn($i) => [$i['sku'], $i['name'], $i['unit'], $i['qty'], $i['price'], $i['sum']], $items);
    excel_download("order-$id-items.xls", "Позиции", ['SKU', 'Наименование', 'Ед.', 'Кол-во', 'Цена', 'Сумма'], $rows);
}

json_out(['error' => 'Unknown export type'], 400);