# Dbrutals

Dbrutals ialah aplikasi operasi penghantaran dengan dashboard web, API Node.js,
integrasi bot WhatsApp Baileys, dan aplikasi mudah alih Expo untuk driver.

## Keperluan

- Node.js 22 atau lebih baharu
- npm 10 atau lebih baharu
- PostgreSQL untuk data route sebenar (pilihan untuk membuka UI)

## Pasang dan jalankan

```bash
git clone <URL_REPOSITORI_GITHUB>
cd <NAMA_FOLDER>
npm install
npm run dev
```

Selepas kedua-dua servis hidup:

- Dashboard web: `http://localhost:5173`
- API: `http://localhost:8080/api/healthz`

Vite akan mem-proksi `/api` dan `/bot` ke API tempatan secara automatik. Tetapan
proxy ini tidak digunakan dalam Replit kerana Replit mempunyai routing servisnya
sendiri.

## Environment variables

Cipta fail `.env` atau tetapkan pemboleh ubah ini pada platform hosting:

| Nama | Wajib | Kegunaan |
| --- | --- | --- |
| `DATABASE_URL` | Untuk data sebenar | PostgreSQL connection string |
| `SESSION_SECRET` | Jika `APP_PASSWORD` digunakan | Menandatangani cookie login |
| `APP_PASSWORD` | Tidak | Melindungi dashboard dengan kata laluan |
| `ALLOWED_ORIGIN` | Untuk frontend berasingan | Origin frontend, contohnya `https://app.example.com` |
| `PORT` | Tidak secara lokal | Port API; default `8080` |

Jangan commit fail `.env`, sesi WhatsApp, atau data dalam
`artifacts/api-server/.data/`.

## Arahan npm

```bash
npm run dev              # API + dashboard web
npm run dev:api          # API sahaja
npm run dev:web          # dashboard web sahaja
npm run typecheck        # semak TypeScript seluruh workspace
npm test                 # jalankan semua test workspace
npm run build            # build API + dashboard web
npm run build:all        # build semua artifact, termasuk Expo
```

Untuk aplikasi driver:

```bash
npm run dev --workspace @workspace/driver-app
```

## GitHub Actions

Workflow `.github/workflows/ci.yml` akan menjalankan `npm install`, typecheck,
test API, dan build untuk setiap push serta pull request.

## Nota WhatsApp

Baileys menyimpan sesi dan rekod capture secara lokal dalam
`artifacts/api-server/.data/`. Folder ini sengaja tidak dimasukkan ke Git. Akaun
WhatsApp perlu dipasangkan semula pada mesin atau deployment baharu.