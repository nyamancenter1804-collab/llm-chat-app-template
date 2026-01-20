/**
 * LLM Chat App Frontend - Algarion (Gemini Edition)
 */

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// GANTI DENGAN API KEY GEMINI KAMU
const GEMINI_API_KEY = "AIzaSyDzU2irYfJ3A3RcLW7OPp4vYhHEOvplt2A";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${GEMINI_API_KEY}`;

let chatHistory = [];
let brainReference = ""; // Untuk menyimpan data profile.txt
let isBrainLoaded = false;

// 1. Load data profile.txt sebagai referensi fakta
async function loadBrain() {
    try {
        const response = await fetch("/profile.txt");
        brainReference = await response.text();
        isBrainLoaded = true;
        addMessageToChat("assistant", "Halo brot! Saya Algarion dari Nyaman Center Team. Ada yang bisa saya bantu??");
    } catch (e) {
        brainReference = "Algarion dari Nyaman Center Team.";
        addMessageToChat("assistant", "Halo brot! Saya Algarion. Ada yang bisa saya bantu??");
        isBrainLoaded = true;
    }
}

loadBrain();

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message || !isBrainLoaded) return;

    userInput.disabled = true;
    sendButton.disabled = true;

    addMessageToChat("user", message);
    userInput.value = "";
    typingIndicator.classList.add("visible");

    // Persiapkan format pesan untuk Gemini
    // Kita sisipkan instruksi ketat agar dia tidak ngaco
    const systemInstruction = `Nama kamu adalah Algarion dari Nyaman Center Team. 
    Gunakan referensi ini: [${brainReference}]. 
    ATURAN: 
    1. JANGAN memalsukan info atau membawa-bawa nama anggota jika tidak ditanya. 
    2. Panggil pengguna dengan 'brot' atau 'teman'. 
    3. Gunakan tanda baca titik dan koma yang benar. 
    4. Jika pertanyaan di luar profil, jawab secara normal menggunakan data Google.`;

    const contents = [
        { role: "user", parts: [{ text: systemInstruction }] },
        ...chatHistory.map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }]
        })),
        { role: "user", parts: [{ text: message }] }
    ];

    try {
        const res = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents })
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let responseText = "";

        const msgDiv = document.createElement("div");
        msgDiv.className = "message assistant-message";
        const label = createSenderLabel("ALGARION");
        const p = document.createElement("p");
        msgDiv.append(label, p);
        chatMessages.appendChild(msgDiv);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");
            
            for (const line of lines) {
                if (line.includes('"text":')) {
                    const match = line.match(/"text":\s*"(.*)"/);
                    if (match) {
                        // Unescape string (menangani \n, \", dll)
                        const cleanText = JSON.parse(`"${match[1]}"`);
                        responseText += cleanText;
                        p.textContent = responseText;
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                }
            }
        }

        chatHistory.push({ role: "user", content: message });
        chatHistory.push({ role: "assistant", content: responseText });

    } catch (err) {
        addMessageToChat("assistant", "Maaf brot, koneksi ke Google Gemini terganggu.");
    } finally {
        userInput.disabled = false;
        sendButton.disabled = false;
        typingIndicator.classList.remove("visible");
        userInput.focus();
    }
}

function createSenderLabel(name) {
    const label = document.createElement("a");
    label.className = "sender-link";
    label.innerText = name;
    label.href = "https://nyamancenter.my.id/";
    label.target = "_blank";
    return label;
}

function addMessageToChat(role, content) {
    const div = document.createElement("div");
    div.className = `message ${role}-message`;
    const label = (role === "assistant") ? createSenderLabel("ALGARION") : Object.assign(document.createElement("span"), {innerText: "KAMU", className: "sender-link"});
    const p = document.createElement("p");
    p.textContent = content;
    div.append(label, p);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendButton.onclick = sendMessage;
userInput.onkeydown = (e) => { if(e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };