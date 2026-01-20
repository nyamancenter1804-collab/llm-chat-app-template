/**
 * LLM Chat App Frontend
 * Identity Profile Loaded from profile.txt
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
		// Mengambil file profile.txt dari server Cloudflare Pages
		const response = await fetch("/profile.txt");
		const profileData = await response.text();
		
		// Set chatHistory awal dengan profil dari file txt
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
		console.log("Profile Algarion berhasil dimuat!");
	} catch (error) {
		console.error("Gagal memuat profile.txt, menggunakan profil default.", error);
		// Fallback jika file txt tidak ditemukan
		chatHistory = [{ role: "system", content: "Nama kamu Algarion dari Nyaman Center Team." }];
	}
}

// Panggil fungsi muat profil saat script dijalankan
loadAIProfile();

// --- Sisa kode logika chat tetap sama ---

userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = this.scrollHeight + "px";
});

userInput.addEventListener("keydown", function (e) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

sendButton.addEventListener("click", sendMessage);

async function sendMessage() {
	const message = userInput.value.trim();
	if (message === "" || isProcessing) return;

	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	addMessageToChat("user", message);
	userInput.value = "";
	userInput.style.height = "auto";
	typingIndicator.classList.add("visible");

	chatHistory.push({ role: "user", content: message });

	try {
		const assistantMessageEl = document.createElement("div");
		assistantMessageEl.className = "message assistant-message";
		assistantMessageEl.innerHTML = "<p></p>";
		chatMessages.appendChild(assistantMessageEl);
		const assistantTextEl = assistantMessageEl.querySelector("p");

		chatMessages.scrollTop = chatMessages.scrollHeight;

		const response = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: chatHistory }),
		});

		if (!response.ok) throw new Error("Failed to get response");
		
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let responseText = "";
		let buffer = "";

		const flushAssistantText = () => {
			assistantTextEl.textContent = responseText;
			chatMessages.scrollTop = chatMessages.scrollHeight;
		};

		let sawDone = false;
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				const parsed = consumeSseEvents(buffer + "\n\n");
				for (const data of parsed.events) {
					if (data === "[DONE]") break;
					try {
						const jsonData = JSON.parse(data);
						let content = jsonData.response || jsonData.choices?.[0]?.delta?.content || "";
						if (content) {
							responseText += content;
							flushAssistantText();
						}
					} catch (e) {}
				}
				break;
			}

			buffer += decoder.decode(value, { stream: true });
			const parsed = consumeSseEvents(buffer);
			buffer = parsed.buffer;
			for (const data of parsed.events) {
				if (data === "[DONE]") {
					sawDone = true;
					break;
				}
				try {
					const jsonData = JSON.parse(data);
					let content = jsonData.response || jsonData.choices?.[0]?.delta?.content || "";
					if (content) {
						responseText += content;
						flushAssistantText();
					}
				} catch (e) {}
			}
			if (sawDone) break;
		}

		if (responseText.length > 0) {
			chatHistory.push({ role: "assistant", content: responseText });
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

function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");
	messageEl.className = `message ${role}-message`;
	messageEl.innerHTML = `<p>${content}</p>`;
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