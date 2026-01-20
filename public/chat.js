/**
 * LLM Chat App Frontend - Nyaman Center Team
 * Optimized version to prevent hallucination and improve accuracy
 */

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

let chatHistory = [];
let isProcessing = false;
let isBrainLoaded = false;

/**
 * Memuat profil dari profile.txt dan menyetel instruksi sistem agar AI 
 * tidak memalsukan informasi (Anti-Hallucination).
 */
async function loadBrain() {
    try {
        const response = await fetch("/profile.txt");
        if (!response.ok) throw new Error("Gagal memuat profile.txt");
        
        const brainData = await response.text();
        
        // System Prompt diperketat agar AI jujur dan objektif
        chatHistory = [{ 
            role: "system", 
            content: `Anda adalah Algarion, asisten virtual dari Nyaman Center Team (https://nyamancenter.my.id/).
            
            ATURAN UTAMA:
            1. Gunakan data berikut sebagai referensi utama: [${brainData}].
            2. JANGAN PERNAH memalsukan informasi atau melebih-lebihkan fakta tentang Nyaman Center.
            3. Jika informasi tidak tersedia di referensi, gunakan pengetahuan umum yang akurat (seperti data dari Google).
            4. Jika benar-benar tidak tahu, katakan tidak tahu secara sopan.
            5. Jawablah secara jujur, objektif, dan informatif.` 
        }];
        
        isBrainLoaded = true;
        addMessageToChat("assistant", "Halo! Saya Algarion dari Nyaman Center Team. Ada yang bisa saya bantu?");
    } catch (e) {
        console.error("Error loading brain:", e);
        chatHistory = [{ 
            role: "system", 
            content: "Kamu Algarion dari Nyaman Center Team. Berikan jawaban yang jujur dan akurat berdasarkan fakta." 
        }];
        addMessageToChat("assistant", "Halo! Saya Algarion. Sistem referensi sedang terbatas, tapi saya siap membantu.");
        isBrainLoaded = true;
    }
}

// Inisialisasi saat script dimuat
loadBrain();

/**
 * Fungsi utama untuk mengirim pesan dan menangani streaming response
 */
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message || isProcessing || !isBrainLoaded) return;

    // Kunci UI agar tidak terjadi double-send
    isProcessing = true;
    userInput.disabled = true;
    sendButton.disabled = true;

    // Tampilkan pesan user di UI
    addMessageToChat("user", message);
    chatHistory.push({ role: "user", content: message });
    userInput.value = "";
    typingIndicator.classList.add("visible");

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: chatHistory }),
        });

        if (!res.ok) throw new Error("API Error");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let responseText = "";

        // Buat elemen balon chat asisten (Algarion)
        const msgDiv = document.createElement("div");
        msgDiv.className = "message assistant-message";
        
        const label = document.createElement("a");
        label.className = "sender-link";
        label.innerText = "ALGARION";
        label.href = "https://nyamancenter.my.id/";
        label.target = "_blank";
        
        const p = document.createElement("p");
        msgDiv.appendChild(label);
        msgDiv.appendChild(p);
        chatMessages.appendChild(msgDiv);

        // Streaming logic
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");
            
            for (const line of lines) {
                if (line.trim().startsWith("data: ")) {
                    const dataStr = line.replace("data: ", "").trim();
                    if (dataStr === "[DONE]") break;
                    
                    try {
                        const json = JSON.parse(dataStr);
                        // Ambil konten dari response streaming (menangani berbagai format API)
                        const content = json.response || json.choices?.[0]?.delta?.content || "";
                        responseText += content;
                        p.textContent = responseText;
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    } catch (err) {
                        // Skip jika json tidak valid
                    }
                }
            }
        }

        // Simpan jawaban lengkap ke riwayat
        chatHistory.push({ role: "assistant", content: responseText });

        // Tambahkan tombol salin setelah jawaban selesai
        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.innerText = "Salin Jawaban";
        copyBtn.style.marginTop = "10px";
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(responseText);
            copyBtn.innerText = "Tersalin!";
            setTimeout(() => copyBtn.innerText = "Salin Jawaban", 2000);
        };
        msgDiv.appendChild(copyBtn);

    } catch (err) {
        console.error("Chat Error:", err);
        addMessageToChat("assistant", "Maaf bro, koneksi ke otak saya terputus sebentar. Coba lagi ya.");
    } finally {
        isProcessing = false;
        userInput.disabled = false;
        sendButton.disabled = false;
        typingIndicator.classList.remove("visible");
        userInput.focus();
    }
}

/**
 * Fungsi helper untuk menampilkan pesan di UI
 */
function addMessageToChat(role, content) {
    const div = document.createElement("div");
    div.className = `message ${role}-message`;
    
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