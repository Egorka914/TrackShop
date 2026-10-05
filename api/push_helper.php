<?php
declare(strict_types=1);

require_once __DIR__ . '/push_config.php';

function send_push_to_all(string $title, string $body, ?int $orderId = null, string $url = '/admin.html'): array {
    global $CONFIG;

    $autoload = __DIR__ . '/../vendor/autoload.php';
    if (!is_file($autoload)) {
        log_msg('Push skipped: composer not installed');
        return ['success' => false, 'error' => 'composer missing'];
    }
    require_once $autoload;

    $subs = db()->query("SELECT * FROM push_subscriptions")->fetchAll();
    if (!$subs) return ['success' => false, 'error' => 'no subscriptions'];

    $payload = json_encode([
        'title'   => $title,
        'body'    => $body,
        'orderId' => $orderId,
        'url'     => $url,
    ], JSON_UNESCAPED_UNICODE);

    $auth = [
        'VAPID' => [
            'subject'    => $CONFIG['vapid']['subject'],
            'publicKey'  => $CONFIG['vapid']['public'],
            'privateKey' => $CONFIG['vapid']['private'],
        ],
    ];

    $sent = 0; $failed = 0; $dead = [];

    try {
        $webPush = new \Minishlink\WebPush\WebPush($auth);
        foreach ($subs as $row) {
            $sub = \Minishlink\WebPush\Subscription::create([
                'endpoint'  => $row['endpoint'],
                'publicKey' => $row['p256dh'],
                'authToken' => $row['auth'],
            ]);
            $webPush->queueNotification($sub, $payload);
        }
        foreach ($webPush->flush() as $report) {
            if ($report->isSuccess()) {
                $sent++;
            } else {
                $failed++;
                $code = $report->getResponse() ? $report->getResponse()->getStatusCode() : 0;
                if ($code === 404 || $code === 410) {
                    $dead[] = $report->getEndpoint();
                }
            }
        }
    } catch (Throwable $e) {
        log_msg('Push error: ' . $e->getMessage());
        return ['success' => false, 'error' => $e->getMessage()];
    }

    if ($dead) {
        $ph = implode(',', array_fill(0, count($dead), '?'));
        db()->prepare("DELETE FROM push_subscriptions WHERE endpoint IN ($ph)")->execute($dead);
    }

    return ['success' => true, 'sent' => $sent, 'failed' => $failed, 'removed' => count($dead)];
}