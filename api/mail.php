<?php
declare(strict_types=1);

class Mailer {
    private array $cfg;

    public function __construct() {
        global $CONFIG;
        $this->cfg = $CONFIG['smtp'];
    }

    public function send(string $to, string $subject, string $html, array $attach = []): bool {
        if (empty($this->cfg['enabled'])) {
            log_msg('Mail skipped (disabled)', ['to' => $to, 'subject' => $subject]);
            return false;
        }
        try {
            $this->smtpSend($to, $subject, $html, $attach);
            return true;
        } catch (Throwable $e) {
            log_msg('Mail error: ' . $e->getMessage(), ['to' => $to]);
            return false;
        }
    }

    private function smtpSend(string $to, string $subject, string $html, array $attach): void {
        $host = $this->cfg['host'];
        $port = (int)$this->cfg['port'];
        $secure = $this->cfg['secure'] ?? 'ssl';
        $prefix = $secure === 'ssl' ? 'ssl://' : '';

        $fp = @stream_socket_client("$prefix$host:$port", $errno, $errstr, 15);
        if (!$fp) throw new RuntimeException("SMTP connect: $errstr");

        $read = function() use ($fp) {
            $d = '';
            while ($line = fgets($fp, 515)) {
                $d .= $line;
                if (isset($line[3]) && $line[3] === ' ') break;
            }
            return $d;
        };
        $cmd = function($c) use ($fp, $read) {
            fwrite($fp, $c . "\r\n");
            return $read();
        };

        $read();
        $cmd('EHLO ' . ($_SERVER['HTTP_HOST'] ?? 'localhost'));
        if ($secure === 'tls') {
            $cmd('STARTTLS');
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('STARTTLS failed');
            }
            $cmd('EHLO ' . ($_SERVER['HTTP_HOST'] ?? 'localhost'));
        }
        $cmd('AUTH LOGIN');
        $cmd(base64_encode($this->cfg['user']));
        $cmd(base64_encode($this->cfg['pass']));
        $cmd('MAIL FROM:<' . $this->cfg['from'] . '>');
        $cmd("RCPT TO:<$to>");
        $cmd('DATA');

        $boundary = '=_ts_' . bin2hex(random_bytes(8));
        $headers  = "From: =?UTF-8?B?" . base64_encode($this->cfg['from_name']) . "?= <{$this->cfg['from']}>\r\n";
        $headers .= "To: <$to>\r\n";
        $headers .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Date: " . date('r') . "\r\n";
        $headers .= "Message-ID: <" . bin2hex(random_bytes(12)) . "@{$this->cfg['from']}>\r\n";

        if ($attach) {
            $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";
            $body = "--$boundary\r\n";
            $body .= "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
            $body .= chunk_split(base64_encode($html)) . "\r\n";
            foreach ($attach as $a) {
                $body .= "--$boundary\r\n";
                $body .= "Content-Type: {$a['mime']}; name=\"{$a['name']}\"\r\n";
                $body .= "Content-Transfer-Encoding: base64\r\n";
                $body .= "Content-Disposition: attachment; filename=\"{$a['name']}\"\r\n\r\n";
                $body .= chunk_split(base64_encode($a['data'])) . "\r\n";
            }
            $body .= "--$boundary--\r\n";
        } else {
            $headers .= "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n";
            $body = chunk_split(base64_encode($html));
        }

        fwrite($fp, $headers . "\r\n" . $body . "\r\n.\r\n");
        $read();
        $cmd('QUIT');
        fclose($fp);
    }

    /* ---------- Шаблоны писем ---------- */

    public function notifyRegistration(array $u, bool $isWholesale): void {
        $type = $isWholesale ? 'оптового' : 'розничного';
        $body = $this->wrap("
            <h2>Здравствуйте, {$u['company']}!</h2>
            <p>Ваша заявка на регистрацию в {$type} портале <b>TrackShop</b> получена.</p>
            <p><b>Логин:</b> {$u['email']}</p>
            " . ($isWholesale
                ? "<p>Менеджер проверит данные и активирует доступ к <b>оптовым ценам</b> в течение 1 рабочего дня.</p>"
                : "<p>Можете сразу приступать к покупкам по розничным ценам.</p>"
            ) . "
        ");
        $this->send($u['email'], 'TrackShop: регистрация принята', $body);

        global $CONFIG;
        $this->send($CONFIG['smtp']['manager'], "TrackShop: новая регистрация — {$u['company']}", $this->wrap("
            <h2>Новая регистрация</h2>
            <p><b>Компания:</b> {$u['company']}</p>
            <p><b>Тип:</b> " . ($isWholesale ? 'Опт (юрлицо)' : 'Розница') . "</p>
            <p><b>ИНН:</b> {$u['inn']}</p>
            <p><b>Email:</b> {$u['email']}</p>
            <p><b>Телефон:</b> {$u['phone']}</p>
        "));
    }

    public function notifyActivated(array $u): void {
        $this->send($u['email'], 'TrackShop: доступ к оптовым ценам активирован', $this->wrap("
            <h2>Оптовый доступ активирован! 🎉</h2>
            <p>Теперь вам доступны <b>оптовые цены</b> и оформление оптовых заказов.</p>
        "));
    }

    public function notifyOrderCreated(array $order, array $u, array $items, ?string $pdfPath = null): void {
        $rows = '';
        foreach ($items as $it) {
            $rows .= "<tr>
                <td style=\"padding:8px;border-bottom:1px solid #eee\">{$it['sku']}</td>
                <td style=\"padding:8px;border-bottom:1px solid #eee\">{$it['name']}</td>
                <td style=\"padding:8px;border-bottom:1px solid #eee;text-align:center\">{$it['qty']}</td>
                <td style=\"padding:8px;border-bottom:1px solid #eee;text-align:right\">" . money((float)$it['price']) . " ₽</td>
                <td style=\"padding:8px;border-bottom:1px solid #eee;text-align:right\"><b>" . money((float)$it['sum']) . " ₽</b></td>
            </tr>";
        }
        $priceLabel = $order['price_type'] === 'wholesale' ? 'Оптовые цены' : 'Розничные цены';

        $html = $this->wrap("
            <h2>Заказ №{$order['order_number']} принят</h2>
            <p>Здравствуйте, {$u['company']}!</p>
            <p><b>{$priceLabel}</b>. Сумма: <b>" . money((float)$order['total']) . " ₽</b> с НДС.</p>
            <table style=\"width:100%;border-collapse:collapse;margin:20px 0;font-size:14px\">
                <thead><tr style=\"background:#f5f5f5\">
                    <th style=\"padding:8px;text-align:left\">SKU</th>
                    <th style=\"padding:8px;text-align:left\">Товар</th>
                    <th style=\"padding:8px\">Кол-во</th>
                    <th style=\"padding:8px;text-align:right\">Цена</th>
                    <th style=\"padding:8px;text-align:right\">Сумма</th>
                </tr></thead>
                <tbody>$rows</tbody>
            </table>
        ");
        $attach = [];
        if ($pdfPath && is_file($pdfPath)) {
            $attach[] = [
                'name' => "invoice-{$order['order_number']}.pdf",
                'mime' => 'application/pdf',
                'data' => file_get_contents($pdfPath),
            ];
        }
        $this->send($u['email'], "TrackShop: заказ №{$order['order_number']}", $html, $attach);

        global $CONFIG;
        $this->send($CONFIG['smtp']['manager'], "Новый заказ №{$order['order_number']} — {$u['company']}", $html, $attach);
    }

    public function notifyStatusChanged(array $order, array $u, string $status): void {
        $label = order_status_label($status);
        $this->send($u['email'], "TrackShop: заказ №{$order['order_number']}", $this->wrap("
            <h2>Статус заказа изменён</h2>
            <p>Заказ <b>№{$order['order_number']}</b> — новый статус: <b>{$label}</b>.</p>
        "));
    }

    private function wrap(string $content): string {
        $c = $GLOBALS['CONFIG']['company'];
        return "<!DOCTYPE html><html><body style=\"margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#222\">
        <div style=\"max-width:640px;margin:0 auto;background:#fff\">
            <div style=\"background:#0d0d0d;padding:24px;text-align:center\">
                <div style=\"font-size:24px;font-weight:800;color:#fff\">🚛 Track<span style=\"color:#ff7a00\">Shop</span></div>
            </div>
            <div style=\"padding:28px;line-height:1.6;font-size:15px\">$content</div>
            <div style=\"background:#f9f9f9;padding:20px;text-align:center;color:#888;font-size:12px\">
                {$c['name']} · ИНН {$c['inn']} · {$c['phone']} · {$c['email']}
            </div>
        </div></body></html>";
    }
}