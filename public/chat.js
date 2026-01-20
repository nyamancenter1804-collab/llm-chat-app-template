const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

let chatHistory = [];
let isProcessing = false;
let isBrainLoaded = false;

// Fungsi untuk memuat "Otak" (profile.txt)
async function loadBrain() {
    try {
        const response = await fetch("/profile.txt");
        if (!response.ok) throw new Error("File otak tidak ditemukan");
        const brainData = await response.text();
        
        // Memasukkan data otak ke dalam System Prompt yang permanen
        chatHistory = [{ 
            role: "system", 
            content: `Kamu adalah Algarion, AI buatan Nyaman Center Team. Gunakan informasi berikut sebagai otak dan basis pengetahuanmu: ${brainData}. Selalu gunakan tanda baca lengkap (. , ! ?).` 
        }];
        
        isBrainLoaded = true;
        addMessageToChat("assistant", "Halo! Otak saya sudah siap. Saya Algarion dari Nyaman Center Team. Ada yang bisa saya bantu??");
    } catch (e) {
        console.error("Gagal memuat otak:", e);
        chatHistory = [{ role: "system", content: "Kamu adalah Algarion dari Nyaman Center Team." }];
        addMessageToChat("assistant", "Halo! Saya Algarion. Sepertinya ada bagian memori saya yang tertinggal, tapi saya siap membantu!");
        isBrainLoaded = true; 
    }
}

loadBrain();

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message || isProcessing || !isBrainLoaded) return;

    isProcessing = true;
    userInput.disabled = true;
    sendButton.disabled = true;

    addMessageToChat("user", message);
    chatHistory.push({ role: "user", content: message });
    userInput.value = "";
    typingIndicator.classList.add("visible");

    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: chatHistory }), // Mengirim seluruh history termasuk otak
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let responseText = "";

        const msgDiv = document.createElement("div");
        msgDiv.className = "message assistant-message";
        msgDiv.setAttribute("data-sender", "Algarion");
        const p = document.createElement("p");
        msgDiv.appendChild(p);
        chatMessages.appendChild(msgDiv);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            // Membersihkan data stream agar lebih akurat
            const lines = chunk.split("\n");
            for (const line of lines) {
                if (line.trim().startsWith("data: ")) {
                    const dataStr = line.replace("data: ", "").trim();
                    if (dataStr === "[DONE]") break;
                    try {
                        const json = JSON.parse(dataStr);
                        const content = json.response || json.choices?.[0]?.delta?.content || "";
                        responseText += content;
                        p.textContent = responseText;
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    } catch (err) {}
                }
            }
        }

        // Simpan jawaban asisten ke history agar ingatan berlanjut
        chatHistory.push({ role: "assistant", content: responseText });

        // Tambahkan tombol salin
        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.innerText = "Salin Jawaban";
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(responseText);
            copyBtn.innerText = "Tersalin!";
            setTimeout(() => copyBtn.innerText = "Salin Jawaban", 2000);
        };
        msgDiv.appendChild(copyBtn);

    } catch (err) {
        addMessageToChat("assistant", "Maaf brot, koneksi otak saya terganggu.");
    } finally {
        isProcessing = false;
        userInput.disabled = false;
        sendButton.disabled = false;
        typingIndicator.classList.remove("visible");
        userInput.focus();
    }
}

function addMessageToChat(role, content) {
    const div = document.createElement("div");
    div.className = `message ${role}-message`;
    div.setAttribute("data-sender", role === "user" ? "Kamu" : "Algarion");
    div.innerHTML = `<p>${content}</p>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendButton.onclick = sendMessage;
userInput.onkeydown = (e) => { if(e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };