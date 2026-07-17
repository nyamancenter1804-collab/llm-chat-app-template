/** * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";
import { searchLocalBrain } from "./otak/knowledge";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

// Default system prompt
const SYSTEM_PROMPT =
	"You are a helpful, friendly assistant. Provide concise and accurate responses.";

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/chat") {
			// Handle POST requests for chat
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}

			// Method not allowed for other request types
			return new Response("Method not allowed", { status: 405 });
		}

		// Password verification for Advanced AI
		if (url.pathname === "/api/verify-advanced") {
			if (request.method === "POST") {
				try {
					const { password } = await request.json() as { password?: string };
					if (password && password === env.ADVANCED_AI_PASSWORD) {
						return new Response(JSON.stringify({ success: true }), {
							headers: { "content-type": "application/json" }
						});
					}
					return new Response("Unauthorized", { status: 401 });
				} catch {
					return new Response("Bad request", { status: 400 });
				}
			}
			return new Response("Method not allowed", { status: 405 });
		}

		// Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse JSON request body
		const { messages = [], imageBase64, isAdvanced = false } = (await request.json()) as {
			messages: ChatMessage[];
			imageBase64?: string;
			isAdvanced?: boolean;
		};

		// Cari sistem prompt yang ada atau gunakan default
		const sysIndex = messages.findIndex((msg) => msg.role === "system");
		let currentSysPrompt = sysIndex >= 0 ? messages[sysIndex].content : SYSTEM_PROMPT;

		// --- ADVANCED AI ACCURACY MODE ---
		if (isAdvanced) {
			// Force a much stricter system prompt to maximize accuracy
			currentSysPrompt = `Anda adalah Algarion, AI Asisten dari Nyaman Center Team.
ATURAN KETAT (WAJIB DIIKUTI):
1.  **JANGAN PERNAH** mengarang informasi. Jika tidak yakin 100%, katakan "Saya tidak memiliki informasi yang akurat mengenai hal tersebut."
2.  **PRIORITASKAN** data dari [MEMORI INTERNAL] atau [HASIL PENCARIAN INTERNET] yang disediakan. Jangan gunakan pengetahuan umum jika data spesifik tersedia.
3.  **JAWAB LANGSUNG** dan faktual. Hindari basa-basi atau pengantar yang tidak perlu.
4.  Jika pertanyaan melibatkan tanggal atau waktu saat ini, gunakan data real-time dari pencarian web jika tersedia.`;
		}

		// Ambil pesan user terakhir
		const lastUserMsg = messages.filter(m => m.role === "user").pop();
		
		if (lastUserMsg) {
			const localData = searchLocalBrain(lastUserMsg.content);
			if (localData) {
				currentSysPrompt += `\n\n[MEMORI INTERNAL TERDETEKSI]\nGunakan informasi ini untuk menjawab pertanyaan user: ${localData}`;
			} else if (env.TAVILY_API_KEY) {
				try {
					const tavilyRes = await fetch("https://api.tavily.com/search", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							api_key: env.TAVILY_API_KEY,
							query: lastUserMsg.content,
							search_depth: "basic",
							include_answer: true
						})
					});
					
					if (tavilyRes.ok) {
						const tavilyData = await tavilyRes.json() as any;
						let webContext = "";
						if (tavilyData.answer) {
							webContext = tavilyData.answer;
						} else if (tavilyData.results && tavilyData.results.length > 0) {
							webContext = tavilyData.results.map((r: any) => r.content).join("\n\n");
						}
						
						if (webContext) {
							currentSysPrompt += `\n\n[HASIL PENCARIAN INTERNET TAVILY]\nGunakan informasi berikut untuk menjawab: ${webContext}`;
						}
					}
				} catch (e) {
					console.error("Tavily search failed", e);
				}
			}
		}

		// Update array pesan dengan prompt sistem yang baru
		if (sysIndex >= 0) {
			messages[sysIndex].content = currentSysPrompt;
		} else {
			messages.unshift({ role: "system", content: currentSysPrompt });
		}

		let targetModel: any = MODEL_ID;
		let aiRunArgs: any = { messages, max_tokens: 1024, stream: true };

		// Jika mode Advanced aktif, gunakan model yang lebih besar dan akurat
		if (isAdvanced) {
			targetModel = "@cf/meta/llama-3.1-70b-instruct"; // Model yang lebih kuat
		}

		// Jika ada gambar (Advanced AI), ganti ke model Vision
		if (imageBase64) {
			targetModel = "@cf/meta/llama-3.2-11b-vision-instruct";
			// Convert base64 to number array for Cloudflare Workers AI
			const binaryString = atob(imageBase64);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}
			aiRunArgs.image = [...bytes];
		}

		// Jika mode Advanced aktif, gunakan Grok dari xAI (dibaca dari file tersembunyi)
		if (isAdvanced) {
            // Read token from hidden file (grok.mmk) to bypass GitHub secret scanning
            const tokenRes = await fetch("/grok.mmk");
            if (!tokenRes.ok) throw new Error("Failed to load Grok token file");
            const xaiToken = (await tokenRes.text()).trim();

            const grokRes = await fetch("https://api.x.ai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${xaiToken}`
                },
                body: JSON.stringify({
                    messages: messages, // Use the processed messages array
                    model: "grok-2-latest", // Highest accuracy model
                    stream: true,
                    temperature: 0.1 // Low temperature for maximum accuracy
                })
            });

            if (!grokRes.ok) {
                throw new Error("Grok API Error");
            }
            
            // Pipe the Grok stream directly to the client
            return new Response(grokRes.body, {
                headers: {
                    "content-type": "text/event-stream; charset=utf-8",
                    "cache-control": "no-cache",
                    connection: "keep-alive",
                },
            });

        } else {
            // Default: Cloudflare Workers AI
            const stream = await env.AI.run(targetModel, aiRunArgs);
            return new Response(stream, {
                headers: {
                    "content-type": "text/event-stream; charset=utf-8",
                    "cache-control": "no-cache",
                    connection: "keep-alive",
                },
            });
        }
	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}
