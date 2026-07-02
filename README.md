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
| `APP_EMAIL` | Panel giriş e-postası (ilk kullanıcı seed için) |
| `APP_PASSWORD` | Panel giriş şifresi (ilk kullanıcı seed için) |
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
| Vercel + Neon | `meta_connections` ve `panel_users` tabloları (aynı Postgres) |
| Yerel (Neon yok) | `.data/meta-connections.json`, `.data/panel-users.json` |

Access token'lar `SESSION_SECRET` ile şifreli saklanır. Panel şifreleri veritabanında hash'lenmiş tutulur; `APP_EMAIL` / `APP_PASSWORD` yalnızca ilk kullanıcıyı otomatik oluşturmak için kullanılır.

## Vercel + Neon

1. Vercel → **Storage** → **Neon** → **Create** → projeye **Connect**
2. `POSTGRES_URL` otomatik eklenir
3. `APP_EMAIL`, `APP_PASSWORD` ve `SESSION_SECRET` tanımlı olsun
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
| `APP_EMAIL` | Evet | İlk panel kullanıcısı seed (ör. test@test.com) |
| `APP_PASSWORD` | Evet | İlk panel kullanıcısı seed şifresi |
| `SESSION_SECRET` | Evet | Oturum ve token şifreleme |
| `META_API_VERSION` | Hayır | Varsayılan `v23.0` |
| `GOOGLE_MAPS_API_KEY` | Konum autocomplete için | Google Places API (New) server-side key |
| `POSTGRES_URL` / `DATABASE_URL` | Vercel'de | Neon Postgres bağlantısı |

## Google Places Autocomplete (New)

Konum alanında ülke/şehir autocomplete için Places API (New) kullanılır. API key **frontend’e gönderilmez**; yalnızca server-side proxy route üzerinden kullanılır.

### Kurulum

- Google Cloud Console → Places API (New) etkinleştirin
- API Key oluşturun
- Key’i **Vercel Environment Variables** içine `GOOGLE_MAPS_API_KEY` olarak ekleyin (Production/Preview ihtiyacınıza göre)
- Önerilen kısıtlar:
  - HTTP referrer yerine server-side olduğu için **IP restriction** / **project restriction**
  - Sadece Places API (New) endpointlerine izin verin

### Key yoksa davranış

`GOOGLE_MAPS_API_KEY` tanımlı değilse uygulama crash olmaz; konum autocomplete alanında “Google Places yapılandırması eksik” hatası gösterilir.
