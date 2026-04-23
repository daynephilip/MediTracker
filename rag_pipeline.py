import logging
import os

os.makedirs('logs', exist_ok=True)
logging.basicConfig(filename='logs/app.log', level=logging.INFO)

# Comprehensive drug knowledge base for prototype
mock_guidelines = [
    # ── Aspirin ──
    {"keywords": ["aspirin"], "text": "Aspirin (acetylsalicylic acid) is used to reduce pain, fever, and inflammation. It is also used at low doses as a blood thinner to prevent heart attacks and strokes."},
    {"keywords": ["aspirin", "side effect"], "text": "Common side effects of Aspirin include stomach upset, heartburn, nausea, and gastrointestinal bleeding. Long-term use can increase the risk of stomach ulcers and bleeding."},
    {"keywords": ["aspirin", "dosage"], "text": "Typical adult Aspirin dosage: 325-650mg every 4-6 hours for pain/fever (max 4g/day). Low-dose aspirin for heart protection: 81mg daily."},
    {"keywords": ["aspirin", "ibuprofen"], "text": "INTERACTION: Aspirin + Ibuprofen — Ibuprofen can interfere with the antiplatelet effect of low-dose aspirin. Taking them together also increases the risk of gastrointestinal bleeding. Severity: Moderate."},
    {"keywords": ["aspirin", "warfarin"], "text": "INTERACTION: Aspirin + Warfarin — Both are blood thinners. Combined use significantly increases bleeding risk. Severity: High. Consult your doctor before combining."},
    {"keywords": ["aspirin", "allergy", "warning"], "text": "WARNING: Aspirin should not be used in people with aspirin allergy, active bleeding disorders, or children/teenagers with viral infections (risk of Reye's syndrome)."},

    # ── Ibuprofen ──
    {"keywords": ["ibuprofen"], "text": "Ibuprofen is a nonsteroidal anti-inflammatory drug (NSAID) used to reduce fever, pain, and inflammation from conditions like headaches, toothaches, arthritis, and menstrual cramps."},
    {"keywords": ["ibuprofen", "side effect"], "text": "Common side effects of Ibuprofen include stomach pain, nausea, dizziness, and headache. Serious risks include gastrointestinal bleeding, kidney problems, and increased cardiovascular risk with long-term use."},
    {"keywords": ["ibuprofen", "dosage"], "text": "Typical adult Ibuprofen dosage: 200-400mg every 4-6 hours as needed (max 1200mg/day OTC, up to 3200mg/day prescription). Take with food or milk to reduce stomach upset."},

    # ── Amoxicillin ──
    {"keywords": ["amoxicillin"], "text": "Amoxicillin is a penicillin-type antibiotic used to treat bacterial infections including ear infections, pneumonia, skin infections, urinary tract infections, and H. pylori."},
    {"keywords": ["amoxicillin", "side effect"], "text": "Common side effects of Amoxicillin include diarrhea, nausea, vomiting, rash, and stomach pain. Allergic reactions (rash, hives, swelling) can occur, especially in people with penicillin allergy."},
    {"keywords": ["amoxicillin", "dosage"], "text": "Typical adult Amoxicillin dosage: 250-500mg every 8 hours, or 500-875mg every 12 hours depending on the infection. Complete the full course even if you feel better."},
    {"keywords": ["amoxicillin", "food"], "text": "Amoxicillin can be taken with or without food, but taking it with food may help prevent stomach upset."},

    # ── Lisinopril ──
    {"keywords": ["lisinopril"], "text": "Lisinopril is an ACE inhibitor used to treat high blood pressure (hypertension), heart failure, and to improve survival after a heart attack."},
    {"keywords": ["lisinopril", "side effect"], "text": "Common side effects of Lisinopril include dry cough, dizziness, headache, fatigue, and elevated potassium levels. A rare but serious side effect is angioedema (swelling of face, lips, tongue)."},
    {"keywords": ["lisinopril", "dosage"], "text": "Typical adult Lisinopril dosage: Starting dose 5-10mg once daily, maintenance 20-40mg once daily. Take at the same time each day."},
    {"keywords": ["lisinopril", "potassium"], "text": "INTERACTION: Lisinopril + Potassium supplements/salt substitutes — Can cause dangerously high potassium levels (hyperkalemia). Severity: High."},

    # ── Metformin ──
    {"keywords": ["metformin"], "text": "Metformin is an oral diabetes medication that helps control blood sugar levels. It is the first-line treatment for type 2 diabetes and works by decreasing glucose production in the liver."},
    {"keywords": ["metformin", "side effect"], "text": "Common side effects of Metformin include nausea, vomiting, diarrhea, stomach pain, and metallic taste. These usually improve over time. Rare but serious: lactic acidosis."},
    {"keywords": ["metformin", "dosage"], "text": "Typical adult Metformin dosage: Starting dose 500mg twice daily with meals. May increase to 2000-2550mg/day in divided doses. Extended-release: 500-2000mg once daily with evening meal."},

    # ── Paracetamol / Acetaminophen ──
    {"keywords": ["paracetamol", "acetaminophen", "tylenol"], "text": "Paracetamol (Acetaminophen/Tylenol) is used to relieve mild to moderate pain and reduce fever. Unlike NSAIDs, it does not reduce inflammation significantly."},
    {"keywords": ["paracetamol", "acetaminophen", "tylenol", "side effect"], "text": "Paracetamol is generally safe at recommended doses. Overdose can cause severe liver damage. Avoid exceeding 4g/day in adults. Alcohol use increases liver risk."},
    {"keywords": ["paracetamol", "acetaminophen", "dosage"], "text": "Typical adult Paracetamol dosage: 500-1000mg every 4-6 hours as needed (max 4000mg/day). Reduce maximum dose if you have liver problems or drink alcohol regularly."},

    # ── Omeprazole ──
    {"keywords": ["omeprazole", "prilosec"], "text": "Omeprazole (Prilosec) is a proton pump inhibitor (PPI) that reduces stomach acid. Used to treat GERD, stomach ulcers, and conditions with excess stomach acid."},
    {"keywords": ["omeprazole", "side effect"], "text": "Common side effects of Omeprazole include headache, nausea, diarrhea, stomach pain, and gas. Long-term use may increase risk of bone fractures, vitamin B12 deficiency, and kidney problems."},

    # ── Atorvastatin ──
    {"keywords": ["atorvastatin", "lipitor", "statin"], "text": "Atorvastatin (Lipitor) is a statin used to lower cholesterol and reduce the risk of heart disease and stroke. It works by blocking an enzyme needed to make cholesterol."},
    {"keywords": ["atorvastatin", "lipitor", "side effect"], "text": "Common side effects of Atorvastatin include muscle pain, joint pain, diarrhea, and nausea. Rare but serious: rhabdomyolysis (severe muscle breakdown). Report unexplained muscle pain immediately."},

    # ── Amlodipine ──
    {"keywords": ["amlodipine", "norvasc"], "text": "Amlodipine (Norvasc) is a calcium channel blocker used to treat high blood pressure and chest pain (angina). It relaxes blood vessels to improve blood flow."},
    {"keywords": ["amlodipine", "side effect"], "text": "Common side effects of Amlodipine include swelling of ankles/feet, dizziness, flushing, and fatigue. These are usually mild and may decrease over time."},

    # ── Losartan ──
    {"keywords": ["losartan", "cozaar"], "text": "Losartan (Cozaar) is an angiotensin II receptor blocker (ARB) used to treat high blood pressure, protect kidneys in diabetic patients, and reduce stroke risk."},
    {"keywords": ["losartan", "side effect"], "text": "Common side effects of Losartan include dizziness, stuffy nose, back pain, and fatigue. Unlike ACE inhibitors, it rarely causes dry cough."},

    # ── General Interactions ──
    {"keywords": ["blood thinner", "anticoagulant"], "text": "Blood thinners (anticoagulants) like Warfarin, Aspirin, and Clopidogrel increase bleeding risk. Avoid combining multiple blood thinners without medical supervision."},
    {"keywords": ["nsaid", "anti-inflammatory"], "text": "NSAIDs (Ibuprofen, Naproxen, Aspirin) can cause stomach bleeding, kidney problems, and cardiovascular issues with long-term use. Avoid combining multiple NSAIDs."},
]

# If we want to add user-specific documents later
user_documents = []

def add_documents(user_id: str, texts: list, metadatas: list, ids: list):
    """Add documents with user_id namespace in metadata."""
    for i in range(len(texts)):
        user_documents.append({
            "user_id": user_id,
            "text": texts[i],
            "metadata": metadatas[i] if i < len(metadatas) else {},
            "id": ids[i] if i < len(ids) else str(i)
        })

def retrieve_context(user_id: str, query: str, n_results: int = 5):
    """Retrieve documents using improved keyword matching."""
    results = []
    query_lower = query.lower()
    query_words = set(query_lower.split())
    
    # Score each guideline by how many keywords match
    scored = []
    for guideline in mock_guidelines:
        matched_keywords = 0
        for kw in guideline["keywords"]:
            if kw in query_lower:
                matched_keywords += 1
        if matched_keywords > 0:
            # Bonus for matching more keywords (more specific results rank higher)
            score = matched_keywords / len(guideline["keywords"])
            scored.append((score, guideline["text"]))
    
    # Sort by score descending and take top results
    scored.sort(key=lambda x: x[0], reverse=True)
    results = [text for _, text in scored[:n_results]]
            
    # Check user documents
    for doc in user_documents:
        if doc["user_id"] == user_id or doc["user_id"] == "public":
            if any(word in doc["text"].lower() for word in query_words):
                results.append(doc["text"])
                
    # Return unique matches up to n_results
    return list(dict.fromkeys(results))[:n_results]
