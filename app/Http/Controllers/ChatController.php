<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ChatController extends Controller
{
    public function handle(Request $request)
    {
        $messages = $request->input('messages', []);

        $lastMessage = strtolower(
            collect($messages)->where('role', 'user')->last()['content'] ?? ''
        );

        // ── Deteksi tanggal ───────────────────────────────────────────────
        $tanggalFilter = null;
        $bulan = [
            'januari'=>1,'februari'=>2,'maret'=>3,'april'=>4,
            'mei'=>5,'juni'=>6,'juli'=>7,'agustus'=>8,
            'september'=>9,'oktober'=>10,'november'=>11,'desember'=>12
        ];

        if (preg_match('/(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/i', $lastMessage, $m)) {
            $tanggalFilter = sprintf('%04d-%02d-%02d', $m[3], $bulan[strtolower($m[2])], (int)$m[1]);
        } elseif (preg_match('/(\d{4})-(\d{2})-(\d{2})/', $lastMessage, $m)) {
            $tanggalFilter = $m[0];
        }

        // ── Deteksi nama barang ───────────────────────────────────────────
        $barangList = [
            'GREEN_CANDY','WHITE_GIFT','PURPLE_CANDY','BLUE_SHARK_TOOTH',
            'RED_GIFT','NURSE_SHARK_TOOTH','TIGER_SHARK_TOOTH',
            'SHARK_FIN','GRIFFIN_FEATHER','GREEN_GIFT',
        ];
        $barangFilter = null;
        foreach ($barangList as $b) {
            if (str_contains($lastMessage, strtolower($b))) {
                $barangFilter = $b;
                break;
            }
        }

        // ── Query dinamis (SQLite compatible) ────────────────────────────
        $query = DB::table('harga_barang');

        if ($tanggalFilter) {
            // Gunakan where biasa, bukan whereDate() — SQLite tidak support
            $query->where('tanggal', $tanggalFilter);
        }
        if ($barangFilter) {
            $query->where('nama_barang', $barangFilter);
        }
        if (!$tanggalFilter && !$barangFilter) {
            $query->orderBy('tanggal', 'desc')->limit(100);
        }

        $hargaData = $query->orderBy('tanggal', 'desc')->get();

        // ── Format context untuk AI ───────────────────────────────────────
        if ($hargaData->isEmpty()) {
            $dataContext = "Tidak ada data untuk filter yang diminta.\n";
        } else {
            $dataContext = "Berikut data harga barang:\n\n";
            foreach ($hargaData as $item) {
                $dataContext .= "Tanggal: {$item->tanggal} | Barang: {$item->nama_barang} | Harga: Rp "
                    . number_format($item->harga, 0, ',', '.')
                    . " | Mayor: {$item->current_mayor}\n";
            }
        }

        // ── System prompt ─────────────────────────────────────────────────
        $systemPrompt = "Kamu adalah asisten AI bernama Navas yang membantu menjawab pertanyaan tentang harga barang. "
            . "Jawab dalam bahasa Indonesia dengan ramah dan informatif. "
            . "PENTING: Jawab HANYA berdasarkan data di bawah ini. Jika data tidak tersedia, katakan datanya tidak ada.\n\n"
            . $dataContext;

        // ── Kirim ke OpenRouter ───────────────────────────────────────────
        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . env('OPENROUTER_API_KEY'),
            'Content-Type'  => 'application/json',
            'HTTP-Referer'  => env('APP_URL'),
            'X-Title'       => 'Navas AI',
        ])->post('https://openrouter.ai/api/v1/chat/completions', [
            'model'    => 'openai/gpt-4o-mini',
            'messages' => array_merge(
                [['role' => 'system', 'content' => $systemPrompt]],
                $messages
            ),
        ]);

        if ($response->failed()) {
            return response()->json(['message' => 'Gagal menghubungi AI.'], 500);
        }

        $result  = $response->json();
        $content = $result['choices'][0]['message']['content'] ?? 'Tidak ada respons.';

        return response()->json(['content' => $content]);
    }
}