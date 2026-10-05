<?php
return [
    'db_path'      => __DIR__ . '/../data/trackshop.sqlite',
    'uploads_dir'  => __DIR__ . '/../uploads',
    'invoices_dir' => __DIR__ . '/../data/invoices',

    // Дефолтный админ: admin / admin  (СМЕНИ сразу!)
    'admin_login'    => 'admin',
    'admin_password' => 'admin',

    // SMTP
    'smtp' => [
        'enabled'   => false,
        'host'      => 'smtp.mail.ru',
        'port'      => 465,
        'secure'    => 'ssl',
        'user'      => 'noreply@trackshop.pro',
        'pass'      => 'SMTP_PASSWORD',
        'from'      => 'noreply@trackshop.pro',
        'from_name' => 'TrackShop',
        'manager'   => 'sales@trackshop.pro',
    ],

    // Компания для счетов
    'company' => [
        'name'    => 'ООО «ТракШоп»',
        'inn'     => '7700000000',
        'kpp'     => '770001001',
        'ogrn'    => '1157746000000',
        'address' => 'г. Москва, ул. Складская, 1',
        'bank'    => 'АО «Тинькофф Банк»',
        'bik'     => '044525974',
        'account' => '40702810000000000001',
        'phone'   => '+7 (800) 000-00-00',
        'email'   => 'opt@trackshop.pro',
        'site'    => 'trackshop.pro',
    ],

    // VAPID (npx web-push generate-vapid-keys)
    'vapid' => [
        'public'  => 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
        'private' => 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls',
        'subject' => 'mailto:admin@trackshop.pro',
    ],

    'session_name'  => 'trackshop_sid',
    'cookie_secure' => false,
    'log_file'      => __DIR__ . '/../data/app.log',
];