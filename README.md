# Meta Ads Panel

Next.js tabanlı Meta reklam yönetim paneli. Çoklu firma desteği ile manuel access token bağlantısı kullanır.

## Kurulum

```bash
npm install
cp .env.example .env.local
```

`.env.local` dosyasında en az şunları tanımlayın:

| Değişken | Açıklama |
|---|---|
| `APP_PASSWORD` | Panel giriş parolası |
| `SESSION_SECRET` | Oturum ve token şifreleme (AES-256-GCM) |

```bash
npm run dev
```

## Meta Bağlantısı (Manuel Token)

OAuth kullanılmaz. Her firma ayrı bir Meta access token ile bağlanır.

**Entegrasyonlar** (`/settings/integrations`) sayfasından:

1. **Meta Access Token** — [Graph API Explorer](https://developers.facebook.com/tools/explorer/) veya Business Manager üzerinden
2. **Firma Bağla** — Token kaydedilir; aynı token sahibi (`meta_user_id`) için tek kayıt tutulur

Üst bardaki seçicilerden:

- **İşletme / Firma** — Token ile bağlı işletme (Meta kullanıcı ID)
- **Reklam Hesabı** — Firmaya manuel eklenen hesaplardan seçim
- **Reklam Hesabı Ekle** — `act_123456789` formatında Meta ID girerek hesabı firmaya bağlama

Tüm reklam hesapları otomatik çekilmez; yalnızca eklediğiniz ID'ler listelenir.

## Özellikler

- **Dashboard** — Tarih filtresi ile hesap özeti ve son kampanyalar
- **Kampanyalar** — Filtreleme, sıralama, insights metrikleri
- **Yeni Kampanya** — Meta API üzerinden kampanya oluşturma
- **Kampanya Detayı** — Genel bakış, reklam setleri, reklamlar; güncelleme ve insights

## Depolama

| Ortam | Nerede |
|---|---|
| Vercel + Neon | `meta_connections` tablosu (Postgres) |
| Yerel (Neon yok) | `.data/meta-connections.json` |

Access token'lar `SESSION_SECRET` ile şifreli saklanır.

## Vercel + Neon

1. Vercel → **Storage** → **Neon** → **Create** → projeye **Connect**
2. `POSTGRES_URL` otomatik eklenir
3. `APP_PASSWORD` ve `SESSION_SECRET` tanımlı olsun
4. **Redeploy**

Tablo ilk bağlantıda otomatik oluşturulur.

## API Özeti

| Endpoint | Açıklama |
|---|---|
| `POST /api/meta/connect` | Firma token bağla |
| `POST /api/meta/campaigns` | Kampanya oluştur |
| `GET /api/meta/campaigns` | Kampanya listesi (+ insights) |
| `GET /api/meta/campaigns/[id]` | Kampanya detayı (+ insights) |
| `GET /api/meta/adsets` | Reklam setleri (+ insights) |
| `GET /api/meta/ads` | Reklamlar (+ insights) |

Tarih parametreleri: `datePreset`, `since`, `until`

## Environment Variables

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `APP_PASSWORD` | Evet | Panel giriş parolası |
| `SESSION_SECRET` | Evet | Oturum ve token şifreleme |
| `META_API_VERSION` | Hayır | Varsayılan `v23.0` |
| `POSTGRES_URL` / `DATABASE_URL` | Vercel'de | Neon Postgres bağlantısı |
