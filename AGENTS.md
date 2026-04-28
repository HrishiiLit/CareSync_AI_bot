# CareSync AI Agent Notes

## Project Shape
- Treat this as a two-part monorepo: `frontend/` is the Next.js app and `backend/` is the FastAPI service.
- Prefer linking to the existing docs instead of restating them: [README.md](README.md), [frontend/README.md](frontend/README.md), [STARTUP_COMMANDS.md](STARTUP_COMMANDS.md), [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md), and [WORKFLOW_FEATURE_TECHNICAL_SUMMARY.md](WORKFLOW_FEATURE_TECHNICAL_SUMMARY.md).

## Common Commands
- Frontend: `cd frontend && npm run dev`, `npm run build`, `npm run lint`.
- Backend: `cd backend && uvicorn main:app --reload --port 8000` after activating the Python environment.
- Use the existing startup guide for service ordering and environment setup: [STARTUP_COMMANDS.md](STARTUP_COMMANDS.md).

## Editing Conventions
- Keep changes localized to the owning app or service; avoid cross-stack edits unless the behavior truly spans both sides.
- Do not edit generated output such as `frontend/.next/` or environment folders such as `venv/` and `.venv/`.
- Preserve the current stack and patterns: Next.js App Router + React 19 + TypeScript on the frontend, FastAPI + Pydantic v2 on the backend.

## Frontend Notes
- The marketing 3D components in `frontend/components/marketing/` use `three.Timer`; when touching frame-based animation, keep the timer pattern and call `timer.update()` in the render loop.
- Favor the existing Tailwind/shadcn-style component patterns already used in the app.

## Backend Notes
- SQL schema changes belong in `backend/migrations/` and should stay aligned with the existing migration numbering.
- Keep API and service changes consistent with the existing FastAPI service layout under `backend/app/`.