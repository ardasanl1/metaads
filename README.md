# Meta Ads Panel

Next.js tabanlı Meta reklam yönetim paneli.

## Kurulum

```bash
npm install
cp .env.example .env.local
```

`.env.local` dosyasında `APP_PASSWORD` ve `SESSION_SECRET` tanımlayın:

```bash
npm run dev
```

## Meta Bağlantısı

OAuth veya Turso gerekmez. Panelde **Entegrasyonlar** sayfasından:

1. **Meta Access Token** — [Graph API Explorer](https://developers.facebook.com/tools/explorer/) (`ads_read`, `ads_management` izinleriyle)
2. **Reklam Hesabı ID** — `act_123456789` formatında

Bağlantı bilgileri `.data/meta-connection.txt` dosyasına şifreli olarak kaydedilir (git'e eklenmez).

## Environment Variables

| Değişken | Açıklama |
|---|---|
| `APP_PASSWORD` | Panel giriş parolası |
| `SESSION_SECRET` | Oturum imzalama ve token şifreleme |
| `META_API_VERSION` | Opsiyonel, varsayılan `v23.0` |

## Vercel Notu

Dosya tabanlı depolama Vercel'de kalıcı değildir. Canlı ortamda ileride veritabanı eklenebilir; şimdilik yerel (`npm run dev`) kullanım için uygundur.
