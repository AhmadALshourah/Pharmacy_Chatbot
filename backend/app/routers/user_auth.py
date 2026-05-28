"""User authentication endpoints (login, me)."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_user_by_username
from app.dependencies import get_current_user
from app.services.auth_service import verify_password, create_user_access_token
from app.schemas.user import UserLoginRequest, UserInfo, UserTokenResponse

log = logging.getLogger("pharmacy")

router = APIRouter(prefix="/user", tags=["user-auth"])


@router.post("/login", response_model=UserTokenResponse)
async def user_login(body: UserLoginRequest):
    """Authenticate a user and return a JWT access token."""
    user = get_user_by_username(body.username)
    if user is None or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )
    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact an admin.",
        )

    token = create_user_access_token(user["id"], user["username"])
    log.info(f"User login: {user['username']}")
    return UserTokenResponse(
        access_token=token,
        user=UserInfo(**{k: v for k, v in user.items() if k != "password_hash"}),
    )


@router.get("/me", response_model=UserInfo)
async def user_me(user: dict = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return UserInfo(**{k: v for k, v in user.items() if k != "password_hash"})
