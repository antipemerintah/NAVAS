<?php

$csvFile = __DIR__ . '/output_updated.csv';
$sqlFile = __DIR__ . '/harga_barang.sql';

$file = fopen($csvFile, 'r');
$header = fgetcsv($file);

$sql = "INSERT INTO harga_barang (tanggal, nama_barang, harga, current_mayor) VALUES\n";
$rows = [];

$barang = ['GREEN_CANDY','WHITE_GIFT','PURPLE_CANDY','BLUE_SHARK_TOOTH',
           'RED_GIFT','NURSE_SHARK_TOOTH','TIGER_SHARK_TOOTH',
           'SHARK_FIN','GRIFFIN_FEATHER','GREEN_GIFT'];

while (($row = fgetcsv($file)) !== false) {
    $data = array_combine($header, $row);
    $raw = $data['last_updated'];
    $tanggal = substr($raw,0,4).'-'.substr($raw,4,2).'-'.substr($raw,6,2);
    $mayor = addslashes($data['current_mayor']);

    foreach ($barang as $nama) {
        $harga = (int) $data[$nama];
        $rows[] = "('$tanggal', '$nama', $harga, '$mayor')";
    }
}

fclose($file);

$sql .= implode(",\n", $rows) . ';';
file_put_contents($sqlFile, $sql);
echo "Selesai! File: harga_barang.sql\n";