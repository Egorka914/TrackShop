<?php
declare(strict_types=1);

function excel_download(string $filename, string $sheet, array $headers, array $rows): void {
    header('Content-Type: application/vnd.ms-excel; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"$filename\"");
    header('Cache-Control: no-cache');

    $sheet = htmlspecialchars($sheet, ENT_XML1);
    $xml  = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    $xml .= '<?mso-application progid="Excel.Sheet"?>' . "\n";
    $xml .= '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    $xml .= '<Styles><Style ss:ID="hdr"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#FF7A00" ss:Pattern="Solid"/></Style></Styles>';
    $xml .= '<Worksheet ss:Name="' . $sheet . '"><Table>';

    $xml .= '<Row>';
    foreach ($headers as $h) {
        $xml .= '<Cell ss:StyleID="hdr"><Data ss:Type="String">' . htmlspecialchars((string)$h, ENT_XML1) . '</Data></Cell>';
    }
    $xml .= '</Row>';

    foreach ($rows as $r) {
        $xml .= '<Row>';
        foreach ($r as $v) {
            $type = is_numeric($v) && !is_string($v) ? 'Number' : 'String';
            $xml .= '<Cell><Data ss:Type="' . $type . '">' . htmlspecialchars((string)$v, ENT_XML1) . '</Data></Cell>';
        }
        $xml .= '</Row>';
    }
    $xml .= '</Table></Worksheet></Workbook>';
    echo $xml;
    exit;
}