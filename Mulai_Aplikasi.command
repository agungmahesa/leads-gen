#!/bin/zsh

# ══════════════════════════════════════════════════
# MULAI LEAD GEN CONTROL PANEL
# ══════════════════════════════════════════════════

# 1. Pindah ke direktori proyek
cd "$(dirname "$0")"

# 2. Set PATH agar Node.js terbaca (Mac Standard)
export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin

echo "🚀 Menyalakan Backend WhatsApp (Baileys)..."

# 3. Jalankan server di background
# Output akan disimpan ke backend.log
node server.js > backend.log 2>&1 &

# Simpan PID agar bisa dimatikan jika perlu (opsional)
SERVER_PID=$!

echo "✅ Server berjalan (PID: $SERVER_PID)"
echo "🌐 Membuka Dashboard di Browser..."

# 4. Buka file index.html di browser default
# Kita kasih jeda sedikit agar server sempat inisialisasi
sleep 2
open index.html

echo "------------------------------------------------"
echo "Aplikasi sudah berjalan!"
echo "Jangan tutup jendela terminal ini jika ingin server tetap nyala."
echo "Tekan Ctrl+C untuk mematikan server."
echo "------------------------------------------------"

# Biarkan terminal terbuka agar user bisa melihat jika ada error
wait $SERVER_PID
