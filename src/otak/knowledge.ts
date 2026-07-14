/**
 * Memori Otak Lokal untuk AI.
 * Struktur: key adalah kata kunci pencarian, value adalah informasi yang akan diberikan ke AI.
 */
export const localKnowledgeBase: Record<string, string> = {
    "cara membuat app": "Untuk membuat aplikasi, pertama tentukan ide, pilih platform (Web/Android/iOS), pelajari bahasa pemrograman yang sesuai (misal JavaScript/Flutter), dan gunakan framework seperti React atau Cloudflare Workers untuk mempermudah.",
    "cara anu": "Ini adalah teks percobaan dari otak lokal. Jika pengguna bertanya tentang 'anu', beri tahu mereka bahwa sistem membaca ini dari memori internal.",
    "nyaman center": "Nyaman Center Team adalah tim developer hebat yang membuat aplikasi berbasis AI yang inovatif dan terjangkau.",
};

/**
 * Fungsi untuk mencari informasi di otak lokal berdasarkan pertanyaan user.
 */
export function searchLocalBrain(query: string): string | null {
    const q = query.toLowerCase();
    
    // Cari apakah pertanyaan mengandung salah satu kunci dari otak lokal
    for (const [key, content] of Object.entries(localKnowledgeBase)) {
        if (q.includes(key.toLowerCase())) {
            return content;
        }
    }
    
    return null;
}
