<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class QueryExecutorService
{
    private array $forbiddenKeywords = [
        'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER',
        'TRUNCATE', 'CREATE', 'RENAME', 'REPLACE',
    ];

    public function execute(string $sql): array
    {
        $this->validateSQL($sql);
        $results = DB::select($sql);
        return array_map(fn($row) => (array) $row, $results);
    }

    private function validateSQL(string $sql): void
    {
        $sqlUpper = strtoupper($sql);
        foreach ($this->forbiddenKeywords as $keyword) {
            if (preg_match('/\b' . $keyword . '\b/', $sqlUpper)) {
                throw new \Exception("Query mengandung perintah berbahaya: {$keyword}");
            }
        }
        if (!preg_match('/^\s*SELECT\b/i', $sql)) {
            throw new \Exception("Hanya query SELECT yang diizinkan.");
        }
    }
}