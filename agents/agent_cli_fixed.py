import os
import json
import re
import shlex
import subprocess
import requests
import sys

# ===================================================================
# 1. KONFIGURASI AWAL
# ===================================================================

print("=" * 60)
print("🤖 AI TERMINAL AGENT (Otak Bebas, Eksekusi Terkunci)")
print("=" * 60)

root_dir = input("🔒 Masukkan path direktori yang diizinkan (contoh: C:\\Users\\oleh): ").strip()
if not os.path.exists(root_dir):
    print("❌ Path tidak ditemukan!")
    sys.exit(1)

root_dir = os.path.abspath(root_dir)
print(f"✅ Root direktori: {root_dir}")

API_URL = "https://llm-chat-app-template.nyamancenter1804.workers.dev/api/chat"
HEADERS = {"Content-Type": "application/json"}

current_dir = root_dir

# ===================================================================
# 2. FUNGSI KEAMANAN (JAIL)
# ===================================================================

def is_path_allowed(target_path):
    try:
        target_abs = os.path.abspath(target_path)
        common = os.path.commonpath([target_abs, root_dir])
        return common == root_dir
    except ValueError:
        return False

def sanitize_command(cmd_str):
    if not cmd_str:
        return True, "OK"
    try:
        parts = shlex.split(cmd_str)
    except ValueError:
        return False, "Format perintah tidak valid"
    for part in parts:
        if '..' in part:
            return False, f"Mengandung '..' pada argumen: {part}"
        if os.path.isabs(part):
            if not is_path_allowed(part):
                return False, f"Path absolut '{part}' di luar jail"
    return True, "OK"

# ===================================================================
# 3. FUNGSI KONEKSI KE AI (STREAMING) - PROMPT GENERIK TANPA CONTOH
# ===================================================================

def call_ai(user_input, current_path):
    """
    Kirim pesan ke API Algarion (streaming).
    Kembalikan {"reply": "...", "command": "..."}
    """

    # ===== PROMPT DENGAN FEW-SHOT EXAMPLES + ATURAN FORMAT KETAT =====
    # Model kecil (spt Llama 8B lewat Workers AI) sering tidak patuh ke
    # instruksi format kalau tidak dikasih contoh nyata. Contoh di bawah
    # BUKAN untuk membatasi kemampuan AI, tapi mengajari POLA outputnya.
    system_prompt = f"""Anda adalah asisten AI yang membantu pengguna mengoperasikan Windows.
Pengguna saat ini berada di folder: {root_dir}

ATURAN WAJIB (tidak boleh dilanggar):
1. Jawaban Anda HARUS berupa satu objek JSON valid dalam SATU BARIS, dan HANYA itu.
   Jangan tambahkan kalimat pembuka/penutup, jangan pakai markdown/backtick.
2. Struktur JSON HARUS persis seperti ini (semua field wajib ada, boleh kosong):
   {{"reply": "<penjelasan singkat Bahasa Indonesia>", "command": "<perintah CMD atau kosong>", "write_file": {{"path": "<nama file relatif, atau kosong>", "content": "<isi teks file, atau kosong>"}}}}
3. ATURAN PALING PENTING: Kalau permintaan pengguna adalah MENULIS/MEMBUAT ISI TEKS PANJANG ke sebuah file
   (cerpen, puisi, kode program, artikel, catatan, dsb), JANGAN gunakan "command" dengan "echo".
   WAJIB gunakan field "write_file" (path + content), karena "echo" di CMD tidak bisa menangani
   teks panjang, banyak baris, atau tanda kutip dengan aman.
4. Gunakan "command" HANYA untuk operasi sistem sederhana: membuat folder (mkdir), melihat isi
   folder (dir), menghapus (del/rmdir), pindah folder (cd), menjalankan program, dsb.
5. Dalam field "content", tulis newline sebagai \\n biasa (standar JSON string), JANGAN pakai
   tanda kutip dobel ("") untuk escape kutip — gunakan \\" jika benar-benar perlu kutip di isi teks.
6. Jika permintaan hanya obrolan biasa (bukan tindakan), kosongkan "command" dan "write_file".

CONTOH 1 (operasi folder sederhana -> pakai command)
User: "buatkan folder bernama Laporan2026"
Jawaban Anda: {{"reply": "Baik, saya akan membuat folder bernama Laporan2026 di direktori saat ini.", "command": "mkdir Laporan2026", "write_file": {{"path": "", "content": ""}}}}

CONTOH 2 (lihat isi folder -> pakai command)
User: "lihat isi folder ini"
Jawaban Anda: {{"reply": "Berikut daftar isi folder saat ini.", "command": "dir", "write_file": {{"path": "", "content": ""}}}}

CONTOH 3 (menulis konten panjang ke file -> WAJIB pakai write_file, BUKAN echo)
User: "buatkan file txt berisi cerpen singkat tentang tunanetra"
Jawaban Anda: {{"reply": "Baik, saya akan membuat file CerpenTunanetra.txt berisi cerpen singkat.", "command": "", "write_file": {{"path": "CerpenTunanetra.txt", "content": "Cahaya di Dalam Gelap\\n\\nAisyah tidak pernah melihat warna matahari terbit, tapi ia mengenalnya lewat hangatnya di kulit dan suara burung yang mulai ramai.\\n\\nBaginya, dunia bukan soal apa yang terlihat, tapi apa yang bisa dirasakan dengan sepenuh hati."}}}}

CONTOH 4 (membuat skrip python -> WAJIB pakai write_file)
User: "buatkan skrip python sederhana buat print hello world"
Jawaban Anda: {{"reply": "Baik, saya akan membuat file hello.py.", "command": "", "write_file": {{"path": "hello.py", "content": "print('Hello, world!')\\n"}}}}

CONTOH 5 (obrolan biasa, tanpa tindakan)
User: "kenapa langit berwarna biru?"
Jawaban Anda: {{"reply": "Langit tampak biru karena hamburan cahaya matahari oleh partikel di atmosfer (efek Rayleigh scattering).", "command": "", "write_file": {{"path": "", "content": ""}}}}

Ingat: SELALU balas HANYA dengan satu objek JSON seperti contoh di atas, dalam satu baris, tidak ada teks lain di luar JSON.
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_input}
    ]

    try:
        payload = {"messages": messages}
        response = requests.post(API_URL, headers=HEADERS, json=payload, stream=True, timeout=60)
        response.raise_for_status()

        full_content = ""

        for line in response.iter_lines(decode_unicode=True):
            if line and line.startswith("data: "):
                data_str = line[6:]
                try:
                    chunk = json.loads(data_str)
                    if "response" in chunk:
                        full_content += chunk["response"]
                    elif "content" in chunk:
                        full_content += chunk["content"]
                    elif "message" in chunk and "content" in chunk["message"]:
                        full_content += chunk["message"]["content"]
                    elif "choices" in chunk and len(chunk["choices"]) > 0:
                        delta = chunk["choices"][0].get("delta", {})
                        if "content" in delta:
                            full_content += delta["content"]
                except json.JSONDecodeError:
                    pass

        if not full_content:
            return {"reply": "⚠️ AI merespon kosong. Coba tanyakan lagi.", "command": ""}

        # >>> DEBUG: cetak balasan MENTAH sebelum diparse.
        # Kalau isinya sudah ngobrol umum / gak nyambung ke system prompt
        # kita (mis. kasih "motivasi" atau basa-basi), itu tanda server API
        # mengabaikan/menimpa system prompt custom kita dengan system
        # prompt bawaan mereka sendiri. Ini cara paling cepat memastikan
        # akar masalahnya di prompt kita atau di endpoint-nya.
        print("\n----- DEBUG: RAW RESPONSE DARI API -----")
        print(full_content)
        print("-----------------------------------------\n")

        full_content = full_content.strip().replace("```json", "").replace("```", "").strip()

        parsed = parse_ai_json(full_content)
        return parsed

    except requests.exceptions.RequestException as e:
        return {"reply": f"❌ Gagal koneksi ke API: {str(e)}", "command": "", "write_file": {"path": "", "content": ""}}
    except Exception as e:
        return {"reply": f"❌ Error tak terduga: {str(e)}", "command": "", "write_file": {"path": "", "content": ""}}


def parse_ai_json(full_content):
    """
    Parse balasan AI jadi {"reply", "command", "write_file": {"path","content"}}.
    Coba strict JSON dulu. Kalau gagal (mis. model salah escape kutip
    dengan "" alih-alih \\"), coba perbaikan otomatis, baru fallback ke
    ekstraksi manual per-field yang BENAR (bukan regex lama yang rusak
    karena tidak memperhitungkan tanda kutip penutup key JSON).
    """
    empty_wf = {"path": "", "content": ""}

    # 1) Coba strict JSON
    try:
        ai_json = json.loads(full_content)
        return {
            "reply": ai_json.get("reply", full_content),
            "command": ai_json.get("command", "") or "",
            "write_file": ai_json.get("write_file", empty_wf) or empty_wf,
        }
    except json.JSONDecodeError:
        pass

    # 2) Coba perbaikan umum: model kadang pakai "" untuk escape kutip
    #    di dalam value, padahal JSON butuh \". Ganti pola "" -> \" hanya
    #    di antara isi string (heuristik, tidak sempurna tapi menyelamatkan
    #    kasus paling umum dari model kecil).
    repaired = re.sub(r'(?<!^)""(?!,|\s*[}\]:])', '\\"', full_content)
    try:
        ai_json = json.loads(repaired)
        return {
            "reply": ai_json.get("reply", full_content),
            "command": ai_json.get("command", "") or "",
            "write_file": ai_json.get("write_file", empty_wf) or empty_wf,
        }
    except json.JSONDecodeError:
        pass

    # 3) Fallback terakhir: ekstraksi manual per field, BENAR secara
    #    struktur (memperhitungkan bahwa key JSON diapit tanda kutip,
    #    beda dengan regex versi lama yang gagal bahkan untuk JSON valid).
    def extract_field(key, text):
        m = re.search(r'"' + key + r'"\s*:\s*"', text)
        if not m:
            return ""
        start = m.end()
        tail = text[start:]
        # Potong di penanda akhir yang paling masuk akal: koma diikuti
        # key berikutnya, atau kurung tutup di akhir string.
        end_markers = ['",  "', '", "', '"}', '"\n}']
        cut = len(tail)
        for marker in end_markers:
            idx = tail.find(marker)
            if idx != -1:
                cut = min(cut, idx + 1)  # sertakan kutip penutup lalu dibuang di bawah
        value = tail[:cut]
        if value.endswith('"'):
            value = value[:-1]
        return value

    reply = extract_field("reply", full_content) or full_content
    command = extract_field("command", full_content)

    return {"reply": reply, "command": command, "write_file": empty_wf}

# ===================================================================
# 4. FUNGSI EKSEKUSI PERINTAH CMD (GENERIK)
# ===================================================================

def execute_cmd(command, cwd):
    """
    Jalankan perintah CMD apa pun dengan cmd.exe /c
    Tidak ada hack untuk kasus spesifik.
    """
    try:
        full_command = f'cmd.exe /c {command}'
        
        result = subprocess.run(
            full_command,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        
        output = result.stdout + result.stderr
        
        if not output.strip():
            return "(Perintah selesai, tidak ada output)"
        
        return output.strip()
    
    except Exception as e:
        return f"Error saat eksekusi: {str(e)}"

# ===================================================================
# 5. LOOP UTAMA
# ===================================================================

print("\n" + "=" * 60)
print("🚀 Agent siap digunakan. Ketik 'exit' untuk keluar.")
print(f"📂 Bekerja di: {current_dir}")
print("💡 AI = otak. APLIKASI = penjaga gerbang (jail + izin).")
print("=" * 60 + "\n")

while True:
    display_path = current_dir
    user_input = input(f"\n📁 [{display_path}] Anda: ").strip()

    if user_input.lower() in ['exit', 'quit', 'keluar', 'q']:
        print("👋 Sampai jumpa!")
        break

    if not user_input:
        continue

    result = call_ai(user_input, current_dir)
    reply = result["reply"]
    suggested_command = result.get("command", "")
    write_file = result.get("write_file") or {"path": "", "content": ""}
    wf_path = write_file.get("path", "")
    wf_content = write_file.get("content", "")

    print(f"\n🤖 AI: {reply}")

    # ---- Eksekusi write_file (menulis isi file langsung, tanpa CMD) ----
    if wf_path:
        target_path = wf_path if os.path.isabs(wf_path) else os.path.join(current_dir, wf_path)
        target_path = os.path.abspath(target_path)

        if not is_path_allowed(target_path):
            print(f"⛔ DIBLOKIR OLEH SISTEM: path '{target_path}' di luar jail")
        else:
            print(f"\n📝 AI ingin menulis file: {target_path}")
            print("----- ISI FILE -----")
            print(wf_content)
            print("---------------------")
            confirm = input("✋ Izinkan menulis file ini? (y/n): ").strip().lower()
            if confirm == 'y':
                try:
                    os.makedirs(os.path.dirname(target_path), exist_ok=True)
                    with open(target_path, "w", encoding="utf-8") as f:
                        f.write(wf_content)
                    print(f"✅ File berhasil ditulis: {target_path}")
                except Exception as e:
                    print(f"❌ Gagal menulis file: {e}")
            else:
                print("⛔ Penulisan file dibatalkan oleh pengguna.")

    # ---- Eksekusi command CMD (untuk operasi non-konten) ----
    if suggested_command:
        print(f"\n⚙️ AI menyarankan perintah: {suggested_command}")

        is_safe, reason = sanitize_command(suggested_command)
        if not is_safe:
            print(f"⛔ DIBLOKIR OLEH SISTEM: {reason}")
            continue

        print("-" * 50)
        confirm = input("✋ Izinkan eksekusi perintah ini? (y/n): ").strip().lower()

        if confirm != 'y':
            print("⛔ Perintah dibatalkan oleh pengguna.")
            continue

        print(f"⚡ Menjalankan: {suggested_command} (di {current_dir})...")
        output = execute_cmd(suggested_command, current_dir)
        print(f"\n📤 Output:\n{output}")

        if suggested_command.strip().lower().startswith("cd "):
            target = suggested_command[3:].strip()
            new_dir = os.path.join(current_dir, target) if not os.path.isabs(target) else target
            new_dir = os.path.abspath(new_dir)
            if os.path.isdir(new_dir) and is_path_allowed(new_dir):
                current_dir = new_dir
                print(f"📂 Berpindah ke: {current_dir}")

# ===================================================================
# AKHIR
# ===================================================================