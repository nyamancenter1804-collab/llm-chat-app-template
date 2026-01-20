const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

let chatHistory = [];
let isProcessing = false;

// Muat Profil dari profile.txt
async function loadAIProfile() {
    try {
        const response = await fetch("/profile.txt");
        const profileData = await response.text();
        chatHistory = [{ role: "system", content: `Kamu Algarion dari Nyaman Center Team. Aturan: ${profileData}` }];
        addMessageToChat("assistant", "Halo! Saya Algarion dari Nyaman Center Team. Ada yang bisa saya bantu??");
    } catch (e) {
        chatHistory = [{ role: "system", content: "Kamu Algarion dari Nyaman Center Team." }];
        addMessageToChat("assistant", "Halo! Ada yang bisa saya bantu??");
    }
}
loadAIProfile();

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message || isProcessing) return;

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
            body: JSON.stringify({ messages: chatHistory }),
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let responseText = "";

        // Buat balon chat assistant kosong dulu
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
            const lines = chunk.split("\n");
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const dataStr = line.slice(6);
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

        // Tambah tombol salin setelah selesai
        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.innerText = "Salin Jawaban";
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(responseText);
            copyBtn.innerText = "Tersalin!";
            setTimeout(() => copyBtn.innerText = "Salin Jawaban", 2000);
        };
        msgDiv.appendChild(copyBtn);
        chatHistory.push({ role: "assistant", content: responseText });

    } catch (err) {
        addMessageToChat("assistant", "Maaf, koneksi terputus.");
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