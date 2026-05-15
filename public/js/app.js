'use strict';

//  Konfigurasi 
const ALAMAT_API    = '/api/chat';     // Ganti dengan endpoint yang sebenarnya
const NAMA_MODEL    = 'navas-2.1';    // Nama model yang dikirim ke API
const KECEPATAN_KETIK = 18;           // Jeda per karakter efek mesin ketik (ms)

//  Balasan palsu untuk demo (ganti fakeAIResponse() dengan callAPI() untuk live) 
const BALASAN_DEMO = [
    'Menarik, coba kita lihat dari sudut pandang lain. Problem ini sebenarnya punya beberapa lapisan yang perlu diurai satu per satu.',
    'Kalau secara logika, ini bisa dijelaskan begini: ada separation of concerns yang kurang jelas di sini. Coba pisahkan responsibility masing-masing komponen dulu.',
    'Sebenarnya ada 2 kemungkinan utama. Pertama, pendekatan langsung yang cepat tapi technical debt-nya tinggi. Kedua, refactor dulu supaya scalable ke depannya.',
    'Good question. Ini klasik trade-off antara performance vs readability. Untuk production code, gue biasanya prioritasin readability dulu, optimasi nanti kalau ada bottleneck nyata.',
    'Hmm, kalau gue lihat dari konteksnya — ada beberapa pattern yang bisa dipakai di sini. Yang paling straightforward adalah Strategy Pattern, tapi tergantung seberapa sering logic ini bakal berubah.',
    'Ini sebenarnya solved problem. Caranya: definisikan interface yang jelas di antara layer-layer lo, terus dependency injection buat bikin testing lebih gampang. Mau gue breakdown lebih detail?',
    'Nah, ini yang sering orang skip. Validasi input itu harus happen di multiple layers — bukan cuma di frontend. Backend tetap harus validate independently karena client-side bisa di-bypass.',
    'Interesting approach. Trade-off-nya adalah: lo dapet simplicity sekarang tapi kalau requirement berubah, refactoring-nya lumayan. Worth it kalau timeline mepet, tapi dokumentasiin dulu tech debt-nya.',
];

//  Data kondisi aplikasi 
const kondisi = {
    daftarPesan:    [],     // Riwayat pesan: array of { role: 'user'|'assistant', content: string }
    sedangMemuat:   false,  // True kalau lagi nunggu balasan dari AI
    idChatAktif:    null,   // ID sesi chat yang sedang terbuka (null = belum ada)
    hitungIdChat:   0,      // Penghitung ID sesi, naik setiap sesi baru dibuat
    sesiBaruDibuka: true,   // True = belum ada pesan dikirim di sesi ini
};

//  Referensi elemen HTML 
const cari = id => document.getElementById(id);

const elemen = {
    sidebar:            cari('sidebar'),
    tombolToggleSidebar: cari('btnSidebarToggle'),
    tombolChatBaru:     cari('btnNewChat'),
    daftarChat:         cari('chatList'),
    pesanKosong:        cari('chatListEmpty'),
    areaTampilPesan:    cari('messagesViewport'),
    tempatPesan:        cari('messagesFeed'),
    tampilanSelamatDatang: cari('welcomeState'),
    kotakTulis:         cari('chatInput'),
    tombolKirim:        cari('btnSend'),
    pembungkusInput:    cari('inputWrapper'),
    judulTopbar:        document.querySelector('.chat-topbar-title'),
};

//  Fungsi tampilan 

/**
 * Menampilkan satu gelembung pesan ke dalam area percakapan.
 * @param {{ role: 'user'|'assistant', content: string }} pesan
 * @param {boolean} animasi - kalau true, pakai efek mesin ketik (khusus balasan AI)
 * @returns {HTMLElement} elemen gelembung yang dibuat
 */
function tampilkanPesan(pesan, animasi = false) {
    const dariUser = pesan.role === 'user';

    const baris = document.createElement('div');
    baris.className = `msg-row ${dariUser ? 'user' : 'ai'}`;

    const foto = document.createElement('div');
    foto.className = 'msg-avatar';
    foto.textContent = dariUser ? 'U' : 'A';

    const gelembung = document.createElement('div');
    gelembung.className = 'msg-bubble';

    if (!animasi || dariUser) {
        gelembung.textContent = pesan.content;
    }

    baris.appendChild(foto);
    baris.appendChild(gelembung);
    elemen.tempatPesan.appendChild(baris);
    gulirKeBawah();

    if (animasi && !dariUser) {
        efekMesinKetik(gelembung, pesan.content);
    }

    return gelembung;
}

/**
 * Menampilkan animasi tiga titik saat AI sedang menyiapkan balasan.
 * @returns {{ el: HTMLElement, hapus: Function }}
 */
function tampilkanIndikatorMenulis() {
    const baris = document.createElement('div');
    baris.className = 'msg-row ai';
    baris.id = 'barisMenulis';

    const foto = document.createElement('div');
    foto.className = 'msg-avatar';
    foto.textContent = 'A';

    const gelembung = document.createElement('div');
    gelembung.className = 'msg-bubble';

    const indikator = document.createElement('div');
    indikator.className = 'typing-indicator';
    for (let i = 0; i < 3; i++) {
        const titik = document.createElement('span');
        titik.className = 'typing-dot';
        indikator.appendChild(titik);
    }

    gelembung.appendChild(indikator);
    baris.appendChild(foto);
    baris.appendChild(gelembung);
    elemen.tempatPesan.appendChild(baris);
    gulirKeBawah();

    return {
        el: baris,
        hapus: () => baris.remove(),
    };
}

/**
 * Menampilkan teks karakter per karakter seperti efek mesin ketik.
 * @param {HTMLElement} el - elemen yang akan diisi teks
 * @param {string} teks - teks yang akan ditampilkan
 */
async function efekMesinKetik(el, teks) {
    el.textContent = '';
    for (let i = 0; i < teks.length; i++) {
        el.textContent += teks[i];
        if (i % 3 === 0) gulirKeBawah();
        await jeda(KECEPATAN_KETIK);
    }
    gulirKeBawah();
}

//  Logika percakapan utama ─

/**
 * Menambahkan entri sesi chat baru ke dalam daftar riwayat di sidebar.
 * Dipanggil sekali saat pesan pertama dikirim di sesi yang baru dibuka.
 * @param {string} id - ID unik sesi chat
 * @param {string} judul - diambil dari isi pesan pertama user (dipotong kalau terlalu panjang)
 */
function tambahChatKeSidebar(id, judul) {
    // Sembunyikan tulisan "Belum ada chat"
    elemen.pesanKosong.classList.add('hidden');

    // Nonaktifkan highlight semua sesi lain
    elemen.daftarChat.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));

    const judulPendek = judul.length > 36 ? judul.slice(0, 36).trimEnd() + '…' : judul;

    const tombol = document.createElement('button');
    tombol.className = 'chat-item active';
    tombol.dataset.id = id;
    tombol.innerHTML = `
        <svg class="chat-item-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M12 1H2a1 1 0 00-1 1v7a1 1 0 001 1h1.5L7 13l2.5-3H12a1 1 0 001-1V2a1 1 0 00-1-1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        </svg>
        <span class="chat-item-title">${judulPendek}</span>
        <button class="btn-rename" title="Ganti nama">✏️</button>
    `;

    // Klik untuk berpindah ke sesi ini
    tombol.addEventListener('click', () => {
        elemen.daftarChat.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
        tombol.classList.add('active');
        kondisi.idChatAktif = id;
        elemen.judulTopbar.textContent = judulPendek;
        if (layarKecil() && sidebarTerbuka) toggleSidebar();
    });

    // Tombol ganti nama
    const tombolGantiNama = tombol.querySelector('.btn-rename');
    tombolGantiNama.addEventListener('click', e => {
        e.stopPropagation();
        aktifkanModeGantiNama(tombol);
    });

    // Sisipkan di posisi paling atas daftar
    elemen.daftarChat.insertBefore(tombol, elemen.pesanKosong.nextSibling);
}

/**
 * Mengubah judul sesi chat menjadi input yang bisa diedit langsung.
 * @param {HTMLElement} itemChat - elemen tombol sesi di sidebar
 */
function aktifkanModeGantiNama(itemChat) {
    const spanJudul = itemChat.querySelector('.chat-item-title');
    const judulLama = spanJudul.textContent;

    // Ganti tampilan judul dengan kotak teks
    const inputNama = document.createElement('input');
    inputNama.type = 'text';
    inputNama.value = judulLama;
    inputNama.className = 'rename-input';
    spanJudul.replaceWith(inputNama);

    inputNama.focus();
    inputNama.select();

    // Simpan nama baru dan kembalikan ke tampilan normal
    function simpanNamaBaru() {
        const judulBaru = inputNama.value.trim() || judulLama;
        const spanBaru = document.createElement('span');
        spanBaru.className = 'chat-item-title';
        spanBaru.textContent = judulBaru;
        inputNama.replaceWith(spanBaru);

        // Perbarui judul di topbar kalau ini sesi yang aktif
        if (itemChat.dataset.id === kondisi.idChatAktif) {
            elemen.judulTopbar.textContent = judulBaru;
        }
    }

    inputNama.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            simpanNamaBaru();
        }
        if (e.key === 'Escape') {
            const spanBatal = document.createElement('span');
            spanBatal.className = 'chat-item-title';
            spanBatal.textContent = judulLama;
            inputNama.replaceWith(spanBatal);
        }
    });

    inputNama.addEventListener('blur', simpanNamaBaru);
}

/**
 * Mengirim pesan dari user, menampilkannya, lalu meminta balasan dari AI.
 *
 * Untuk menghubungkan ke backend sungguhan:
 * ganti baris fakeAIResponse() di bawah dengan callAPI(kondisi.daftarPesan)
 */
async function kirimPesan(isi) {
    if (!isi.trim() || kondisi.sedangMemuat) return;

    // Sembunyikan tampilan selamat datang, tampilkan area percakapan
    sembunyikanSelamatDatang();

    // Kalau ini pesan pertama di sesi ini, buat sesi baru di sidebar
    if (kondisi.sesiBaruDibuka) {
        kondisi.hitungIdChat += 1;
        kondisi.idChatAktif = String(kondisi.hitungIdChat);
        kondisi.sesiBaruDibuka = false;
        tambahChatKeSidebar(kondisi.idChatAktif, isi.trim());
        elemen.judulTopbar.textContent = isi.trim().length > 36
            ? isi.trim().slice(0, 36).trimEnd() + '…'
            : isi.trim();
    }

    // Simpan pesan user ke riwayat
    const pesanUser = { role: 'user', content: isi.trim() };
    kondisi.daftarPesan.push(pesanUser);

    // Tampilkan gelembung pesan user
    tampilkanPesan(pesanUser);

    // Kosongkan kotak tulis dan aktifkan status memuat
    elemen.kotakTulis.value = '';
    sesuaikanTinggiInput();
    aturStatusMemuat(true);

    // Tampilkan animasi tiga titik sementara AI menyiapkan balasan
    const menulis = tampilkanIndikatorMenulis();

    try {
        //  GANTI BARIS INI untuk mode live ─
        // const isiBalasan = await callAPI(kondisi.daftarPesan);  // Backend sungguhan
        const isiBalasan = await fakeAIResponse();                 // Mode demo saja
        // 

        menulis.hapus();

        const pesanAI = { role: 'assistant', content: isiBalasan };
        kondisi.daftarPesan.push(pesanAI);
        tampilkanPesan(pesanAI, true); // true = pakai efek mesin ketik

    } catch (galat) {
        menulis.hapus();
        tampilkanPesan({
            role: 'assistant',
            content: `Terjadi kesalahan: ${galat.message}. Silakan coba lagi.`,
        });
        console.error('[Navas] Gagal mengirim pesan:', galat);
    } finally {
        aturStatusMemuat(false);
    }
}

/**
 * Balasan palsu untuk keperluan demo dan pengembangan.
 * Meniru jeda jaringan dan waktu berpikir AI.
 * @returns {Promise<string>}
 */
async function fakeAIResponse() {
    const waktuTunggu = 800 + Math.random() * 1000;
    await jeda(waktuTunggu);
    return BALASAN_DEMO[Math.floor(Math.random() * BALASAN_DEMO.length)];
}

/**
 * Memanggil API backend sungguhan dengan riwayat percakapan.
 * Aktifkan fungsi ini (dan nonaktifkan fakeAIResponse) saat backend sudah siap.
 * @param {Array<{role: string, content: string}>} daftarPesan
 * @returns {Promise<string>}
 */
async function callAPI(daftarPesan) {
    const respons = await fetch(ALAMAT_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            model: NAMA_MODEL,
            messages: daftarPesan,
        }),
    });

    if (!respons.ok) {
        const info = await respons.json().catch(() => ({}));
        throw new Error(info.message ?? `HTTP ${respons.status}`);
    }

    const data = await respons.json();

    // Sesuaikan path di bawah dengan format respons API yang dipakai:
    return data?.message?.content
        ?? data?.choices?.[0]?.message?.content
        ?? data?.content
        ?? 'Tidak ada balasan dari server.';
}

//  Fungsi bantuan tampilan ─

/** Mengatur tampilan tombol kirim dan status loading berdasarkan kondisi saat ini. */
function aturStatusMemuat(sedangMemuat) {
    kondisi.sedangMemuat = sedangMemuat;
    elemen.kotakTulis.disabled = sedangMemuat;

    if (sedangMemuat) {
        elemen.tombolKirim.classList.add('loading');
        elemen.tombolKirim.disabled = true;
    } else {
        elemen.tombolKirim.classList.remove('loading');
        perbaruiTombolKirim();
    }
}

/** Memperbarui tampilan tombol kirim: aktif kalau ada teks, nonaktif kalau kosong atau sedang memuat. */
function perbaruiTombolKirim() {
    const adaTeks = elemen.kotakTulis.value.trim().length > 0;
    elemen.tombolKirim.disabled = !adaTeks || kondisi.sedangMemuat;
    elemen.tombolKirim.style.opacity = (adaTeks && !kondisi.sedangMemuat) ? '1' : '0.35';
    elemen.tombolKirim.style.pointerEvents = (adaTeks && !kondisi.sedangMemuat) ? 'auto' : 'none';
}

/** Menyesuaikan tinggi kotak tulis secara otomatis mengikuti isi teks (maksimal 200px). */
function sesuaikanTinggiInput() {
    const el = elemen.kotakTulis;
    el.style.height = 'auto';
    const tinggiMaksimal = 200;
    el.style.height = Math.min(el.scrollHeight, tinggiMaksimal) + 'px';
    perbaruiTombolKirim();
}

/** Menggulir area pesan ke bagian paling bawah. */
function gulirKeBawah(halus = true) {
    elemen.areaTampilPesan.scrollTo({
        top: elemen.areaTampilPesan.scrollHeight,
        behavior: halus ? 'smooth' : 'instant',
    });
}

/** Menyembunyikan tampilan selamat datang saat percakapan dimulai. */
function sembunyikanSelamatDatang() {
    if (elemen.tampilanSelamatDatang && !elemen.tampilanSelamatDatang.classList.contains('hidden')) {
        elemen.tampilanSelamatDatang.classList.add('hidden');
    }
}

/** Menampilkan kembali halaman selamat datang (saat chat direset). */
function tampilkanSelamatDatang() {
    if (elemen.tampilanSelamatDatang) {
        elemen.tampilanSelamatDatang.classList.remove('hidden');
    }
}

/** Mereset seluruh percakapan: bersihkan riwayat, tampilan, dan kondisi aplikasi. */
function resetPercakapan() {
    kondisi.daftarPesan = [];
    kondisi.sedangMemuat = false;
    kondisi.sesiBaruDibuka = true;
    kondisi.idChatAktif = null;
    elemen.tempatPesan.innerHTML = '';
    elemen.kotakTulis.value = '';
    elemen.kotakTulis.style.height = 'auto';
    tampilkanSelamatDatang();
    perbaruiTombolKirim();
    elemen.judulTopbar.textContent = 'Chat baru';
}

/** Fungsi jeda async sederhana. */
function jeda(ms) {
    return new Promise(res => setTimeout(res, ms));
}

//  Sidebar ─

/** Mengecek apakah layar sedang dalam mode mobile (lebar ≤ 680px). */
function layarKecil() { return window.innerWidth <= 680; }

let sidebarTerbuka = true;

/** Membuka atau menutup sidebar. Di mobile, tampilkan overlay gelap di belakangnya. */
function toggleSidebar() {
    sidebarTerbuka = !sidebarTerbuka;

    if (sidebarTerbuka) {
        elemen.sidebar.classList.remove('collapsed');
    } else {
        elemen.sidebar.classList.add('collapsed');
    }

    // Kelola overlay untuk mode mobile
    let tirai = document.querySelector('.sidebar-overlay');
    if (!tirai) {
        tirai = document.createElement('div');
        tirai.className = 'sidebar-overlay';
        document.body.appendChild(tirai);
        tirai.addEventListener('click', toggleSidebar);
    }

    if (layarKecil() && sidebarTerbuka) {
        tirai.classList.add('visible');
    } else {
        tirai.classList.remove('visible');
    }
}

/** Mengatur kondisi awal sidebar: ditutup otomatis kalau dibuka di layar kecil. */
function inisialisasiSidebar() {
    if (layarKecil()) {
        sidebarTerbuka = false;
        elemen.sidebar.classList.add('collapsed');
    }
}

//  Pasang event listener ─

function pasangEvent() {
    // Sesuaikan tinggi kotak tulis setiap kali isi berubah
    elemen.kotakTulis.addEventListener('input', sesuaikanTinggiInput);

    // Enter untuk kirim, Shift+Enter untuk baris baru
    elemen.kotakTulis.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!kondisi.sedangMemuat && elemen.kotakTulis.value.trim()) {
                kirimPesan(elemen.kotakTulis.value);
            }
        }
    });

    // Tombol kirim diklik
    elemen.tombolKirim.addEventListener('click', () => {
        if (!kondisi.sedangMemuat && elemen.kotakTulis.value.trim()) {
            kirimPesan(elemen.kotakTulis.value);
        }
    });

    // Tombol chat baru: reset percakapan
    elemen.tombolChatBaru.addEventListener('click', () => {
        resetPercakapan();
        elemen.daftarChat.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
        if (layarKecil() && sidebarTerbuka) toggleSidebar();
    });

    // Tombol buka/tutup sidebar
    elemen.tombolToggleSidebar.addEventListener('click', toggleSidebar);

    // Klik pada chip saran langsung mengirim pesan
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const teksPrompt = chip.dataset.prompt;
            if (teksPrompt) {
                elemen.kotakTulis.value = teksPrompt;
                sesuaikanTinggiInput();
                elemen.kotakTulis.focus();
                kirimPesan(teksPrompt);
            }
        });
    });
}

//  Jalankan aplikasi ─

function mulai() {
    inisialisasiSidebar();
    pasangEvent();
    perbaruiTombolKirim();
}

document.addEventListener('DOMContentLoaded', mulai);