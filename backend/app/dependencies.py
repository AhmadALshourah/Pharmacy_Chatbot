"""FastAPI dependencies for authentication and authorization."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.services.auth_service import decode_token
from app.database import get_admin_by_id, get_user_by_id

_bearer = HTTPBearer()


def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """Validate JWT and return the current admin. Raises 401/403 on failure."""
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # C6: require an explicit "admin" type claim — no default fallback.
    # Any token without this field is rejected rather than silently promoted.
    if payload.get("type") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )

    admin = get_admin_by_id(int(payload["sub"]))
    if admin is None or not admin["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin account not found or deactivated.",
        )
    return admin


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """Validate JWT and return the current user. Raises 401/403 on failure."""
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User access required.",
        )

    user = get_user_by_id(int(payload["sub"]))
    if user is None or not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated.",
        )
    return user


def get_current_principal(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    """Accept either an admin or user token.

    Returns the account dict with an extra ``principal_type`` key set to
    ``"admin"`` or ``"user"`` so callers can branch on it.
    """
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # C6: type must be explicitly present — no default.
    token_type = payload.get("type")
    if token_type not in ("admin", "user"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or malformed token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub = int(payload["sub"])

    if token_type == "user":
        user = get_user_by_id(sub)
        if user is None or not user["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found or deactivated.",
            )
        return {**user, "principal_type": "user"}

    admin = get_admin_by_id(sub)
    if admin is None or not admin["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin account not found or deactivated.",
        )
    return {**admin, "principal_type": "admin"}


def require_master_admin(admin: dict = Depends(get_current_admin)) -> dict:
    """Restrict endpoint to Master Admin only."""
    if admin["role"] != "master_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Master Admin access required.",
        )
    return admin
