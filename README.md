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

**Entegrasyonlar** sayfasından:

1. **Meta Access Token** — [Graph API Explorer](https://developers.facebook.com/tools/explorer/) (`ads_read`, `ads_management`)
2. **Reklam Hesabı ID** — `act_123456789`

Yerelde veriler `.data/meta-connection.txt` dosyasına kaydedilir.

## Vercel Deployment

1. Projeyi Vercel'e bağlayın.
2. **Environment Variables** ekleyin:
   - `APP_PASSWORD`
   - `SESSION_SECRET`
   - `META_API_VERSION` (opsiyonel)
3. **Storage → Blob** oluşturun ve projeye bağlayın (`BLOB_READ_WRITE_TOKEN` otomatik eklenir).
4. Redeploy yapın.

Vercel'de dosya sistemi salt okunur olduğu için Blob Store zorunludur.

## Environment Variables

| Değişken | Açıklama |
|---|---|
| `APP_PASSWORD` | Panel giriş parolası |
| `SESSION_SECRET` | Oturum imzalama ve token şifreleme |
| `META_API_VERSION` | Opsiyonel, varsayılan `v23.0` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (canlı ortamda zorunlu) |
