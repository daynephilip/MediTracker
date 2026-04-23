import base64
import os
import requests
from openai import OpenAI
from guardrails import ParsedMedication
import json
import logging

# Groq Cloud API — OpenAI-compatible endpoint
client = OpenAI(
    api_key=os.environ.get("GROQ_API_KEY", ""),
    base_url="https://api.groq.com/openai/v1"
)
MODEL = os.environ.get("GROQ_MODEL", "qwen-3.5-9b")
OCR_API_KEY = os.environ.get("OCR_SPACE_API_KEY", "")


def ocr_extract_text(base64_image: str, mime_type: str = "image/jpeg") -> str:
    """Use OCR.space free API to extract text from an image."""
    try:
        # OCR.space accepts base64 images with a data URI prefix
        data_uri = f"data:{mime_type};base64,{base64_image}"
        
        payload = {
            "apikey": OCR_API_KEY,
            "base64Image": data_uri,
            "language": "eng",
            "isOverlayRequired": False,
            "OCREngine": 2,  # Engine 2 is better for complex layouts
        }
        
        response = requests.post(
            "https://api.ocr.space/parse/image",
            data=payload,
            timeout=30
        )
        result = response.json()
        
        if result.get("IsErroredOnProcessing"):
            error_msg = result.get("ErrorMessage", ["Unknown OCR error"])
            logging.error(f"OCR.space error: {error_msg}")
            return ""
        
        # Combine all parsed text blocks
        parsed_results = result.get("ParsedResults", [])
        texts = [r.get("ParsedText", "") for r in parsed_results]
        return " ".join(texts).strip()
        
    except Exception as e:
        logging.error(f"OCR extraction failed: {e}")
        return ""


def extract_drug_info_from_image(base64_image: str, mime_type: str = "image/jpeg") -> dict:
    """Extract drug name and dosage from a medication bottle image.
    
    Pipeline:
    1. OCR.space extracts raw text from the image
    2. Qwen (via Groq) parses the text into structured JSON
    """
    try:
        # Step 1: OCR to extract text
        raw_text = ocr_extract_text(base64_image, mime_type)
        
        if not raw_text:
            logging.warning("OCR returned no text from image")
            return {"name": "Unknown", "dosage": "", "error": "Could not read text from image. Please enter details manually."}
        
        logging.info(f"OCR extracted text: {raw_text[:200]}")
        
        # Step 2: Send to Qwen via Groq for structured parsing
        prompt = f"""
        The following text was extracted from a medication bottle label via OCR:
        
        "{raw_text}"
        
        Extract the drug name and dosage from this text.
        Output exactly in this JSON format (no extra text, no markdown fences):
        {{"name": "Drug Name", "dosage": "Dosage Info (e.g. 500mg) or empty string"}}
        """
        
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "You are a medication label parser. Extract drug name and dosage from OCR text. Respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=256
        )
        
        text = response.choices[0].message.content.strip()
        text = text.replace('```json', '').replace('```', '').strip()
        result = json.loads(text)
        validated = ParsedMedication(**result)
        return validated.model_dump()
        
    except Exception as e:
        logging.error(f"Drug info extraction error: {e}")
        # Fallback
        return {"name": "Unknown", "dosage": "", "error": "Could not parse medication info. Please enter details manually."}
