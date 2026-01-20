/**
 * LLM Chat App Frontend - Algarion (Gemini v1 Stable)
 * Dibuat untuk Nyaman Center Team
 */

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// --- KONFIGURASI API ---
const GEMINI_API_KEY = "AIzaSyDzU2irYfJ3A3RcLW7OPp4vYhHEOvplt2A";
// Menggunakan API v1 untuk stabilitas maksimal
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

let chatHistory = [];
let brainReference = "";
let isBrainLoaded = false;

/**
 * Memuat profil dari profile.txt sebagai basis data Algarion
 */
async function loadBrain() {
    try {
        const response = await fetch("/profile.txt");
        if (!response.ok) throw new Error("File profile.txt tidak ditemukan");
        brainReference = await response.text();
        
        isBrainLoaded = true;
        addMessageToChat("assistant", "Halo brot! Saya Algarion dari Nyaman Center Team. Ada yang bisa saya bantu??");
    } catch (e) {
        console.error("Gagal memuat otak:", e);
        brainReference = "Nama: Algarion. Tim: Nyaman Center.";
        addMessageToChat("assistant", "Halo brot! Saya Algarion. Sistem referensi lagi limit, tapi saya siap bantu.");
        isBrainLoaded = true;
    }
}

// Jalankan saat halaman dibuka
loadBrain();

/**
 * Fungsi utama untuk mengirim pesan ke Google Gemini
 */
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message || !isBrainLoaded) return;

    // Kunci UI selama proses
    userInput.disabled = true;
    sendButton.disabled = true;

    // Tampilkan pesan user di layar
    addMessageToChat("user", message);
    userInput.value = "";
    typingIndicator.classList.add("visible");

    // Instruksi sistem agar AI tidak ngaco dan tidak membawa info tidak relevan
    const systemPrompt = `Kamu adalah Algarion dari Nyaman Center Team.
    Gunakan data ini hanya sebagai referensi: [${brainReference}].
    
    ATURAN KETAT:
    1. Selalu panggil pengguna dengan 'brot' atau 'teman'.
    2. Gunakan tanda baca (titik, koma) yang benar.
    3. Jika pertanyaan di luar profil tim, jawab secara umum dan akurat.
    4. JANGAN menyebutkan nama anggota (Mosquito/Kiyara) atau sejarah perjuangan jika tidak ditanya khusus tentang tim.
    5. Jika tidak tahu, katakan tidak tahu dengan jujur.`;

    // Susun payload untuk Gemini API v1
    const contents = [
        {
            role: "user",
            parts: [{ text: systemPrompt }]
        }
    ];

    // Masukkan riwayat percakapan sebelumnya
    chatHistory.forEach(msg => {
        contents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }]
        });
    });

    // Masukkan pesan terbaru dari user
    contents.push({
        role: "user",
        parts: [{ text: message }]
    });

    try {
        const res = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error?.message || "Koneksi Google Gemini terputus.");
        }

        // Ambil teks hasil generate dari Gemini
        const responseText = data.candidates[0].content.parts[0].text;

        // Tampilkan jawaban asisten di layar
        addMessageToChat("assistant", responseText);

        // Simpan ke riwayat chat
        chatHistory.push({ role: "user", content: message });
        chatHistory.push({ role: "assistant", content: responseText });

        // Batasi memori agar tidak terlalu berat (20 pesan terakhir)
        if (chatHistory.length > 20) chatHistory.splice(0, 2);

    } catch (err) {
        console.error("Chat Error:", err);
        addMessageToChat("assistant", "Waduh brot, otak saya lagi hang: " + err.message);
    } finally {
        userInput.disabled = false;
        sendButton.disabled = false;
        typingIndicator.classList.remove("visible");
        userInput.focus();
    }
}

/**
 * Fungsi untuk menampilkan balon chat di UI
 */
function addMessageToChat(role, content) {
    const div = document.createElement("div");
    div.className = `message ${role}-message`;
    
    // Elemen Nama/Label
    const label = document.createElement("a");
    label.className = "sender-link";
    if (role === "assistant") {
        label.innerText = "ALGARION";
        label.href = "https://nyamancenter.my.id/";
        label.target = "_blank";
    } else {
        label.innerText = "KAMU";
        label.style.cursor = "default";
        label.style.textDecoration = "none";
    }
    
    const p = document.createElement("p");
    p.textContent = content;
    
    div.appendChild(label);
    div.appendChild(p);

    // Fitur Salin Jawaban untuk asisten
    if (role === "assistant" && content.length > 5) {
        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.innerText = "Salin Jawaban";
        copyBtn.style.display = "block";
        copyBtn.style.marginTop = "8px";
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(content);
            copyBtn.innerText = "Tersalin!";
            setTimeout(() => copyBtn.innerText = "Salin Jawaban", 2000);
        };
        div.appendChild(copyBtn);
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Event Listeners
sendButton.onclick = sendMessage;
userInput.onkeydown = (e) => { 
    if(e.key === "Enter" && !e.shiftKey) { 
        e.preventDefault(); 
        sendMessage(); 
    } 
};