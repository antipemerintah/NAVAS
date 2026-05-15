<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Navas — AI Assistant</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="{{ asset('css/app.css') }}">
</head>
<body>

<div class="app-shell">

    <!-- Bagian sidebar -->
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <div class="brand">
                <span class="brand-dot"></span>
                <span class="brand-name">Navas</span>
            </div>
            <button class="btn-new-chat" id="btnNewChat" title="New Chat">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                <span>Chat baru</span>
            </button>
        </div>

        <div class="sidebar-section-label">Terbaru</div>

        <nav class="chat-list" id="chatList">
            <!-- Riwayat chat bakal di tampilin di sini setiap si user ngetik  -->
            <div class="chat-list-empty" id="chatListEmpty">
                <span>Belum ada chat</span>
            </div>
        </nav>

        <div class="sidebar-footer">
            <div class="user-badge">
                <div class="user-avatar">S</div>
                <div class="user-info">
                    <span class="user-name">SMK TELKOM JAKARTA</span>
                    <span class="user-plan">Premium</span>
                </div>
            </div>
        </div>
    </aside>

    <!-- Area utama chat bot -->
    <main class="chat-main">

        <!-- Bagian atas web chat botnya -->
        <header class="chat-topbar">
            <button class="btn-sidebar-toggle" id="btnSidebarToggle" title="Toggle sidebar">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="1" y="4" width="16" height="1.5" rx="0.75" fill="currentColor"/>
                    <rect x="1" y="8.25" width="10" height="1.5" rx="0.75" fill="currentColor"/>
                    <rect x="1" y="12.5" width="13" height="1.5" rx="0.75" fill="currentColor"/>
                </svg>
            </button>
            <span class="chat-topbar-title">New Chat</span>
            <div class="topbar-right">
                <span class="model-badge">
                    <span class="model-dot"></span>
                    Navas 2.1
                </span>
            </div>
        </header>

        <!-- Pesan -->
        <div class="messages-viewport" id="messagesViewport">
            <div class="messages-inner" id="messagesInner">

                <!-- Bagian penyambutan kek sebelum ngechat gitu -->
                <div class="welcome-state" id="welcomeState">
                    <div class="welcome-icon">
                        <span class="welcome-brand-dot"></span>
                    </div>
                    <h1 class="welcome-heading">Ada yang bisa kita bantu?</h1>
                    <p class="welcome-sub">Tanya apa aja, seperti tugas harian, pengembangan diri, dan lain lain</p>
                    <div class="suggestion-chips">
                        <button class="chip" data-prompt="Bantu tugas matematika">Bantu tugas matematika</button>
                        <button class="chip" data-prompt="Koreksi jawaban ku">Koreksi jawaban ku</button>
                        <button class="chip" data-prompt="Cara menjadi lebih baik dari hari ini">Cara menjadi lebih baik dari hari ini</button>
                        <button class="chip" data-prompt="Rekomendasi buku yang bagus untuk belajar finansial">Rekomendasi buku yang bagus untuk belajar finansial</button>
                    </div>
                </div>

                <!-- Pesan bakal muncul di sini dan di isi nya sama si javascript-->
                <div class="messages-feed" id="messagesFeed"></div>

            </div>
        </div>

        <!-- Input pesan -->
        <div class="input-dock">
            <div class="input-wrapper" id="inputWrapper">
                <textarea
                    class="chat-input"
                    id="chatInput"
                    placeholder="Message Navas…"
                    rows="1"
                    autocomplete="off"
                    spellcheck="true"
                ></textarea>
                <button class="btn-send" id="btnSend" disabled title="Send message">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M14 8L2 2l2.5 6L2 14l12-6z" fill="currentColor"/>
                    </svg>
                </button>
            </div>
            <p class="input-hint">Navas bisa melakukan kesalahan. Cek kebenaran sebelum membuat keputusan.</p>
        </div>

    </main>
</div>

<script src="{{ asset('js/app.js') }}"></script>
</body>
</html>