You are an expert AI software architect, full-stack Python developer, and ML engineering specialist. Build a complete, mobile-responsive web application (PWA) for a "Medication Safety Companion" using ONLY the specifications below. Follow every constraint strictly. Output complete, runnable code for every file. Do not use placeholders or pseudocode.

## 🎯 APP OVERVIEW
Purpose: Help users securely create accounts, safely understand medication interactions, track intake, and receive timely reminders—without replacing a pharmacist.
Target Users: Adults managing prescriptions, caregivers, non-native speakers, seniors.
Core Value: Free secure login, plain-language explanations, verified interaction checks, intake logging, local-first reminders, strict medical safety boundaries, per-user data isolation.

## 📱 CORE USER FLOW
1. User signs up / logs in via Firebase (Email + Password, optional Google).
2. Authenticated users access a personalized dashboard: add medications, set reminders, view history, ask questions.
3. User adds meds via text OR uploads photo of bottle/label.
4. App extracts drug names using Gemini Vision API, queries RAG pipeline for interactions & plain-language explanations.
5. User sets reminders (dose, frequency, time). App stores schedule per user.
6. User logs intake (taken/skipped/delayed) with one tap. History visualized as calendar/list.
7. App sends browser notifications + in-app alerts when doses are due. Tracks adherence patterns per user.
8. All data is strictly isolated by `user_id`. Logout clears session state. Clear privacy controls.

## 🏗️ TECHNICAL ARCHITECTURE (100% FREE STACK)
- Authentication: Firebase Auth (Email/Password + Google) via Firebase Web SDK v9+ injected through `st.components.v1.html`. Free Spark plan.
- LLM & Vision: `google-generativeai` SDK. Use `gemini-1.5-flash` for text reasoning AND image understanding. Free tier (15 RPM, 1M tokens/day). Handle images via base64 encoding in Streamlit + `model.generate_content([text_prompt, Image(...)])`.
- Embeddings: `sentence-transformers` (`all-MiniLM-L6-v2`, local)
- Vector DB: `chromadb` (persistent local storage, namespaced by user_id in metadata)
- Framework: `langchain`, `langgraph` (explicit state machines)
- Memory: `sqlite3` with strict `user_id` foreign keys for `medications`, `reminders`, `intake_logs`, `chat_history`
- Scheduler/Reminders: `apscheduler` (background thread) + browser Notification API via JS injection
- UI: `streamlit` + `streamlit-pwa` (mobile-responsive, installable on phones)
- Guardrails: `pydantic` (strict JSON schema), regex input sanitization, LLM self-verification, mandatory disclaimer injection
- Deployment: `docker` + `docker-compose` → deployable to Hugging Face Spaces or Streamlit Cloud (both free)

## 📐 RUBRIC ALIGNMENT & DEPTH REQUIREMENTS
Implement DEPTH in these areas (do not implement everything superficially):
1. WORKING AI BASE + AUTH: Secure Firebase login → session state management → gated app routes. Unauthenticated users see only login/signup.
2. RAG/VECTORSTORE: Hybrid retrieval (BM25 via `rank_bm25` + dense embeddings). Chunk FDA labels & plain-language guides by `drug_class`, `interaction_severity`, `population`. Evaluate with `Hit@3` logging.
3. GUARDRAILS & INJECTION DEFENSE: Regex filtering, Pydantic output validation, LLM self-check, mandatory medical disclaimer on EVERY response. Log all guardrail triggers.
4. LANGGRAPH / MULTI-AGENT: 3-agent state machine: `InputParser` → `InteractionChecker` → `ResponseFormatter`. Conditional routing, retry on low confidence, explicit state tracking.
5. MEMORY & TRACKING: SQLite schema with `user_id` isolation. Track adherence %, missed doses, optimal timing patterns. Implement recursive summarization for long chat sessions + "clear my data" privacy controls.
6. MULTIMODAL (GEMINI VISION): Streamlit image upload → base64/PIL conversion → Gemini Vision API → extract drug name/dosage text → RAG query. Implement rate-limit backoff + graceful fallback to manual entry on API limits.
7. DEPLOYMENT & REMINDERS: Dockerized app, `docker-compose.yml`, health check endpoint, PWA manifest, local-first browser notifications via JS injection + `apscheduler` background checker. Provide exact, platform-specific deploy steps.

## 📁 REQUIRED FILE STRUCTURE
medication_safety_companion/
├── app.py # Streamlit UI + PWA config + auth routing + tracking dashboard
├── auth.py # Firebase JS SDK integration, token verification, session state handling
├── agents.py # LangGraph state machine + 3 agents
├── rag_pipeline.py # Chunking, embedding, Chroma, hybrid retrieval
├── guardrails.py # Input sanitization, Pydantic schema, disclaimer, self-check
├── memory.py # SQLite schema, CRUD with user_id isolation, intake logs, reminders, summarization
├── scheduler.py # apscheduler background thread + per-user alert triggering
├── multimodal.py # Gemini Vision integration + image preprocessing + rate-limit handling
├── eval.py # Evaluation suite + metrics export
├── requirements.txt # Pinned, free-only dependencies
├── Dockerfile
├── docker-compose.yml
├── .env.example # Template for Firebase + Gemini secrets
├── .gitignore
├── pwa_manifest.json
└── README.md


## 🔒 SAFETY & GUARDRAILS (NON-NEGOTIABLE)
- NEVER output personalized medical advice, dosages, or diagnosis.
- EVERY response MUST end with: "⚠️ This is for educational purposes only. Always consult a licensed pharmacist or physician before starting, stopping, or changing medications."
- Implement `Pydantic` schema for all LLM outputs. Reject malformed responses.
- Sanitize inputs: strip `<script>`, `ignore previous`, `system:`, etc.
- Add LLM self-check: "Does this response contain factual drug information supported by retrieved context? Y/N"
- Reminders must NOT replace clinical guidance. Include: "Reminders are tools, not medical orders. Adjust with your provider."
- Log all high-severity flags, guardrail triggers, and fallback events to `logs/app.log`.
- Firebase config must NEVER be committed. Use `.env` + inject securely. Verify tokens server-side where possible.

## 🧪 EVALUATION & TESTING
- Create `eval.py` that runs 10 test cases (5 safe, 5 edge-case/injection) + 2 auth flow tests.
- Log: `grounding_score`, `interaction_detection_precision`, `guardrail_pass_rate`, `reminder_trigger_accuracy`, `auth_isolation_verified`, `latency_ms`.
- Export to `metrics.json` automatically on run.
- Include instructions to reproduce evaluation locally.

## 🚀 DEPLOYMENT GUIDANCE (REQUIRED)
Provide exact, step-by-step instructions to deploy this app to EITHER Hugging Face Spaces OR Streamlit Community Cloud (whichever is simpler for the generated stack). Include:
- How to configure environment variables/secrets on the platform
- How to set up the Docker/runtime correctly
- How to handle Firebase CORS/redirect URIs for the deployed URL
- How to verify the app is live, auth works, and reminders trigger

## ⚠️ STRICT CONSTRAINTS
- ZERO paid APIs, ZERO trials, ZERO credit-card-required services. Firebase Auth Spark plan + Gemini free tier are explicitly free for this scale.
- All external data must be from public/free sources (OpenFDA, public drug labels, open medical guidelines).
- Use type hints, docstrings, and explicit error handling throughout.
- Code must be modular, runnable with `streamlit run app.py`.
- If a feature exceeds scope, implement a clean fallback and document it.
- Do not skip guardrails. Medical safety and data isolation are top priorities.
- `.env` must never be committed. Provide `.env.example` with clear instructions.
- All user data MUST be scoped by `user_id` in SQLite and Chroma metadata.
- Use Gemini Vision exclusively for image processing. Do NOT include pytesseract or local OCR.

## 📤 OUTPUT REQUIREMENTS
1. Output COMPLETE code for EVERY file in the structure above.
2. Include exact `requirements.txt` with pinned versions.
3. Provide step-by-step setup & run instructions (local Firebase project setup + Docker + deployment).
4. Include rubric mapping table showing exactly how each requirement is met.
5. Explain fallback strategies for Gemini rate limits, vision API failures, low-confidence LLM outputs, missed browser notifications, and auth token expiration.
6. Show exact SQLite schema with `user_id` foreign keys and indexes.
