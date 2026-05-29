"""Schemas for the user auth and session endpoints."""

from pydantic import BaseModel, EmailStr, Field


class UserLoginRequest(BaseModel):
    username: str
    password: str


class UserRegisterRequest(BaseModel):
    username: str  = Field(..., min_length=3, max_length=50)
    email:    EmailStr
    password: str  = Field(..., min_length=8, description="Minimum 8 characters")


class UserInfo(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    created_at: str


class UserTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


class UserSessionResponse(BaseModel):
    id: int
    user_id: int
    title: str
    created_at: str
    updated_at: str
