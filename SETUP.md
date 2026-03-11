# Yandex Mail + Claude AI Kurulum Rehberi

## Sorun
Yandex mailleri Claude AI ile okunamıyordu. İşte çözüm:

## Gereksinimler

### 1. Anthropic API Key (Claude AI için)

1. [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) adresine git
2. Yeni bir API key oluştur
3. `.env.local` dosyasına ekle:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

### 2. Vercel Environment Variables (Production için)

Vercel'de deploy ettiysen:
1. Vercel Dashboard → Project Settings → Environment Variables
2. `ANTHROPIC_API_KEY` ekle
3. Deploy'i yeniden yap

### 3. Yandex App Password

1. [https://id.yandex.com/security/app-passwords](https://id.yandex.com/security/app-passwords) adresine git
2. Yeni uygulama şifresi oluştur
3. 16 karakterli şifreyi uygulamada gir

## Local Development

### Seçenek 1: API Server ile (Önerilen)

```bash
# API sunucusunu başlat
cd api
npm install
npm start

# Yeni terminal'de React uygulamasını başlat
cd ..
npm start
```

API sunucusu `http://localhost:3001` adresinde çalışacak.

### Seçenek 2: Vercel CLI ile

```bash
npm install -g vercel
vercel dev
```

## Production (Vercel)

Vercel'de deploy ettiğinizde serverless functions otomatik çalışır. Sadece environment variable'ları ayarlayın.

## Dosya Yapısı

```
takvim-uygulamasi/
├── .env.local              # ANTHROPIC_API_KEY buraya
├── api/
│   ├── yandex-mail.js      # Yandex IMAP bağlantısı
│   ├── parse-event.js      # Claude AI ile event çıkarma
│   └── server.js           # Local development server
├── src/
│   └── outlook-calendar.jsx
└── SETUP.md                # Bu dosya
```

## Troubleshooting

### "API key missing" hatası
- `.env.local` dosyasında `ANTHROPIC_API_KEY` ayarlı mı?
- Vercel'de environment variable eklediniz mi?

### "IMAP bağlantı hatası"
- Yandex App Password doğru mu? (16 karakter)
- İnternet bağlantınızı kontrol edin

### Claude AI event bulamıyor
- Mail içeriğinde etkinlik bilgisi olmayabilir
- Model daha fazla token gerektirebilir

## Model Güncellemesi

Eski model adı (`claude-haiku-4-5-20251001`) geçersizydi. 
Yeni model: `claude-3-5-haiku-20241022`
