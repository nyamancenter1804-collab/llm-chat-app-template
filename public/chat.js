/**
 * LLM Chat App Frontend - Nyaman Center Team
 */

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

let chatHistory = [];
let isProcessing = false;
let isBrainLoaded = false;

// Muat Profil sebagai Otak
async function loadBrain() {
    try {
        const response = await fetch("/profile.txt");
        const brainData = await response.text();
        
        chatHistory = [{ 
            role: "system", 
            content: `Kamu Algarion dari Nyaman Center Team (https://nyamancenter.my.id/). Otakmu: ${brainData}` 
        }];
        
        isBrainLoaded = true;
        addMessageToChat("assistant", "Halo! Saya Algarion dari Nyaman Center Team. Ada yang bisa saya bantu??");
    } catch (e) {
        chatHistory = [{ role: "system", content: "Kamu Algarion dari Nyaman Center Team." }];
        addMessageToChat("assistant", "Halo! Saya Algarion. Ada yang bisa saya bantu??");
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
            body: JSON.stringify({ messages: chatHistory }),
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let responseText = "";

        // Buat balon chat dengan Link pada Nama
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
                        responseText += json.response || json.choices?.[0]?.delta?.content || "";
                        p.textContent = responseText;
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    } catch (err) {}
                }
            }
        }

        chatHistory.push({ role: "assistant", content: responseText });

        // Tombol Salin
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
    
    const label = document.createElement("a");
    label.className = "sender-link";
    if (role === "assistant") {
        label.innerText = "ALGARION";
        label.href = "https://nyamancenter.my.id/";
        label.target = "_blank";
    } else {
        label.innerText = "KAMU";
        label.style.cursor = "default";
    }
    
    const p = document.createElement("p");
    p.textContent = content;
    
    div.appendChild(label);
    div.appendChild(p);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendButton.onclick = sendMessage;
userInput.onkeydown = (e) => { if(e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };