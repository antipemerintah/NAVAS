<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class HargaBarangSeeder extends Seeder
{
    public function run(): void
    {
        // Pindahkan $barang ke luar loop agar tidak dibuat ulang tiap baris
        $barang = [
            'GREEN_CANDY', 'WHITE_GIFT', 'PURPLE_CANDY', 'BLUE_SHARK_TOOTH',
            'RED_GIFT', 'NURSE_SHARK_TOOTH', 'TIGER_SHARK_TOOTH',
            'SHARK_FIN', 'GRIFFIN_FEATHER', 'GREEN_GIFT',
        ];

        $file = fopen(database_path('output_updated.csv'), 'r');
        $header = fgetcsv($file); // skip header

        while (($row = fgetcsv($file)) !== false) {
            $data    = array_combine($header, $row);
            $tanggal = \Carbon\Carbon::createFromFormat('Ymd', $data['last_updated'])->toDateString();
            $mayor   = $data['current_mayor'];

            $bulk = [];
            foreach ($barang as $nama) {
                $bulk[] = [
                    'tanggal'       => $tanggal,
                    'nama_barang'   => $nama,
                    'harga'         => (int) $data[$nama],
                    'current_mayor' => $mayor,
                    'created_at'    => now(),
                    'updated_at'    => now(),
                ];
            }

            DB::table('harga_barang')->insert($bulk); // insert 10 sekaligus
        }

        fclose($file);
    }
}