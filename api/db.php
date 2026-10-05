<?php
declare(strict_types=1);

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    global $CONFIG;

    foreach ([dirname($CONFIG['db_path']), $CONFIG['uploads_dir'], $CONFIG['invoices_dir']] as $d) {
        if (!is_dir($d)) mkdir($d, 0755, true);
    }

    $pdo = new PDO('sqlite:' . $CONFIG['db_path']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA journal_mode = WAL');
    migrate($pdo, $CONFIG);
    return $pdo;
}

function migrate(PDO $pdo, array $cfg): void {
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        company TEXT NOT NULL,
        inn TEXT DEFAULT '',
        kpp TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        address TEXT DEFAULT '',
        role TEXT DEFAULT 'retail',            -- retail | wholesale | admin
        status TEXT DEFAULT 'active',          -- pending | active | blocked
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT DEFAULT '',
        brand TEXT DEFAULT '',
        description TEXT DEFAULT '',
        price_retail REAL NOT NULL DEFAULT 0,
        price_wholesale REAL NOT NULL DEFAULT 0,
        stock INTEGER DEFAULT 0,
        min_order INTEGER DEFAULT 1,
        pack_qty INTEGER DEFAULT 1,
        unit TEXT DEFAULT 'шт',
        image_url TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'new',
        subtotal REAL NOT NULL DEFAULT 0,
        vat REAL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        delivery_method TEXT DEFAULT 'pickup',
        delivery_address TEXT DEFAULT '',
        comment TEXT DEFAULT '',
        manager_comment TEXT DEFAULT '',
        price_type TEXT DEFAULT 'retail',      -- какая цена применена в заказе
        invoice_path TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        sku TEXT NOT NULL,
        name TEXT NOT NULL,
        unit TEXT DEFAULT 'шт',
        qty INTEGER NOT NULL,
        price REAL NOT NULL,
        sum REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        qty INTEGER NOT NULL,
        UNIQUE(user_id, product_id)
    );
    CREATE TABLE IF NOT EXISTS order_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        note TEXT DEFAULT '',
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
    ");

    // Дефолтный админ: admin / admin
    $st = $pdo->prepare("SELECT id FROM users WHERE role='admin' LIMIT 1");
    $st->execute();
    if (!$st->fetch()) {
        $ins = $pdo->prepare("INSERT INTO users (email,password_hash,company,role,status) VALUES (?,?,?,?,?)");
        $ins->execute([
            $cfg['admin_login'] . '@trackshop.local',
            password_hash($cfg['admin_password'], PASSWORD_DEFAULT),
            'TrackShop HQ',
            'admin',
            'active',
        ]);
        log_msg('Создан дефолтный админ', ['login' => $cfg['admin_login']]);
    }

    // Демо-товары
    if ((int)$pdo->query("SELECT COUNT(*) c FROM products")->fetch()['c'] === 0) {
        $demo = [
            ['TS-001','Зеркало боковое универсальное','Зеркала','MAN','Усиленное зеркало 24V',2600,1850,120,5,4,'шт'],
            ['TS-002','Фара LED 24V 60W','Освещение','Hella','Светодиодная фара дальнего света',4800,3400,80,4,2,'шт'],
            ['TS-003','Коврики резиновые (компл.)','Салон','КАМАЗ','Комплект ковриков',1500,990,200,10,1,'компл'],
            ['TS-004','Фильтр воздушный MAN','Фильтры','MAN','Аналог 81084050024',3100,2200,150,6,1,'шт'],
            ['TS-005','Тахограф цифровой','Электроника','VDO','ЕСТР, с блоком СКЗИ',24000,18500,25,2,1,'шт'],
            ['TS-006','Антифриз G12 20л','Жидкости','CoolStream','Готовый к применению',3900,2800,300,8,1,'канистра'],
            ['TS-007','Щётки стеклоочистителя 600мм','Салон','Bosch','Комплект 2 шт, зимние',1100,750,400,12,2,'компл'],
            ['TS-008','Топливный фильтр Scania','Фильтры','Scania','Оригинал-аналог',2300,1650,90,5,1,'шт'],
        ];
        $ins = $pdo->prepare("INSERT INTO products (sku,name,category,brand,description,price_retail,price_wholesale,stock,min_order,pack_qty,unit) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
        foreach ($demo as $d) $ins->execute($d);
    }
}