<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ChatController;

Route::get('/', function () {
    return view('welcome');
});

Route::post('/ask', [ChatController::class, 'ask']);

// Tambahkan ini:
Route::get('/debug-schema', function() {
    $tables = \DB::select("SELECT name FROM sqlite_master WHERE type='table'");
    dd($tables);
});