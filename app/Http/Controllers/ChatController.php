<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\NL2SQLService;
use App\Services\QueryExecutorService;
use App\Models\ChatHistory;

class ChatController extends Controller
{
    public function __construct(
        private NL2SQLService $nl2sqlService,
        private QueryExecutorService $queryExecutor
    ) {}

    public function index()
    {
        $histories = ChatHistory::latest()->take(20)->get();
        return view('chat.index', compact('histories'));
    }

    public function ask(Request $request)
    {
        $request->validate([
            'question' => 'required|string|max:500',
        ]);

        $question = $request->input('question');

        try {
            $sql = $this->nl2sqlService->generateSQL($question);
            $result = $this->queryExecutor->execute($sql);

            ChatHistory::create([
                'question'   => $question,
                'sql_query'  => $sql,
                'row_count'  => count($result),
                'status'     => 'success',
            ]);

            return response()->json([
                'success'  => true,
                'question' => $question,
                'sql'      => $sql,
                'data'     => $result,
                'columns'  => count($result) > 0 ? array_keys((array) $result[0]) : [],
            ]);

        } catch (\Exception $e) {
            ChatHistory::create([
                'question'  => $question,
                'sql_query' => $sql ?? null,
                'status'    => 'error',
                'error_msg' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Gagal memproses pertanyaan: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function history()
    {
        $histories = ChatHistory::latest()->take(20)->get();
        return response()->json($histories);
    }

    // Hapus satu riwayat
    public function destroy($id)
    {
        ChatHistory::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    // Hapus semua riwayat
    public function destroyAll()
    {
        ChatHistory::truncate();
        return response()->json(['success' => true]);
    }

    // Hapus yang dipilih
    public function destroySelected(Request $request)
    {
        $ids = $request->input('ids', []);
        ChatHistory::whereIn('id', $ids)->delete();
        return response()->json(['success' => true]);
    }

    public function chat(Request $request)
    {
        $messages = $request->input('messages');
        $lastMessage = collect($messages)->last();
        $userInput = $lastMessage['content'];

        try {
            // 1. Generate SQL dari pertanyaan user
            $sql = $this->nl2sqlService->generateSQL($userInput);

            // 2. Eksekusi SQL ke database
            $result = $this->queryExecutor->execute($sql);

            // 3. Format hasil jadi teks yang readable
            if (empty($result)) {
                $content = "Tidak ada data ditemukan.";
            } else {
                $content = "Ditemukan " . count($result) . " data:\n\n";
                foreach ($result as $row) {
                    $content .= implode(' | ', (array) $row) . "\n";
                }
            }

            return response()->json(['content' => $content]);

        } catch (\Exception $e) {
            return response()->json([
                'content' => 'Gagal: ' . $e->getMessage()
            ], 500);
        }
    }
}