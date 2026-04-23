# Medication Safety Companion

A complete, mobile-responsive web application for medication safety, built with React and FastAPI. 

## Features
- **UI**: Modern React mobile-first UI with custom CSS matching the design system.
- **RAG & Agents**: LangGraph 3-agent system + lightweight keyword search for interactions.
- **Image Upload**: OCR.space cloud OCR + Qwen AI to extract drug names from bottle photos.
- **AI Chat**: Qwen 3.5-9B via Groq Cloud for drug interaction analysis.
- **Pharmacy Map**: Interactive Leaflet map showing nearest pharmacies within 3km.
- **Safety**: Pydantic structured parsing, regex sanitization, and mandatory disclaimers.
- **Storage**: SQLite with strict `user_id` isolation.
- **Reminders**: APScheduler background thread.

## Tech Stack

| Component | Technology |
| --------- | ---------- |
| LLM | Qwen 3.5-9B via Groq Cloud API (free tier) |
| Image OCR | OCR.space Cloud API (free tier, 25k req/month) |
| Backend | FastAPI + LangGraph |
| Frontend | React + Vite |
| Map | Leaflet + OpenStreetMap + Overpass API |
| Database | SQLite |
| Auth | Firebase Admin SDK |

## Local Setup & Evaluation

1. Clone repository and setup environment:
   ```bash
   cp .env.example .env
   ```

2. Get your free API keys:
   - **Groq**: Sign up at [console.groq.com](https://console.groq.com), generate API key
   - **OCR.space**: Get free key at [ocr.space/ocrapi](https://ocr.space/ocrapi)

3. Add keys to `.env`:
   ```
   GROQ_API_KEY=gsk_your_key_here
   GROQ_MODEL=qwen-3.5-9b
   OCR_SPACE_API_KEY=your_key_here
   ```

4. Install and run backend:
   ```bash
   pip install -r requirements.txt
   python -m uvicorn app:app --reload
   ```

5. Install and run frontend:
   ```bash
   cd frontend
   npm install --legacy-peer-deps
   npm run dev
   ```

6. Open `http://localhost:5173` in your browser.

## Fallback Strategies
1. **Groq Rate Limits**: Free tier has ~30 req/min. If hit, the LangGraph error handler returns a graceful fallback response with disclaimer.
2. **OCR Failures**: If OCR.space returns no text, users can manually type drug name and dosage.
3. **Low-Confidence LLM Outputs**: LangGraph handles errors and returns a generic fallback response with the medical disclaimer.
4. **Auth Token Expiration**: `auth.py` rejects invalid tokens; frontend needs to prompt re-login.
5. **Map Errors**: If geolocation is denied, a clear error message is shown with instructions.
