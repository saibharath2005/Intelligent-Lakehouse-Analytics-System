import hashlib
from datetime import datetime, timedelta, timezone
from jose import jwt
from passlib.context import CryptContext
from core.config import settings


SECRET_KEY:str = settings.SECRET_KEY #os.getenv("SECRET_KEY")
ALGO:str = settings.ALGORITHM

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

def _prehash(password: str) -> str:
    # Always 64 bytes to safe for bcrypt
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def hash_pwd(password: str) -> str:
    prehashed = _prehash(password)
    return pwd_context.hash(prehashed)

def verify(password: str, hashed: str) -> bool:
    prehashed = _prehash(password)
    return pwd_context.verify(prehashed, hashed)

def create_token(uid: int):
    expire = datetime.now(timezone.utc) + timedelta(hours=12)
    payload = {"sub": str(uid), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGO)
