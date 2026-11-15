# AstroTeam Lunar Frontend

This Vite app is the only frontend to run and deploy. It reads the site catalog
from FastAPI and requests one 30-day timeline when a site is opened. Timeline
samples are kept in memory for the time slider.

## Local development

1. Start FastAPI from `backend/`:

   ```powershell
   .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
   ```

2. From this directory, install dependencies if needed and start Vite:

   ```powershell
   npm install
   npm run dev
   ```

Vite uses `http://localhost:8000` as its development API default. To override
it, copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL`.

## Vercel

Set the project root directory to `frontend` and define `VITE_API_BASE_URL` as
the public base URL of the deployed FastAPI service. The build command is
`npm run build`; the output directory is `dist`.

The current API does not provide slope, battery, radiation, temperature,
power-generation, or continuous-solar-window predictions. The UI labels those
unavailable indicators as `N/D` rather than presenting simulated values as
measurements.
