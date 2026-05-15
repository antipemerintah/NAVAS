<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;

class NL2SQLService
{
    public function __construct()
    {
        if (
            empty(env('OPENROUTER_API_KEY')) &&
            empty(env('OPENAI_API_KEY')) &&
            empty(env('NVIDIA_API_KEY'))
        ) {
            throw new \Exception('Minimal satu API key harus diisi di file .env');
        }
    }

    public function generateSQL(string $question): string
    {
        $schema = $this->getDatabaseSchema();

        $prompt = $this->getSystemPrompt($schema) . "\n\nPertanyaan user:\n" . $question;

        $providers = [
            [
                'name' => 'OpenRouter',
                'key' => env('OPENROUTER_API_KEY'),
                'model' => env('OPENROUTER_MODEL'),
                'base_url' => env('OPENROUTER_BASE_URL'),
            ],
            [
                'name' => 'OpenAI',
                'key' => env('OPENAI_API_KEY'),
                'model' => env('OPENAI_MODEL'),
                'base_url' => env('OPENAI_BASE_URL'),
            ],
            [
                'name' => 'NVIDIA',
                'key' => env('NVIDIA_API_KEY'),
                'model' => env('NVIDIA_MODEL'),
                'base_url' => env('NVIDIA_BASE_URL'),
            ],
        ];

        $lastError = null;

        foreach ($providers as $provider) {
            if (empty($provider['key']) || empty($provider['model']) || empty($provider['base_url'])) {
                continue;
            }

            try {
                $response = Http::withHeaders([
                    'Authorization' => 'Bearer ' . $provider['key'],
                    'Content-Type'  => 'application/json',
                ])->post($provider['base_url'] . '/chat/completions', [
                    'model' => $provider['model'],
                    'messages' => [
                        [
                            'role' => 'user',
                            'content' => $prompt,
                        ]
                    ],
                    'temperature' => 0,
                    'max_tokens' => 500,
                ]);

                // 1. Cek jika API Berhasil merespon dengan status 200
                if ($response->successful()) {
                    $sql = $response->json('choices.0.message.content');

                    if ($sql && trim($sql) !== '') {
                        return $this->cleanSQL($sql);
                    }
                } 
                // 2. Cek jika API Gagal (Status 4xx / 5xx)
                else if ($response->failed()) {
                    $lastError = $provider['name'] . ' (Status ' . $response->status() . '): ' . $response->body();
                }

            } catch (\Exception $e) {
                $lastError = $provider['name'] . ': ' . $e->getMessage();
                continue;
            }
        }

        throw new \Exception('Semua API gagal atau limit. Error terakhir: ' . $lastError);
    }

    private function getDatabaseSchema(): array
    {
        $driver = DB::getDriverName();
        $schema = [];

        if ($driver === 'sqlite') {
            $tables = DB::select("
                SELECT name 
                FROM sqlite_master 
                WHERE type='table' 
                AND name NOT LIKE 'sqlite_%'
            ");

            foreach ($tables as $table) {
                $tableName = $table->name;
                $columns = DB::select("PRAGMA table_info(`{$tableName}`)");

                $schema[$tableName] = array_map(fn($col) => [
                    'field' => $col->name,
                    'type'  => $col->type,
                ], $columns);
            }

            return $schema;
        }

        $tables = DB::select('SHOW TABLES');

        foreach ($tables as $table) {
            $tableName = array_values((array) $table)[0];
            $columns = DB::select("DESCRIBE `{$tableName}`");

            $schema[$tableName] = array_map(fn($col) => [
                'field' => $col->Field,
                'type'  => $col->Type,
            ], $columns);
        }

        return $schema;
    }

    private function getSystemPrompt(array $schema): string
    {
        $schemaText = '';

        foreach ($schema as $table => $columns) {
            $cols = implode(', ', array_column($columns, 'field'));
            $schemaText .= "- Tabel `{$table}`: {$cols}\n";
        }

        // ini berfungsi agar ai tidak keluar dari konteks ini dan tetap dalam topik prompt
        return <<<PROMPT
Kamu adalah asisten NL2SQL yang mengubah pertanyaan bahasa Indonesia menjadi query SQL.

Schema database yang tersedia:
{$schemaText}

Aturan penting:
1. Hanya keluarkan satu query SQL valid terkecuali user meminta lebih.
2. JANGAN sertakan teks selain SQL.
3. JANGAN pakai penjelasan, catatan, komentar, markdown, atau backtick.
4. Gunakan nama tabel dan kolom PERSIS sesuai schema di atas.
5. Gunakan hanya query SELECT.
6. JANGAN gunakan DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, CREATE, RENAME, REPLACE.
7. Konteks Khusus Nilai Siswa (kolom `nilai` pada tabel `siswa` berisi abjad A, B, C, D, E):
- Jika user meminta nilai "terbaik", "tertinggi", atau "paling bagus", gunakan `ORDER BY nilai ASC` (karena A lebih baik dari E).
- Jika user meminta nilai "terburuk", "terendah", atau "paling jelek", gunakan `ORDER BY nilai DESC`.
8. Jika pertanyaan tidak bisa dijawab, kembalikan:
SELECT 'Data tidak tersedia' AS pesan;
PROMPT;
    }

    private function cleanSQL(string $sql): string
    {
        $sql = preg_replace('/```sql\s*/i', '', $sql);
        $sql = preg_replace('/```\s*/', '', $sql);
        $sql = trim($sql);

        if (!str_ends_with($sql, ';')) {
            $sql .= ';';
        }

        return $sql;
    }
}