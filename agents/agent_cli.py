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

    # ===== PROMPT GENERIK: TIDAK ADA CONTOH SPESIFIK PERINTAH =====
    system_prompt = f"""
Anda adalah asisten AI yang membantu pengguna di Windows.
Pengguna saat ini berada di folder: {root_dir}

Tugas Anda:
- Jawab pertanyaan dalam bahasa Indonesia dengan jelas.
- Jika pengguna meminta tindakan (membuat/menghapus file, folder, menjalankan program, dll), sarankan perintah CMD yang sesuai.
- Outputkan jawaban dalam format JSON:
{{
  "reply": "Penjelasan untuk pengguna (Bahasa Indonesia)",
  "command": "Perintah CMD yang disarankan (kosongkan jika tidak ada)"
}}
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

        full_content = full_content.strip().replace("```json", "").replace("```", "").strip()

        try:
            ai_json = json.loads(full_content)
            reply = ai_json.get("reply", full_content)
            command = ai_json.get("command", "")
            return {"reply": reply, "command": command}
        except json.JSONDecodeError:
            reply = full_content
            command = ""
            match = re.search(r'(?:command|cmd)\s*[:=]\s*["\']?(.+?)["\']?$', full_content, re.IGNORECASE | re.MULTILINE)
            if match:
                command = match.group(1).strip()
            return {"reply": reply, "command": command}

    except requests.exceptions.RequestException as e:
        return {"reply": f"❌ Gagal koneksi ke API: {str(e)}", "command": ""}
    except Exception as e:
        return {"reply": f"❌ Error tak terduga: {str(e)}", "command": ""}

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
    suggested_command = result["command"]

    print(f"\n🤖 AI: {reply}")

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