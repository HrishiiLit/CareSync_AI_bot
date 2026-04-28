# 🚀 Clarus App Startup Guide

This document contains all the commands you need to start and stop the different parts of the application cleanly. 

Since all three services need to run at the same time, you should open **three separate terminal windows/tabs** and run one command in each.

---

## 1. Start the Backend (API Server)

The backend handles the core logic, workflow engine, Supabase connections, and integrations with ElevenLabs.

**Command to Start:**
```bash
cd /Users/mallikarjunparoji/Documents/claur/Clarus/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
*Wait for it to say `Application startup complete.`*

**Command to Stop:**
Press `Ctrl + C` in the terminal where it's running.

---

## 2. Start the Frontend (Next.js Application)

This runs the web interface where you can trigger workflows and view patients.

**Command to Start:**
```bash
cd /Users/mallikarjunparoji/Documents/claur/Clarus/frontend
npm run dev
```

**Command to Stop:**
Press `Ctrl + C` in the terminal where it's running.

---

## 3. Start ngrok (Webhook Tunnel)

ngrok exposes your local port 8000 to the public internet so ElevenLabs can ping your `/api/elevenlabs/webhook` when a call finishes.

**Command to Start:**
```bash
cd /Users/mallikarjunparoji/Documents/claur/Clarus/backend
ngrok http 8000
```

**Command to Stop:**
Press `Ctrl + C` in the ngrok terminal.

---

### ⚠️ IMPORTANT: ngrok URL Changes
Because you're on a Free ngrok account, your public URL (e.g., `https://lazyish-unrailroaded-zain.ngrok-free.dev`) **changes every time you restart ngrok**.

**Every single time you restart ngrok**, you must do these two things:
1. Update `APP_BASE_URL` in your `backend/.env` file to the new URL.
2. Go to the **ElevenLabs Dashboard -> Agent -> Post-call Webhook** and paste the new URL (add `/api/elevenlabs/webhook` at the end).
