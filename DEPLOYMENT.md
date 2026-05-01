# Deployment Guide

This project can be deployed in two common ways:

1. Full stack with Docker (frontend + backend)
2. Frontend on Vercel + backend on another host (Render, Railway, Fly.io, VM, etc.)

## Option 1: Docker Deployment

### 1. Configure environment variables

Create or export these before deployment:

Backend variables:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_NUMBER
- ELEVENLABS_API_KEY
- ELEVENLABS_AGENT_ID
- ELEVENLABS_PHONE_NUMBER_ID
- ELEVENLABS_WEBHOOK_SECRET
- APP_BASE_URL

Frontend variables:
- NEXT_PUBLIC_API_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

### 2. Build images

```bash
docker compose build
```

### 3. Run stack

```bash
docker compose up -d
```

### 4. Verify

- Backend health: GET /health
- Frontend: open port 3000

### 5. Useful commands

```bash
docker compose ps
docker compose logs -f
docker compose down
```

## Option 2: Frontend on Vercel

Use this when backend is hosted separately.

### 1. Deploy backend first

Deploy backend to a public HTTPS URL, for example:
- https://api.yourdomain.com

Ensure CORS in backend allows your Vercel domain(s).

### 2. Import frontend project into Vercel

- In Vercel, click Add New Project
- Import this repository
- Set Root Directory to frontend
- Framework preset: Next.js (auto-detected)

### 3. Configure build settings

- Install command: npm ci
- Build command: npm run build
- Output: default Next.js

### 4. Add Vercel environment variables

In Project Settings -> Environment Variables, add:

- NEXT_PUBLIC_API_URL=https://api.yourdomain.com
- NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
- NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

Optional for SSR-internal routing (not required on Vercel):
- INTERNAL_API_URL=https://api.yourdomain.com

### 4b. Update Supabase auth URLs

In your Supabase project settings, set the Auth URL configuration to match production:

- Site URL: `https://your-vercel-domain.vercel.app`
- Additional Redirect URLs:
	- `https://your-vercel-domain.vercel.app/*`
	- `http://localhost:3000/*` for local development

If you use a custom domain later, add it here too.

### 5. Deploy

- Trigger deployment from Vercel dashboard
- After deploy, test login, doctor listing, bookings, and workflow actions

### 6. Add custom domain (optional)

- Add domain in Vercel project
- Update backend CORS allowlist with that domain

## Recommended release checks

Before production release:

1. Confirm backend /health responds with status ok.
2. Confirm frontend loads without build/runtime env errors.
3. Verify auth flows (doctor/patient), booking, call logs, and notifications.
4. Verify webhook callback URL uses production APP_BASE_URL.
