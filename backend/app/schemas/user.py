"""Schemas for the user auth and session endpoints."""

from pydantic import BaseModel


class UserLoginRequest(BaseModel):
    username: str
    password: str


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
