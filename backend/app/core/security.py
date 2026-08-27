import jwt
from typing import Any, Dict, Optional
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
from app.core.config import settings

# Supabase Auth tokens use HS256 by default
ALGORITHM = "HS256"


def decode_token(token: str) -> Dict[str, Any]:
    """
    Decodes and verifies a Supabase JWT token.
    Uses SUPABASE_SECRET_KEY as the HMAC secret.
    """
    try:
        # Decode token with secret key and options
        payload = jwt.decode(
            token,
            settings.SUPABASE_SECRET_KEY,
            algorithms=[ALGORITHM],
            options={
                "verify_signature": True,
                "verify_exp": True,
                # Supabase tokens have aud="authenticated"
                "verify_aud": False,
            },
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def create_access_token(
    subject: str,
    email: str,
    role: str = "authenticated",
    user_metadata: Optional[Dict[str, Any]] = None,
    app_metadata: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Generates a signed JWT matching the Supabase Auth token format.
    Used for local testing, integration tests, and programmatic token generation.
    """
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(hours=1))

    payload = {
        "sub": subject,
        "email": email,
        "role": role,
        "aud": "authenticated",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "user_metadata": user_metadata or {},
        "app_metadata": app_metadata or {},
    }

    return jwt.encode(payload, settings.SUPABASE_SECRET_KEY, algorithm=ALGORITHM)
