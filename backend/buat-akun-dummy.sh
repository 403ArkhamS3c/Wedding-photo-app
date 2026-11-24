#!/usr/bin/env bash
# ============================================================
# Membuat akun dummy untuk uji — memakai Supabase Auth (admin API).
# Sesuai dokumentasi v1.1: pemilik/fotografer dibuat sendiri,
# admin dibuat manual lewat cara ini juga.
#
# Pemakaian:
#   ./buat-akun-dummy.sh                          # default: pemilik_acara
#   ./buat-akun-dummy.sh "fotografer@uji.com" "Sandi1234!" "fotografer"
#   ./buat-akun-dummy.sh "admin@uji.com" "Sandi1234!" "admin"
#
# Prasyarat: isi backend/.env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
# dan tabel profiles sudah dibuat (skema bagian 2.5 dokumentasi skripsi).
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a

EMAIL="${1:-dummy.pemilik@example.com}"
PASS="${2:-Testing1234!}"
ROLE="${3:-pemilik_acara}"

case "$ROLE" in
  admin|fotografer|pemilik_acara) ;;
  *) echo "Peran tidak dikenal: $ROLE (pakai admin | fotografer | pemilik_acara)"; exit 1 ;;
esac

echo "==> Membuat user: $EMAIL (peran: $ROLE)"
RESP=$(curl -sS -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"email_confirm\":true}" || true)

if [ -z "$RESP" ]; then
  echo "GAGAL: server Supabase tidak terhubung sama sekali."
  echo "       Cek DNS/URL project di backend/.env (project yang terhapus"
  echo "       menyebabkan error 'Could not resolve host')."
  exit 1
fi

ID=$(printf '%s' "$RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id') or '')" 2>/dev/null || true)

if [ -z "$ID" ]; then
  echo "GAGAL membuat user. Respons server:"
  printf '%s\n' "$RESP" | head -c 500
  echo
  echo "Kemungkinan: URL/key salah, project di-pause, atau tabel belum ada."
  exit 1
fi
echo "    User Auth OK: $ID"

echo "==> Memastikan baris di tabel profiles"
PROF=$(curl -sS -X POST "$SUPABASE_URL/rest/v1/profiles" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=minimal" \
  -d "{\"id\":\"$ID\",\"role\":\"$ROLE\",\"full_name\":\"Akun Dummy Uji\"}" \
  -o /tmp/_profil_resp.txt -w "%{http_code}")
if [ "$PROF" != "201" ] && [ "$PROF" != "200" ]; then
  echo "    GAGAL menulis profiles (HTTP $PROF): $(head -c 300 /tmp/_profil_resp.txt)"
  exit 1
fi
echo "    profiles OK (role=$ROLE)"

echo "==> Verifikasi login"
LOGIN=$(curl -sS -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
OK=$(printf '%s' "$LOGIN" | python3 -c "import sys,json;d=json.load(sys.stdin);print('ya' if d.get('access_token') else 'tidak')" 2>/dev/null || echo "tidak")
echo "    Login: $OK"

cat <<EOF

============================================================
 AKUN DUMMY SIAP DIUJI
 -------------------------------------------------------------
 Email    : $EMAIL
 Password : $PASS
 Peran    : $ROLE
 -------------------------------------------------------------
 Catatan:
  - Login di halaman utama, pilih peran sesuai role di atas
    (tab hanya menampilkan pemilik/fotografer; role admin
    tetap terbaca dari tabel profiles).
  - Untuk role pemilik: langsung bisa "Buat Acara".
  - Untuk role fotografer: butuh kode referral dari acara
    yang dibuat pemilik.
  - Hapus akun ini dari Supabase Dashboard -> Authentication
    -> Users setelah selesai uji.
============================================================
EOF
