#!/bin/zsh

# ══════════════════════════════════════════════════
# MULAI LEAD GEN CONTROL PANEL
# ══════════════════════════════════════════════════

# 1. Pindah ke direktori proyek
cd "$(dirname "$0")"

# 2. Set PATH agar Node.js terbaca (Mac Standard)
export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin

# 3. Matikan server lama jika ada
echo "🔄 Mematikan server lama (jika ada)..."
pkill -f "node server.js" 2>/dev/null || true
sleep 1

echo "🚀 Menyalakan Backend WhatsApp (Baileys)..."

# 4. Jalankan server di background
# Output akan disimpan ke backend.log
/usr/local/bin/node server.js > backend.log 2>&1 &

# Simpan PID agar bisa dimatikan jika perlu (opsional)
SERVER_PID=$!

echo "✅ Server berjalan (PID: $SERVER_PID)"
echo "⏳ Menunggu server siap..."
sleep 3

echo "🌐 Membuka Dashboard di Browser via http://localhost:3001..."
# Buka via localhost agar isLocal=true dan semua fitur lokal aktif
open "http://localhost:3001/index.html"

echo "------------------------------------------------"
echo "Aplikasi sudah berjalan di: http://localhost:3001"
echo "Settings: http://localhost:3001/settings.html"
echo "Jangan tutup jendela terminal ini jika ingin server tetap nyala."
echo "Tekan Ctrl+C untuk mematikan server."
echo "------------------------------------------------"

# Biarkan terminal terbuka agar user bisa melihat jika ada error
wait $SERVER_PID
