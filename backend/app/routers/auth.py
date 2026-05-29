"""Auth router: login, logout, current user, admin management."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import (
    get_admin_by_username, get_all_admins, create_admin,
    admin_exists, admin_email_exists, delete_admin, update_admin_password,
    set_admin_active, get_admin_by_id,
)
from app.services.auth_service import verify_password, hash_password, create_access_token
from app.schemas.auth import (
    LoginRequest, TokenResponse, AdminInfo,
    CreateAdminRequest, ChangePasswordRequest, AdminRegisterRequest,
)
from app.dependencies import get_current_admin, require_master_admin

log = logging.getLogger("pharmacy")
router = APIRouter(prefix="/auth", tags=["auth"])


# ── Public registration ───────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: AdminRegisterRequest):
    """Self-register a new admin account (role='admin'). Auto-logs in on success."""
    if admin_exists(body.username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{body.username}' is already taken.",
        )
    if admin_email_exists(body.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{body.email}' is already registered.",
        )
    new_id = create_admin(body.username, body.email, hash_password(body.password), "admin")
    admin  = get_admin_by_id(new_id)
    token  = create_access_token(admin["id"], admin["username"], admin["role"])
    log.info(f"Admin self-registered: {admin['username']}")
    return TokenResponse(
        access_token=token,
        admin=AdminInfo(**{k: v for k, v in admin.items() if k != "password_hash"}),
    )


# ── Login / Me ────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    """Authenticate an admin and return a JWT access token."""
    admin = get_admin_by_username(body.username)
    if admin is None or not verify_password(body.password, admin["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
        )
    if not admin["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact a Master Admin.",
        )

    token = create_access_token(admin["id"], admin["username"], admin["role"])
    log.info(f"Admin logged in: {admin['username']} ({admin['role']})")

    return TokenResponse(
        access_token=token,
        admin=AdminInfo(**{k: v for k, v in admin.items() if k != "password_hash"}),
    )


@router.get("/me", response_model=AdminInfo)
def me(admin: dict = Depends(get_current_admin)):
    """Return the currently authenticated admin's info."""
    return AdminInfo(**{k: v for k, v in admin.items() if k != "password_hash"})


# ── Admin management (Master Admin only) ─────────────────────────────────────

@router.get("/admins", response_model=list[AdminInfo])
def list_admins(admin: dict = Depends(require_master_admin)):
    """List all admin accounts. Master Admin only."""
    return [AdminInfo(**a) for a in get_all_admins()]


@router.post("/admins", response_model=AdminInfo, status_code=status.HTTP_201_CREATED)
def create_new_admin(body: CreateAdminRequest, admin: dict = Depends(require_master_admin)):
    """Create a new admin account. Master Admin only."""
    if admin_exists(body.username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{body.username}' is already taken.",
        )
    new_id = create_admin(body.username, body.email, hash_password(body.password), body.role)
    log.info(f"Admin created: {body.username} ({body.role}) by {admin['username']}")
    new_admin = get_admin_by_id(new_id)
    return AdminInfo(**{k: v for k, v in new_admin.items() if k != "password_hash"})


@router.delete("/admins/{admin_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_admin(admin_id: int, admin: dict = Depends(require_master_admin)):
    """Delete an admin account. Master Admin only. Cannot delete yourself."""
    if admin_id == admin["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account.",
        )
    target = get_admin_by_id(admin_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found.")
    delete_admin(admin_id)
    log.info(f"Admin deleted: {target['username']} by {admin['username']}")


@router.patch("/admins/{admin_id}/toggle", response_model=AdminInfo)
def toggle_admin_active(admin_id: int, admin: dict = Depends(require_master_admin)):
    """Activate or deactivate an admin. Master Admin only."""
    if admin_id == admin["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account.",
        )
    target = get_admin_by_id(admin_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found.")
    updated_ok = set_admin_active(admin_id, not target["is_active"])
    if not updated_ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found.")
    updated = get_admin_by_id(admin_id)
    return AdminInfo(**{k: v for k, v in updated.items() if k != "password_hash"})


# ── Change password (any authenticated admin) ─────────────────────────────────

@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(body: ChangePasswordRequest, admin: dict = Depends(get_current_admin)):
    """Change the current admin's own password."""
    if not verify_password(body.current_password, admin["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    update_admin_password(admin["id"], hash_password(body.new_password))
    log.info(f"Password changed for: {admin['username']}")
