/* ============================================================
   ASTRA — AI Chat UI  |  app.js
   API-ready structure — swap fakeAIResponse() with real fetch
   ============================================================ */

'use strict';

// ── Config ──────────────────────────────────────────────────────────────────
const API_URL = '/api/chat';           // Replace with real endpoint
const MODEL   = 'astra-2.1';          // Model identifier for API payload
const TYPING_SPEED = 18;              // ms per character (typewriter effect)

// ── Fake responses (replace fakeAIResponse to go live) ──────────────────────
const FAKE_RESPONSES = [
    'Menarik, coba kita lihat dari sudut pandang lain. Problem ini sebenarnya punya beberapa lapisan yang perlu diurai satu per satu.',
    'Kalau secara logika, ini bisa dijelaskan begini: ada separation of concerns yang kurang jelas di sini. Coba pisahkan responsibility masing-masing komponen dulu.',
    'Sebenarnya ada 2 kemungkinan utama. Pertama, pendekatan langsung yang cepat tapi technical debt-nya tinggi. Kedua, refactor dulu supaya scalable ke depannya.',
    'Good question. Ini klasik trade-off antara performance vs readability. Untuk production code, gue biasanya prioritasin readability dulu, optimasi nanti kalau ada bottleneck nyata.',
    'Hmm, kalau gue lihat dari konteksnya — ada beberapa pattern yang bisa dipakai di sini. Yang paling straightforward adalah Strategy Pattern, tapi tergantung seberapa sering logic ini bakal berubah.',
    'Ini sebenarnya solved problem. Caranya: definisikan interface yang jelas di antara layer-layer lo, terus dependency injection buat bikin testing lebih gampang. Mau gue breakdown lebih detail?',
    'Nah, ini yang sering orang skip. Validasi input itu harus happen di multiple layers — bukan cuma di frontend. Backend tetap harus validate independently karena client-side bisa di-bypass.',
    'Interesting approach. Trade-off-nya adalah: lo dapet simplicity sekarang tapi kalau requirement berubah, refactoring-nya lumayan. Worth it kalau timeline mepet, tapi dokumentasiin dulu tech debt-nya.',
];

// ── State ────────────────────────────────────────────────────────────────────
const state = {
    messages:      [],    // Array of { role: 'user'|'assistant', content: string }
    isLoading:     false,
    activeChatId:  null,  // null = belum ada sesi aktif
    chatIdCounter: 0,     // auto-increment ID untuk setiap sesi baru
    isNewSession:  true,  // true = belum ada pesan dikirim di sesi ini
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const dom = {
    sidebar:          $('sidebar'),
    btnSidebarToggle: $('btnSidebarToggle'),
    btnNewChat:       $('btnNewChat'),
    chatList:         $('chatList'),
    chatListEmpty:    $('chatListEmpty'),
    messagesViewport: $('messagesViewport'),
    messagesFeed:     $('messagesFeed'),
    welcomeState:     $('welcomeState'),
    chatInput:        $('chatInput'),
    btnSend:          $('btnSend'),
    inputWrapper:     $('inputWrapper'),
    chatTopbarTitle:  document.querySelector('.chat-topbar-title'),
};

// ── Render helpers ────────────────────────────────────────────────────────────

/**
 * Render a single message bubble into the feed.
 * @param {{ role: 'user'|'assistant', content: string }} message
 * @param {boolean} animate - whether to run typewriter effect (AI only)
 * @returns {HTMLElement} the bubble element
 */
function renderMessage(message, animate = false) {
    const isUser = message.role === 'user';

    const row = document.createElement('div');
    row.className = `msg-row ${isUser ? 'user' : 'ai'}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = isUser ? 'U' : 'A';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    if (!animate || isUser) {
        bubble.textContent = message.content;
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    dom.messagesFeed.appendChild(row);
    scrollToBottom();

    if (animate && !isUser) {
        typewriterEffect(bubble, message.content);
    }

    return bubble;
}

/**
 * Show animated typing indicator while AI is "thinking".
 * @returns {{ el: HTMLElement, remove: Function }}
 */
function showTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'msg-row ai';
    row.id = 'typingRow';

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = 'A';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        dot.className = 'typing-dot';
        indicator.appendChild(dot);
    }

    bubble.appendChild(indicator);
    row.appendChild(avatar);
    row.appendChild(bubble);
    dom.messagesFeed.appendChild(row);
    scrollToBottom();

    return {
        el: row,
        remove: () => row.remove(),
    };
}

/**
 * Typewriter reveal effect on an element.
 * @param {HTMLElement} el
 * @param {string} text
 */
async function typewriterEffect(el, text) {
    el.textContent = '';
    for (let i = 0; i < text.length; i++) {
        el.textContent += text[i];
        if (i % 3 === 0) scrollToBottom();
        await sleep(TYPING_SPEED);
    }
    scrollToBottom();
}

// ── Core chat logic ───────────────────────────────────────────────────────────

/**
 * Inject a new chat entry into the sidebar history.
 * Dipanggil sekali saat pesan pertama di sesi baru dikirim.
 * @param {string} id - chat session ID
 * @param {string} title - diambil dari pesan pertama user (truncated)
 */
function addChatToSidebar(id, title) {
    // Sembunyikan empty state
    dom.chatListEmpty.classList.add('hidden');

    // Set semua item lain jadi tidak aktif
    dom.chatList.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));

    const truncated = title.length > 36 ? title.slice(0, 36).trimEnd() + '…' : title;

    const btn = document.createElement('button');
    btn.className = 'chat-item active';
    btn.dataset.id = id;
    btn.innerHTML = `
        <svg class="chat-item-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M12 1H2a1 1 0 00-1 1v7a1 1 0 001 1h1.5L7 13l2.5-3H12a1 1 0 001-1V2a1 1 0 00-1-1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        </svg>
        <span class="chat-item-title">${truncated}</span>
        <button class="btn-rename" title="Rename">✏️</button>
    `;

    // Klik untuk switch (nanti bisa dihubungkan ke backend)
    btn.addEventListener('click', () => {
        dom.chatList.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
        btn.classList.add('active');
        state.activeChatId = id;
        dom.chatTopbarTitle.textContent = truncated;
        if (isMobile() && sidebarOpen) toggleSidebar();
    });
    const renameBtn = btn.querySelector('.btn-rename');
    renameBtn.addEventListener('click', e => {
        e.stopPropagation();
        enableRenameMode(btn);
    })
    // Insert di paling atas (setelah empty state element)
    dom.chatList.insertBefore(btn, dom.chatListEmpty.nextSibling);
}

function enableRenameMode(btnItem) {
    // ambil elemen span judulnya doang
    const titleSpan = btnItem.querySelector('.chat-item-title')
    const judulLama = titleSpan.textContent;

    // ganti span jadi input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = judulLama;
    input.className = 'rename-input';
    titleSpan.replaceWith(input);
    
    // langsung select semua text
    input.focus();
    input.select();

    // fungsi simpan
    function saveRename() {
        const judulBaru = input.value.trim() || judulLama;
        const span = document.createElement('span')
        span.className = 'chat-item-title';
        span.textContent =judulBaru;
        input.replaceWith(span);

        // update topbarnya kalo chat ini aktif
        if (btnItem.dataset.id === state.activeChatId) {
            dom.chatTopbarTitle.textContent = judulBaru;
        }
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            preventDefault(); 
            saveRename();}
        
        if (e.key === 'Escape') {
            const span = document.createElement('span');
            span.className = 'chat-item-title';
            span.textContent = judulLama;
            input.replaceWith(span);
        }
    }

    )}

    input.addEventListener('blur', saveRename);

}
//  * To integrate real backend: replace fakeAIResponse() call below
//  * with a call to callAPI() — no other changes needed.
//  */
async function sendMessage(content) {
    if (!content.trim() || state.isLoading) return;

    // Hide welcome, show feed area
    hideWelcomeState();

    // Kalau ini pesan pertama di sesi ini, buat entri baru di sidebar
    if (state.isNewSession) {
        state.chatIdCounter += 1;
        state.activeChatId = String(state.chatIdCounter);
        state.isNewSession = false;
        addChatToSidebar(state.activeChatId, content.trim());
        dom.chatTopbarTitle.textContent = content.trim().length > 36
            ? content.trim().slice(0, 36).trimEnd() + '…'
            : content.trim();
    }


    // Add to state
    const userMsg = { role: 'user', content: content.trim() };
    state.messages.push(userMsg);

    // Render user bubble
    renderMessage(userMsg);

    // Clear input & set loading
    dom.chatInput.value = '';
    autoResizeTextarea();
    setLoading(true);

    // Get AI response
    const typing = showTypingIndicator();

    try {
        // ── SWAP THIS LINE to go live ──────────────────────────────────────
        // const aiContent = await callAPI(state.messages);   // Real backend
        const aiContent = await fakeAIResponse();             // Demo only
        // ──────────────────────────────────────────────────────────────────

        typing.remove();

        const aiMsg = { role: 'assistant', content: aiContent };
        state.messages.push(aiMsg);
        renderMessage(aiMsg, true); // true = typewriter effect

    } catch (err) {
        typing.remove();
        renderMessage({
            role: 'assistant',
            content: `Something went wrong: ${err.message}. Please try again.`,
        });
        console.error('[Astra] sendMessage error:', err);
    } finally {
        setLoading(false);
    }
}

/**
 * FAKE AI response for demo/development.
 * Simulates network delay + thinking time.
 * @returns {Promise<string>}
 */
async function fakeAIResponse() {
    const thinkTime = 800 + Math.random() * 1000;
    await sleep(thinkTime);
    return FAKE_RESPONSES[Math.floor(Math.random() * FAKE_RESPONSES.length)];
}

/**
 * REAL API call — uncomment and use when backend is ready.
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<string>}
 */
async function callAPI(messages) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            model: MODEL,
            messages: messages,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message ?? `HTTP ${response.status}`);
    }

    const data = await response.json();

    // Adjust this path to match your API response shape:
    return data?.message?.content
        ?? data?.choices?.[0]?.message?.content
        ?? data?.content
        ?? 'No response from server.';
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function setLoading(loading) {
    state.isLoading = loading;
    dom.chatInput.disabled = loading;

    if (loading) {
        dom.btnSend.classList.add('loading');
        dom.btnSend.disabled = true;
    } else {
        dom.btnSend.classList.remove('loading');
        updateSendButton();
    }
}

function updateSendButton() {
    const hasText = dom.chatInput.value.trim().length > 0;
    dom.btnSend.disabled = !hasText || state.isLoading;
    dom.btnSend.style.opacity = (hasText && !state.isLoading) ? '1' : '0.35';
    dom.btnSend.style.pointerEvents = (hasText && !state.isLoading) ? 'auto' : 'none';
}

function autoResizeTextarea() {
    const el = dom.chatInput;
    el.style.height = 'auto';
    const maxH = 200;
    el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
    updateSendButton();
}

function scrollToBottom(smooth = true) {
    dom.messagesViewport.scrollTo({
        top: dom.messagesViewport.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant',
    });
}

function hideWelcomeState() {
    if (dom.welcomeState && !dom.welcomeState.classList.contains('hidden')) {
        dom.welcomeState.classList.add('hidden');
    }
}

function showWelcomeState() {
    if (dom.welcomeState) {
        dom.welcomeState.classList.remove('hidden');
    }
}

function resetChat() {
    state.messages = [];
    state.isLoading = false;
    state.isNewSession = true;
    state.activeChatId = null;
    dom.messagesFeed.innerHTML = '';
    dom.chatInput.value = '';
    dom.chatInput.style.height = 'auto';
    showWelcomeState();
    updateSendButton();
    dom.chatTopbarTitle.textContent = 'New Chat';
}

function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function isMobile() { return window.innerWidth <= 680; }

let sidebarOpen = true;

function toggleSidebar() {
    sidebarOpen = !sidebarOpen;

    if (sidebarOpen) {
        dom.sidebar.classList.remove('collapsed');
    } else {
        dom.sidebar.classList.add('collapsed');
    }

    // Mobile overlay
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', toggleSidebar);
    }

    if (isMobile() && sidebarOpen) {
        overlay.classList.add('visible');
    } else {
        overlay.classList.remove('visible');
    }
}

// Init: collapse sidebar on mobile
function initSidebarState() {
    if (isMobile()) {
        sidebarOpen = false;
        dom.sidebar.classList.add('collapsed');
    }
}

// ── Event listeners ───────────────────────────────────────────────────────────

function initEvents() {
    // Input resize & send button state
    dom.chatInput.addEventListener('input', autoResizeTextarea);

    // Enter = send, Shift+Enter = newline
    dom.chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!state.isLoading && dom.chatInput.value.trim()) {
                sendMessage(dom.chatInput.value);
            }
        }
    });

    // Send button
    dom.btnSend.addEventListener('click', () => {
        if (!state.isLoading && dom.chatInput.value.trim()) {
            sendMessage(dom.chatInput.value);
        }
    });

    // New chat
    dom.btnNewChat.addEventListener('click', () => {
        resetChat();
        dom.chatList.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
        if (isMobile() && sidebarOpen) toggleSidebar();
    });

    // Sidebar toggle
    dom.btnSidebarToggle.addEventListener('click', toggleSidebar);

    // Suggestion chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const prompt = chip.dataset.prompt;
            if (prompt) {
                dom.chatInput.value = prompt;
                autoResizeTextarea();
                dom.chatInput.focus();
                sendMessage(prompt);
            }
        });
    });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

function init() {
    initSidebarState();
    initEvents();
    updateSendButton();
}

document.addEventListener('DOMContentLoaded', init);