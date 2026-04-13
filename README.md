# LeadGen Pro — Control Panel

A multi-page WhatsApp sales automation dashboard.

## Local Development

```bash
# Install dependencies
npm install

# Start backend (WhatsApp + API)
node server.js

# Open frontend in browser
open http://localhost:3001
```

## Pages

| Page | File | Purpose |
|---|---|---|
| Overview | `index.html` | Dashboard summary & live feed |
| Data Pipeline | `pipeline.html` | Google Maps scraping & Airtable sync |
| Campaigns | `campaigns.html` | WhatsApp outreach with city filter |
| Chat Live | `chats.html` | Inbox monitoring & manual override |
| Settings | `settings.html` | All API keys & AI config |

## Deployment

### Frontend → Vercel
1. Push repository to GitHub
2. Import project on [vercel.com](https://vercel.com)
3. Vercel auto-detects `vercel.json` — no build required
4. Set `YOUR_BACKEND_URL` in `vercel.json` to your backend server address

### Backend → Railway (Free Tier)
1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Set environment variables (copy from `.env.example`)
3. After deploy, copy the Railway URL to `vercel.json` and `backendUrl` in `app.js`

## Environment Variables (.env)
```
SECRET_KEY=your_jwt_secret
USERNAME=admin
PASSWORD=your_password
AIRTABLE_KEY=pat.xxx
AIRTABLE_BASE=appXXX
AIRTABLE_TABLE=Leads
GEMINI_KEY=AIzaSy...
```
