import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Header, Depends, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import base64

from memory import get_connection, init_db
from agents import process_query, process_image_query
from multimodal import extract_drug_info_from_image
from scheduler import start_scheduler
from auth import init_firebase, verify_token

app = FastAPI(title="Medication Safety Companion API")

# Setup CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev only, restrict in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
def startup_event():
    init_db()
    start_scheduler()

# Dummy auth dependency (In prod, verify Firebase token)
def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.replace("Bearer ", "")
    user_id = verify_token(token)
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Ensure user exists in db
    conn = get_connection()
    c = conn.cursor()
    c.execute("INSERT OR IGNORE INTO users (user_id, email) VALUES (?, ?)", (user_id, f"{user_id}@example.com"))
    conn.commit()
    conn.close()
    
    return user_id

class ChatRequest(BaseModel):
    message: str

class MedRequest(BaseModel):
    name: str
    dosage: str
    frequency: str
    time: str
    doses_available: int = 0
    start_date: str = ""
    recurrence: str = "none"

class ProfileRequest(BaseModel):
    name: str = ""
    age: int = 0
    blood_group: str = ""
    allergies: str = ""
    notes: str = ""

@app.post("/api/chat")
def chat_endpoint(req: ChatRequest, user_id: str = Depends(get_current_user)):
    response = process_query(user_id, req.message)
    
    # Log chat history
    conn = get_connection()
    c = conn.cursor()
    c.execute("INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?)", (user_id, "user", req.message))
    c.execute("INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?)", (user_id, "assistant", response))
    conn.commit()
    conn.close()
    
    return {"response": response}

@app.post("/api/chat/image")
async def chat_image_endpoint(
    file: UploadFile = File(...),
    message: str = Form(""),
    user_id: str = Depends(get_current_user)
):
    """Process an image through the vision model for medication identification."""
    contents = await file.read()
    b64 = base64.b64encode(contents).decode('utf-8')
    mime_type = file.content_type or "image/jpeg"
    
    response = process_image_query(user_id, b64, mime_type, message)
    
    # Log chat history
    conn = get_connection()
    c = conn.cursor()
    user_msg = f"[Image uploaded] {message}" if message else "[Image uploaded for identification]"
    c.execute("INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?)", (user_id, "user", user_msg))
    c.execute("INSERT INTO chat_history (user_id, role, content) VALUES (?, ?, ?)", (user_id, "assistant", response))
    conn.commit()
    conn.close()
    
    return {"response": response}

@app.get("/api/medications")
def get_medications(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT id, name, dosage, frequency, time, doses_available, start_date, recurrence FROM medications WHERE user_id = ?", (user_id,))
    rows = c.fetchall()
    conn.close()
    
    meds = [{"id": r[0], "name": r[1], "dosage": r[2], "frequency": r[3], "time": r[4], "doses_available": r[5] or 0, "start_date": r[6] or "", "recurrence": r[7] or "none"} for r in rows]
    return {"medications": meds}

@app.post("/api/medications")
def add_medication(req: MedRequest, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    c.execute("INSERT INTO medications (user_id, name, dosage, frequency, time, doses_available, start_date, recurrence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              (user_id, req.name, req.dosage, req.frequency, req.time, req.doses_available, req.start_date, req.recurrence))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.put("/api/medications/{med_id}")
def update_medication(med_id: int, req: MedRequest, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    c.execute("UPDATE medications SET name = ?, dosage = ?, frequency = ?, time = ?, doses_available = ?, start_date = ?, recurrence = ? WHERE id = ? AND user_id = ?",
              (req.name, req.dosage, req.frequency, req.time, req.doses_available, req.start_date, req.recurrence, med_id, user_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.delete("/api/medications/{med_id}")
def delete_medication(med_id: int, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    c.execute("DELETE FROM medications WHERE id = ? AND user_id = ?", (med_id, user_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/upload_bottle")
async def upload_bottle(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    contents = await file.read()
    b64 = base64.b64encode(contents).decode('utf-8')
    mime_type = file.content_type
    
    info = extract_drug_info_from_image(b64, mime_type)
    return info

# ── Profile Endpoints ──

@app.get("/api/profile")
def get_profile(user_id: str = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT name, age, blood_group, allergies, notes FROM user_profiles WHERE user_id = ?", (user_id,))
    row = c.fetchone()
    conn.close()
    
    if row:
        return {"name": row[0], "age": row[1], "blood_group": row[2], "allergies": row[3], "notes": row[4]}
    else:
        return {"name": "", "age": 0, "blood_group": "", "allergies": "", "notes": ""}

@app.put("/api/profile")
def update_profile(req: ProfileRequest, user_id: str = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        INSERT INTO user_profiles (user_id, name, age, blood_group, allergies, notes, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            name = excluded.name,
            age = excluded.age,
            blood_group = excluded.blood_group,
            allergies = excluded.allergies,
            notes = excluded.notes,
            updated_at = CURRENT_TIMESTAMP
    """, (user_id, req.name, req.age, req.blood_group, req.allergies, req.notes))
    conn.commit()
    conn.close()
    return {"status": "success"}

# Mount static files at the end to not catch API routes
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
