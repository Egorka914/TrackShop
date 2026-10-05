<?php
global $CONFIG;
if (empty($CONFIG['vapid']['public']) || empty($CONFIG['vapid']['private'])) {
    // Значения по умолчанию — замени в config.php
    $CONFIG['vapid'] = [
        'public'  => 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
        'private' => 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls',
        'subject' => 'mailto:admin@trackshop.pro',
    ];
}