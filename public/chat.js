/**
 * LLM Chat App Frontend
 * Identity Profile Loaded from profile.txt + Auto Copy Button
 */

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

let chatHistory = [];
let isProcessing = false;

/**
 * Fungsi untuk mengambil profil dari file .txt
 */
async function loadAIProfile() {
	try {
		const response = await fetch("/profile.txt");
		const profileData = await response.text();
		
		chatHistory = [
			{
				role: "system",
				content: `Kamu adalah Algarion. Ini adalah profil dan aturan kamu: ${profileData}`
			},
			{
				role: "assistant",
				content: "Halo! Saya adalah Algarion, asisten AI yang diciptakan oleh Nyaman Center Team. Ada yang bisa saya bantu hari ini?",
			},
		];
		// Pesan awal ini tidak perlu tombol copy jika kamu ingin hanya jawaban baru yang punya tombol
	} catch (error) {
		chatHistory = [{ role: "system", content: "Nama kamu Algarion dari Nyaman Center Team." }];
	}
}

loadAIProfile();

async function sendMessage() {
	const message = userInput.value.trim();
	if (message === "" || isProcessing) return;

	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	// User message (Tanpa tombol copy)
	addMessageToChat("user", message);

	userInput.value = "";
	userInput.style.height = "auto";
	typingIndicator.classList.add("visible");

	chatHistory.push({ role: "user", content: message });

	try {
		// Buat elemen pesan assistant kosong dulu untuk streaming
		const assistantMessageEl = document.createElement("div");
		assistantMessageEl.className = "message assistant-message";
		assistantMessageEl.setAttribute("data-sender", "Algarion");
		assistantMessageEl.innerHTML = "<p></p>";
		chatMessages.appendChild(assistantMessageEl);
		
		const assistantTextEl = assistantMessageEl.querySelector("p");
		chatMessages.scrollTop = chatMessages.scrollHeight;

		const response = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: chatHistory }),
		});

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let responseText = "";
		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const parsed = consumeSseEvents(buffer);
			buffer = parsed.buffer;

			for (const data of parsed.events) {
				if (data === "[DONE]") break;
				try {
					const jsonData = JSON.parse(data);
					let content = jsonData.response || jsonData.choices?.[0]?.delta?.content || "";
					if (content) {
						responseText += content;
						assistantTextEl.textContent = responseText;
						chatMessages.scrollTop = chatMessages.scrollHeight;
					}
				} catch (e) {}
			}
		}

		// SETELAH SELESAI MENGETIK: Tambahkan tombol salin
		if (responseText.length > 0) {
			chatHistory.push({ role: "assistant", content: responseText });
			
			const copyBtn = document.createElement("button");
			copyBtn.className = "copy-btn";
			copyBtn.innerText = "Salin Jawaban";
			copyBtn.onclick = function() {
				navigator.clipboard.writeText(responseText).then(() => {
					copyBtn.innerText = "Tersalin!";
					setTimeout(() => { copyBtn.innerText = "Salin Jawaban"; }, 2000);
				});
			};
			assistantMessageEl.appendChild(copyBtn);
		}

	} catch (error) {
		console.error("Error:", error);
		addMessageToChat("assistant", "Maaf, ada kendala teknis.");
	} finally {
		typingIndicator.classList.remove("visible");
		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.focus();
	}
}

/**
 * Fungsi pembantu untuk tambah pesan (digunakan untuk user)
 */
function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");
	messageEl.className = `message ${role}-message`;
	messageEl.setAttribute("data-sender", role === "user" ? "Kamu" : "Algarion");
	messageEl.innerHTML = `<p>${content}</p>`;
	
	// Jika assistant yang bicara lewat fungsi ini (misal saat error), beri tombol copy
	if (role === "assistant") {
		const copyBtn = document.createElement("button");
		copyBtn.className = "copy-btn";
		copyBtn.innerText = "Salin Jawaban";
		copyBtn.onclick = () => navigator.clipboard.writeText(content);
		messageEl.appendChild(copyBtn);
	}

	chatMessages.appendChild(messageEl);
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

function consumeSseEvents(buffer) {
	let normalized = buffer.replace(/\r/g, "");
	const events = [];
	let eventEndIndex;
	while ((eventEndIndex = normalized.indexOf("\n\n")) !== -1) {
		const rawEvent = normalized.slice(0, eventEndIndex);
		normalized = normalized.slice(eventEndIndex + 2);
		const lines = rawEvent.split("\n");
		const dataLines = [];
		for (const line of lines) {
			if (line.startsWith("data:")) {
				dataLines.push(line.slice(5).trimStart());
			}
		}
		if (dataLines.length > 0) events.push(dataLines.join("\n"));
	}
	return { events, buffer: normalized };
}