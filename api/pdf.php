<?php
declare(strict_types=1);

class InvoicePDF {
    private float $y = 0;
    private float $pageW = 595;
    private float $pageH = 842;
    private float $marginL = 40;
    private float $marginR = 40;
    private array $ops = [];
    private array $company;

    public function __construct(array $company) { $this->company = $company; }

    public function render(array $order, array $user, array $items): string {
        $this->y = $this->pageH - 60;
        $this->drawHeader($order);
        $this->drawSupplierBuyer($user);
        $this->drawTable($items);
        $this->drawTotals($order);
        $this->drawBank($order);
        $this->drawSignature();
        return $this->buildPdf();
    }

    private function text(float $x, float $y, string $s, float $size = 10, string $font = 'F1', array $rgb = [0,0,0]): void {
        $s = $this->escape($s);
        $color = sprintf('%.3f %.3f %.3f rg', $rgb[0]/255, $rgb[1]/255, $rgb[2]/255);
        $this->ops[] = "BT /$font $size Tf $color 1 0 0 1 $x $y Tm ($s) Tj ET";
    }
    private function textR(float $xr, float $y, string $s, float $size = 10, string $font = 'F1', array $rgb = [0,0,0]): void {
        $w = strlen($s) * $size * 0.52;
        $this->text($xr - $w, $y, $s, $size, $font, $rgb);
    }
    private function line(float $x1, float $y1, float $x2, float $y2, array $rgb = [200,200,200], float $w = 0.5): void {
        $c = sprintf('%.3f %.3f %.3f RG', $rgb[0]/255, $rgb[1]/255, $rgb[2]/255);
        $this->ops[] = "$c $w w $x1 $y1 m $x2 $y2 l S";
    }
    private function rect(float $x, float $y, float $w, float $h, array $rgb): void {
        $c = sprintf('%.3f %.3f %.3f rg', $rgb[0]/255, $rgb[1]/255, $rgb[2]/255);
        $this->ops[] = "$c $x $y $w $h re f";
    }

    private function escape(string $s): string {
        $s = $this->translit($s);
        return str_replace(['\\','(',')'], ['\\\\','\\(','\\)'], $s);
    }
    private function translit(string $s): string {
        $m = ['а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','е'=>'e','ё'=>'yo','ж'=>'zh','з'=>'z','и'=>'i','й'=>'y','к'=>'k','л'=>'l','м'=>'m','н'=>'n','о'=>'o','п'=>'p','р'=>'r','с'=>'s','т'=>'t','у'=>'u','ф'=>'f','х'=>'kh','ц'=>'ts','ч'=>'ch','ш'=>'sh','щ'=>'shch','ъ'=>'','ы'=>'y','ь'=>'','э'=>'e','ю'=>'yu','я'=>'ya',
            'А'=>'A','Б'=>'B','В'=>'V','Г'=>'G','Д'=>'D','Е'=>'E','Ё'=>'Yo','Ж'=>'Zh','З'=>'Z','И'=>'I','Й'=>'Y','К'=>'K','Л'=>'L','М'=>'M','Н'=>'N','О'=>'O','П'=>'P','Р'=>'R','С'=>'S','Т'=>'T','У'=>'U','Ф'=>'F','Х'=>'Kh','Ц'=>'Ts','Ч'=>'Ch','Ш'=>'Sh','Щ'=>'Shch','Ъ'=>'','Ы'=>'Y','Ь'=>'','Э'=>'E','Ю'=>'Yu','Я'=>'Ya',
            '№'=>'N°','—'=>'-','–'=>'-','«'=>'"','»'=>'"','₽'=>'rub.'];
        return strtr($s, $m);
    }

    private function drawHeader(array $order): void {
        $this->text($this->marginL, $this->y, 'SCHET NA OPLATU', 18, 'F2');
        $this->y -= 16;
        $this->text($this->marginL, $this->y, "No {$order['order_number']} ot " . date('d.m.Y', strtotime($order['created_at'])), 11);
        $this->textR($this->pageW - $this->marginR, $this->pageH - 60, $this->company['name'], 12, 'F2');
        $this->textR($this->pageW - $this->marginR, $this->pageH - 76, 'INN ' . $this->company['inn'] . ' / KPP ' . $this->company['kpp'], 9);
        $this->textR($this->pageW - $this->marginR, $this->pageH - 90, $this->company['address'], 9);
        $this->y = $this->pageH - 140;
        $this->line($this->marginL, $this->y, $this->pageW - $this->marginR, $this->y);
        $this->y -= 24;
    }
    private function drawSupplierBuyer(array $user): void {
        $rows = [
            ['Postavshchik:', $this->company['name']],
            ['Pokupatel:', $user['company']],
            ['INN/KPP:', ($user['inn'] ?: '-') . ' / ' . ($user['kpp'] ?? '-')],
            ['Adres:', $user['address'] ?: '-'],
        ];
        foreach ($rows as $r) {
            $this->text($this->marginL, $this->y, $r[0], 10, 'F2');
            $this->text($this->marginL + 90, $this->y, $r[1], 10);
            $this->y -= 14;
        }
        $this->y -= 10;
    }
    private function drawTable(array $items): void {
        $x = $this->marginL;
        $w = $this->pageW - $this->marginL - $this->marginR;
        $this->rect($x, $this->y - 16, $w, 18, [245,245,245]);
        $this->text($x + 4, $this->y - 10, 'No', 9, 'F2');
        $this->text($x + 22, $this->y - 10, 'Naimenovanie', 9, 'F2');
        $this->text($x + 260, $this->y - 10, 'SKU', 9, 'F2');
        $this->text($x + 340, $this->y - 10, 'Kol-vo', 9, 'F2');
        $this->text($x + 390, $this->y - 10, 'Tsena', 9, 'F2');
        $this->text($x + 450, $this->y - 10, 'Summa', 9, 'F2');
        $this->y -= 20;

        $n = 1;
        foreach ($items as $it) {
            if ($this->y < 220) break;
            $this->text($x + 4, $this->y, (string)$n, 9);
            $this->text($x + 22, $this->y, mb_substr($it['name'], 0, 38), 9);
            $this->text($x + 260, $this->y, $it['sku'], 9);
            $this->text($x + 340, $this->y, $it['qty'] . ' ' . $it['unit'], 9);
            $this->text($x + 390, $this->y, number_format((float)$it['price'], 2, '.', ' '), 9);
            $this->text($x + 450, $this->y, number_format((float)$it['sum'], 2, '.', ' '), 9);
            $this->line($x, $this->y - 4, $x + $w, $this->y - 4, [230,230,230]);
            $this->y -= 18;
            $n++;
        }
        $this->y -= 8;
    }
    private function drawTotals(array $order): void {
        $x = $this->pageW - $this->marginR;
        $this->text($x - 200, $this->y, 'Itogo:', 10, 'F2');
        $this->textR($x, $this->y, number_format((float)$order['subtotal'], 2, '.', ' ') . ' rub.', 10);
        $this->y -= 14;
        $this->text($x - 200, $this->y, 'V t.ch. NDS 20%:', 10, 'F2');
        $this->textR($x, $this->y, number_format((float)$order['vat'], 2, '.', ' ') . ' rub.', 10);
        $this->y -= 14;
        $this->line($x - 200, $this->y + 4, $x, $this->y + 4);
        $this->text($x - 200, $this->y, 'Vsego k oplate:', 12, 'F2');
        $this->textR($x, $this->y, number_format((float)$order['total'], 2, '.', ' ') . ' rub.', 12, 'F2');
        $this->y -= 40;
    }
    private function drawBank(array $order): void {
        $this->text($this->marginL, $this->y, 'Rekvizity dlya oplaty:', 11, 'F2');
        $this->y -= 16;
        $lines = [
            'Poluchatel: ' . $this->company['name'],
            'INN ' . $this->company['inn'] . ' / KPP ' . $this->company['kpp'],
            'Bank: ' . $this->company['bank'],
            'BIK: ' . $this->company['bik'],
            'R/s: ' . $this->company['account'],
            'Naznachenie: Oplata po schetu No' . $order['order_number'],
        ];
        foreach ($lines as $l) {
            $this->text($this->marginL, $this->y, $l, 10);
            $this->y -= 13;
        }
        $this->y -= 20;
    }
    private function drawSignature(): void {
        $this->text($this->marginL, $this->y, 'Rukovoditel', 10, 'F2');
        $this->line($this->marginL + 80, $this->y - 2, $this->marginL + 200, $this->y - 2);
        $this->text($this->marginL + 230, $this->y, 'Bukhgalter', 10, 'F2');
        $this->line($this->marginL + 310, $this->y - 2, $this->marginL + 430, $this->y - 2);
    }
    private function buildPdf(): string {
        $content = implode("\n", $this->ops);
        $objs = [];
        $objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
        $objs[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
        $objs[3] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {$this->pageW} {$this->pageH}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>";
        $objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
        $objs[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
        $objs[6] = "<< /Length " . strlen($content) . " >>\nstream\n$content\nendstream";

        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [0];
        for ($i = 1; $i <= 6; $i++) {
            $offsets[$i] = strlen($pdf);
            $pdf .= "$i 0 obj\n{$objs[$i]}\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 7\n0000000000 65535 f \n";
        for ($i = 1; $i <= 6; $i++) $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
        $pdf .= "trailer << /Size 7 /Root 1 0 R >>\nstartxref\n$xref\n%%EOF";
        return $pdf;
    }
}

function build_invoice(array $order, array $user, array $items): string {
    global $CONFIG;
    return (new InvoicePDF($CONFIG['company']))->render($order, $user, $items);
}