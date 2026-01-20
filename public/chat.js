/**
 * LLM Chat App Frontend - Algarion (Gemini Edition)
 * Optimized for Nyaman Center Team
 */

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// MASUKKAN API KEY KAMU DI SINI
const GEMINI_API_KEY = "AIzaSyDzU2irYfJ3A3RcLW7OPp4vYhHEOvplt2A";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

let chatHistory = [];
let brainReference = "";
let isBrainLoaded = false;

/**
 * Memuat profil dari profile.txt
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
        addMessageToChat("assistant", "Halo brot! Saya Algarion. Ada yang bisa saya bantu??");
        isBrainLoaded = true;
    }
}

// Jalankan saat startup
loadBrain();

/**
 * Fungsi kirim pesan ke Gemini
 */
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message || !isBrainLoaded) return;

    // Kunci UI
    userInput.disabled = true;
    sendButton.disabled = true;

    // Tampilkan pesan user
    addMessageToChat("user", message);
    userInput.value = "";
    typingIndicator.classList.add("visible");

    // Susun instruksi ketat agar tidak berhalusinasi (Fix masalah Kiyara & Sejarah)
    const systemPrompt = `Identitas Anda: Algarion dari Nyaman Center Team.
    Data Referensi: [${brainReference}].
    
    ATURAN JAWABAN:
    1. Selalu panggil pengguna dengan sebutan 'brot' atau 'teman'.
    2. Gunakan tanda baca (titik, koma) yang benar dan rapi.
    3. Jika ditanya hal umum, jawab secara akurat seperti Google Search.
    4. JANGAN pernah menyebutkan profil tim, nama anggota (Mosquito/Kiyara), atau sejarah perjuangan bangsa jika TIDAK RELEVAN dengan pertanyaan.
    5. Tetap jujur dan jangan melebih-lebihkan fakta.`;

    // Format data untuk Google Gemini
    const contents = [
        {
            role: "user",
            parts: [{ text: systemPrompt }]
        }
    ];

    // Masukkan riwayat chat (history)
    chatHistory.forEach(msg => {
        contents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }]
        });
    });

    // Masukkan pesan terbaru
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
            throw new Error(data.error?.message || "Terjadi kesalahan pada API Gemini");
        }

        // Ambil teks jawaban dari struktur JSON Gemini
        const responseText = data.candidates[0].content.parts[0].text;

        // Tampilkan jawaban Algarion
        addMessageToChat("assistant", responseText);

        // Simpan ke history agar AI ingat percakapan sebelumnya
        chatHistory.push({ role: "user", content: message });
        chatHistory.push({ role: "assistant", content: responseText });

        // Batasi history agar tidak terlalu berat (opsional, misal 10 pesan terakhir)
        if (chatHistory.length > 20) chatHistory.shift();

    } catch (err) {
        console.error("Error:", err);
        addMessageToChat("assistant", "Waduh brot, otak saya lagi hang: " + err.message);
    } finally {
        userInput.disabled = false;
        sendButton.disabled = false;
        typingIndicator.classList.remove("visible");
        userInput.focus();
    }
}

/**
 * Fungsi menampilkan pesan di layar
 */
function addMessageToChat(role, content) {
    const div = document.createElement("div");
    div.className = `message ${role}-message`;
    
    // Header Nama
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

    // Tombol Salin (Hanya untuk jawaban asisten)
    if (role === "assistant" && content.length > 10) {
        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.innerText = "Salin";
        copyBtn.style.display = "block";
        copyBtn.style.marginTop = "5px";
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(content);
            copyBtn.innerText = "Tersalin!";
            setTimeout(() => copyBtn.innerText = "Salin", 2000);
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