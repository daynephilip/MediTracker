from pydantic import BaseModel, Field
import re

DISCLAIMER = "\n\n⚠️ This is for educational purposes only. Always consult a licensed pharmacist or physician before starting, stopping, or changing medications."

class InteractionResult(BaseModel):
    has_interaction: bool = Field(description="Whether there is a known interaction")
    severity: str = Field(description="Severity of the interaction (High, Moderate, Low, None)")
    explanation: str = Field(description="Plain-language explanation of the interaction")
    supported_by_context: bool = Field(description="Does this response contain factual drug information supported by retrieved context? Y/N")

class ParsedMedication(BaseModel):
    name: str = Field(description="Name of the medication")
    dosage: str = Field(description="Dosage of the medication if found, else empty string")

def sanitize_input(text: str) -> str:
    # Strip basic prompt injection attempts
    sanitized = re.sub(r'(?i)<script.*?>.*?</script>', '', text)
    sanitized = re.sub(r'(?i)ignore previous', '', sanitized)
    sanitized = re.sub(r'(?i)system:', '', sanitized)
    return sanitized.strip()

def append_disclaimer(text: str) -> str:
    if "⚠️ This is for educational purposes only" not in text:
        return text + DISCLAIMER
    return text
