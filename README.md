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

1. **Meta Access Token** — [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. **Reklam Hesabı ID** — `act_123456789`

## Depolama

| Ortam | Nerede |
|---|---|
| Vercel + Neon | `meta_connections` tablosu (Postgres) |
| Yerel (Neon yok) | `.data/meta-connection.txt` |

Token şifreli saklanır.

## Vercel + Neon

1. Vercel → **Storage** → **Neon** → **Create** → projeye **Connect**
2. `POSTGRES_URL` otomatik eklenir
3. `APP_PASSWORD` ve `SESSION_SECRET` tanımlı olsun
4. **Redeploy**

Tablo ilk bağlantıda otomatik oluşturulur.

## Environment Variables

| Değişken | Açıklama |
|---|---|
| `APP_PASSWORD` | Panel giriş parolası |
| `SESSION_SECRET` | Oturum ve token şifreleme |
| `META_API_VERSION` | Opsiyonel, varsayılan `v23.0` |
| `POSTGRES_URL` | Neon Postgres (Vercel'de otomatik) |
