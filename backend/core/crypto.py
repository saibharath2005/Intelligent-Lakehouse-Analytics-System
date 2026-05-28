from cryptography.fernet import Fernet
from core.config import settings

fernet = Fernet(settings.FERNET_SECRET)

def encrypt_key(key: str)-> str:
    return fernet.encrypt(key.encode()).decode()

def decrypt_key(encrypted: str)-> str:
    return fernet.decrypt(encrypted.encode()).decode()
