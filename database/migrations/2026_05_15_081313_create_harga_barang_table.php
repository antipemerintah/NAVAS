<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('harga_barang', function (Blueprint $table) {
            $table->id();
            $table->date('tanggal');
            $table->string('nama_barang');
            $table->bigInteger('harga');
            $table->string('current_mayor')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('harga_barang');
    }
};
