# Cookie Authentication in Helpdesk RPA

## Apa yang Sebenarnya Disimpan?

Ketika Anda login ke helpdesk host yang dikonfigurasi di `HELPDESK_URL`, server mengirim **cookies** yang berisi:

1. **Session ID** - Identifier unik untuk sesi login Anda
2. **Authentication Token** - Bisa berupa JWT atau token lainnya
3. **Other Session Data** - Preferensi user, csrf token, dll

## Apa BUKAN Session Storage?

Banyak yang bingung antara:

| Storage | Lokasi | Persistensi | Digunakan untuk Auth? |
|---------|--------|-------------|----------------------|
| **Cookies** | Dikirim ke server setiap request | Sesuai expiry date | ✅ **YA** - Ini yang dipakai |
| **Local Storage** | Hanya di browser, TIDAK dikirim ke server | Permanent sampai dihapus | ❌ TIDAK - Tidak pernah dikirim ke server |
| **Session Storage** | Hanya di browser, hilang saat tab ditutup | Hanya satu session | ❌ TIDAK - Hilang saat tab close |

## Jadi...

**Cookies adalah satu-satunya cara browser mengirim authentication data ke server!**

Local storage dan session storage HANYA untuk data client-side. Server tidak bisa baca itu.

## Contoh Response dari Server

Ketika login berhasil, server mengirim response header:

```http
HTTP/1.1 200 OK
Set-Cookie: PHPSESSID=abc123def456; Path=/; Secure; HttpOnly
Set-Cookie: user_token=jwt_token_here; Path=/; Secure; HttpOnly
```

Cookie ini kemudian:
- Disimpan oleh browser (untuk domain helpdesk yang dikonfigurasi)
- Dikirim otomatis ke server di setiap request berikutnya
- Server cek cookie ini untuk verifikasi "Oh ini user X yang sudah login"

## Apa yang Disimpan Playwright?

Dengan `storageStatePath`, Playwright menyimpan:

```json
{
  "cookies": [
    {
      "name": "PHPSESSID",
      "value": "abc123def456",
      "domain": "your-helpdesk-host",
      "path": "/",
      "expires": 1234567890,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "origins": [
    {
      "origin": "https://your-helpdesk-host",
      "localStorage": [...]
    }
  ]
}
```

**Bagian penting untuk auth**: Array `cookies`! Bukan localStorage.

## Cara Cek Cookies yang Disimpan

### 1. Lihat File JSON

```bash
cat automation-logs/session/auth-state.json
```

### 2. Enable Debug Mode

```bash
DEBUG=true npm run dev
```

Lalu jalankan automation, akan muncul log:

```
📊 Current cookies count: 15
🔑 Authentication cookies found: PHPSESSID, ci_session, remember_token
✅ Cookies and storage saved to: automation-logs/session/auth-state.json
📊 Saved 15 cookies
```

### 3. Cek di Browser

Buka DevTools → Application → Cookies → domain helpdesk yang dikonfigurasi

Bandigkan dengan isi file `auth-state.json`

## Kapan Cookies Expire?

Cookies bisa expire karena:

1. **Session Cookie** - Expire saat browser ditutup (tidak ada expiry date)
2. **Persistent Cookie** - Expire sesuai tanggal yang ditentukan server
3. **Manual Logout** - Server mengirim instruksi untuk delete cookie
4. **Server Invalidate** - Session di server dihapus (cookie jadi useless meskipun masih ada)

## Troubleshooting

### "Sudah login tapi tetap diminta login lagi"

**Kemungkinan 1**: Cookie expired
```bash
# Hapus file cookies dan login ulang
rm automation-logs/session/auth-state.json
```

**Kemungkinan 2**: Server invalidate session
- Coba login manual di browser normal
- Kalau browser normal juga diminta login, berarti memang server timeout

**Kemungkinan 3**: Cookies tidak tersimpan dengan benar
- Cek file `auth-state.json` ada isinya atau tidak
- Enable debug mode untuk melihat log cookies

### "Cookies tersimpan tapi tetap tidak bisa akses"

Bisa jadi masalah **cookie attributes**:

- **Domain** - Cookie untuk domain yang berbeda
- **Path** - Cookie hanya untuk path tertentu
- **Secure** - Cookie hanya untuk HTTPS
- **HttpOnly** - Cookie tidak bisa diakses via JavaScript (normal untuk security)

## Security Notes

✅ **Aman**:
- Cookies disimpan di file system lokal
- Tidak dikirim ke server lain
- Hanya untuk domain helpdesk yang dikonfigurasi

⚠️ **Perhatikan**:
- File `auth-state.json` berisi session ID yang valid
- Jangan share file ini ke orang lain
- Jangan commit ke git (sudah di .gitignore)

## Best Practices

1. **Jangan commit** `automation-logs/` ke git
2. **Periodik delete** cookies lama untuk security
3. **Gunakan timeout** yang wajar jangan terlalu lama
4. **Monitor** log untuk memastikan cookies valid

## Summary

```
Anda login → Server kirim cookies → Browser simpan cookies
           ↓
           Cookies dikirim di setiap request
           ↓
           Server cek cookies → "Oh ini user yang valid!"
```

**Playwright storageState hanya meng-backup cookies ini** untuk digunakan di run berikutnya.

Bukan "session storage" browser, tapi "cookies" yang berisi authentication session!
