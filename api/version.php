<?php
header('Content-Type: application/json');
echo json_encode(['version' => '2026-10-05-001', 'time' => date('Y-m-d H:i:s')]);