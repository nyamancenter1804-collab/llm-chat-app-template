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
let currentImageBase64 = null;

const advancedToggle = document.getElementById("advanced-ai-toggle");
const imageUpload = document.getElementById("image-upload");
const btnUploadTrigger = document.getElementById("btn-upload-trigger");
const imageNameDisplay = document.getElementById("image-name-display");

let advancedAIUnlocked = false;

// Get password UI elements
const passwordContainer = document.getElementById("password-container");
const passwordInput = document.getElementById("advanced-password");
const submitPasswordBtn = document.getElementById("btn-submit-password");
const passwordError = document.getElementById("password-error");
const uploadContainer = document.getElementById("upload-container");

advancedToggle.addEventListener("change", (e) => {
    if (e.target.checked) {
        // Require password before enabling Advanced AI
        if (!advancedAIUnlocked) {
            // Show password input field (accessible for NVDA)
            passwordContainer.style.display = "block";
            passwordInput.focus();
        } else {
            // Already unlocked this session
            passwordContainer.style.display = "none";
            uploadContainer.style.display = "block";
        }
    } else {
        // Reset everything when toggled off
        passwordContainer.style.display = "none";
        uploadContainer.style.display = "none";
        passwordInput.value = "";
        passwordError.style.display = "none";
        imageUpload.value = "";
        imageNameDisplay.textContent = "";
        currentImageBase64 = null;
    }
});

// Handle password submission - validate via server
submitPasswordBtn.onclick = async () => {
    const entered = passwordInput.value.trim();
    if (!entered) {
        passwordError.style.display = "block";
        passwordInput.focus();
        return;
    }
    
    try {
        // Send password to server for validation
        const res = await fetch("/api/verify-advanced", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: entered })
        });
        
        if (res.ok) {
            advancedAIUnlocked = true;
            passwordContainer.style.display = "none";
            uploadContainer.style.display = "block";
            passwordError.style.display = "none";
            passwordInput.value = "";
        } else {
            passwordError.style.display = "block";
            passwordInput.value = "";
            passwordInput.focus();
        }
    } catch (err) {
        console.error("Password verification failed", err);
        passwordError.style.display = "block";
    }
};

// Allow Enter key in password field
passwordInput.onkeydown = (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        submitPasswordBtn.click();
    }
};

btnUploadTrigger.addEventListener("click", () => {
    imageUpload.click();
});

imageUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        imageNameDisplay.textContent = "Foto: " + file.name;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const base64str = evt.target.result.split(',')[1];
            currentImageBase64 = base64str;
        };
        reader.readAsDataURL(file);
    }
});

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
        const payload = { messages: chatHistory };
        if (currentImageBase64 && advancedToggle.checked) {
            payload.imageBase64 = currentImageBase64;
        }

        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
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
        
        // Elemen khusus untuk pengumuman pembaca layar (Screen Reader)
        const srAnnouncer = document.createElement("div");
        srAnnouncer.setAttribute("aria-live", "polite");
        srAnnouncer.style.position = "absolute";
        srAnnouncer.style.width = "1px";
        srAnnouncer.style.height = "1px";
        srAnnouncer.style.overflow = "hidden";
        srAnnouncer.textContent = "Algarion sedang mengetik...";
        
        const p = document.createElement("p");
        p.textContent = "Sedang mengetik...";
        
        msgDiv.appendChild(srAnnouncer);
        
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
                        // Ambil konten dari response streaming
                        const content = json.response || json.choices?.[0]?.delta?.content || "";
                        responseText += content;
                        
                        // JANGAN update p.textContent di sini agar screen reader tidak nyepam (spamming)
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    } catch (err) {
                        // Skip jika json tidak valid
                    }
                }
            }
        }

        // Update pengumuman pembaca layar dan tampilkan teks utuh
        srAnnouncer.textContent = "Algarion membalas.";
        p.textContent = responseText;
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
        
        // Reset image setelah dikirim
        if (currentImageBase64) {
            imageUpload.value = "";
            imageNameDisplay.textContent = "";
            currentImageBase64 = null;
        }
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