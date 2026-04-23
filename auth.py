import firebase_admin
from firebase_admin import credentials, auth
import os
import logging

def init_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            logging.info("Firebase Admin initialized successfully.")
        else:
            logging.warning("FIREBASE_CREDENTIALS_PATH not set or file missing. Firebase Auth disabled.")
    except Exception as e:
        logging.error(f"Failed to initialize Firebase: {e}")

def verify_token(id_token: str) -> str:
    """Verify Firebase ID token and return user_id"""
    try:
        if not firebase_admin._apps:
            # Fallback for local testing without Firebase
            return id_token
            
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token['uid']
    except Exception as e:
        logging.error(f"Token verification failed: {e}")
        return None
