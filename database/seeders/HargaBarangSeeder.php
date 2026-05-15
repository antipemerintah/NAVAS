<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use PhpParser\Builder\Use_;
use Illuminate\Support\Facades\DB;

class HargaBarangSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
        {
        $file = fopen(database_path('output_updated.csv'), 'r');
        $header = fgetcsv($file); // skip baris header

        while (($row = fgetcsv($file)) !== false) {
            $data = array_combine($header, $row);
            $tanggal = \Carbon\Carbon::createFromFormat('Ymd', $data['last_updated'])->toDateString();
            $mayor = $data['current_mayor'];

            $barang = ['GREEN_CANDY','WHITE_GIFT','PURPLE_CANDY','BLUE_SHARK_TOOTH',
                       'RED_GIFT','NURSE_SHARK_TOOTH','TIGER_SHARK_TOOTH',
                       'SHARK_FIN','GRIFFIN_FEATHER','GREEN_GIFT'];

            foreach ($barang as $nama) {
                DB::table('harga_barang')->insert([
                    'tanggal'       => $tanggal,
                    'nama_barang'   => $nama,
                    'harga'         => (int) $data[$nama],
                    'current_mayor' => $mayor,
                ]);
            }
        }
        fclose($file);
    }
}
