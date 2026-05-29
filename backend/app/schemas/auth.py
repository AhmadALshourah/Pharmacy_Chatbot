"""Schemas for authentication and admin management."""

from typing import Literal
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: "AdminInfo"


class AdminInfo(BaseModel):
    id: int
    username: str
    email: str
    role: Literal["master_admin", "admin"]
    is_active: bool
    created_at: str


class CreateAdminRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    role: Literal["master_admin", "admin"] = "admin"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class AdminRegisterRequest(BaseModel):
    """Public self-registration — always creates a regular 'admin' (not master_admin)."""
    username: str      = Field(..., min_length=3, max_length=50)
    email:    EmailStr
    password: str      = Field(..., min_length=8, description="Minimum 8 characters")


TokenResponse.model_rebuild()
