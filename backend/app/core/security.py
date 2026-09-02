import logging
from typing import Any, Dict, Optional
from datetime import datetime, timedelta, timezone
import jwt
from jwt import PyJWKClient, PyJWKClientError
from fastapi import HTTPException, status
from app.core.config import settings

logger = logging.getLogger(__name__)

# Supported algorithms: ES256 (modern Supabase ECC P-256), RS256, and HS256 (legacy shared secret)
SUPPORTED_ASYMMETRIC_ALGORITHMS = ["ES256", "RS256"]
SUPPORTED_SYMMETRIC_ALGORITHMS = ["HS256"]

_jwks_client: Optional[PyJWKClient] = None


def get_jwks_client() -> Optional[PyJWKClient]:
    """
    Returns a cached PyJWKClient pointing to Supabase's public JWKS endpoint.
    Uses thread-safe in-memory key caching.
    """
    global _jwks_client
    if _jwks_client is None and settings.jwks_url:
        _jwks_client = PyJWKClient(settings.jwks_url, cache_keys=True, max_cached_keys=16)
    return _jwks_client


def decode_token(token: str, jwks_client: Optional[PyJWKClient] = None) -> Dict[str, Any]:
    """
    Decodes and cryptographically verifies a Supabase JWT token.
    - If alg is ES256 (or RS256): Uses the project's public JWKS endpoint to verify
      against the ECC P-256 public key matching the token's `kid`, and validates issuer (`iss`).
    - If alg is HS256: Verifies against settings.jwt_secret (legacy shared secret).
    - Checks signature, expiration (exp), algorithm, and issuer.
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token header: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    alg = unverified_header.get("alg")
    if not alg:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token header missing algorithm ('alg')",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Asymmetric ES256 / RS256 verification using Supabase public JWKS
    if alg in SUPPORTED_ASYMMETRIC_ALGORITHMS:
        client = jwks_client or get_jwks_client()
        if not client:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase JWKS client is not configured (SUPABASE_URL is missing)",
            )

        try:
            signing_key = client.get_signing_key_from_jwt(token)
        except PyJWKClientError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token signing key: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Unable to retrieve signing key from JWKS: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )

        issuer = settings.jwt_issuer if settings.jwt_issuer else None

        try:
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                issuer=issuer,
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iss": bool(issuer),
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
        except jwt.InvalidIssuerError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token issuer",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.InvalidTokenError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid authentication token: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # 2. Symmetric HS256 verification using legacy shared secret
    elif alg in SUPPORTED_SYMMETRIC_ALGORITHMS:
        secret = settings.jwt_secret
        if not secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="HS256 tokens not supported without SUPABASE_JWT_SECRET configured",
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=[alg],
                options={
                    "verify_signature": True,
                    "verify_exp": True,
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

    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unsupported token signing algorithm: '{alg}'",
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
    Generates a signed HS256 JWT for local testing and integration tests.
    """
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(hours=1))

    secret = settings.jwt_secret or "test-fallback-secret-for-local-hs256-tests"

    payload = {
        "sub": str(subject),
        "email": email,
        "role": role,
        "aud": "authenticated",
        "iss": settings.jwt_issuer or "https://supabase.local/auth/v1",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "user_metadata": user_metadata or {},
        "app_metadata": app_metadata or {},
    }

    return jwt.encode(payload, secret, algorithm="HS256")
