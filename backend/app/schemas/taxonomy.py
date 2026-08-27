import uuid
from typing import Optional, List
from datetime import datetime
from pydantic import Field
from app.schemas.common import CoreBaseModel


class DomainBase(CoreBaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    icon_url: Optional[str] = None


class DomainCreate(DomainBase):
    pass


class DomainUpdate(CoreBaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    slug: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    icon_url: Optional[str] = None


class SubDomainBase(CoreBaseModel):
    domain_id: uuid.UUID
    name: str = Field(..., min_length=1, max_length=150)
    slug: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None


class SubDomainCreate(SubDomainBase):
    pass


class SubDomainUpdate(CoreBaseModel):
    domain_id: Optional[uuid.UUID] = None
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    slug: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None


class SubDomainResponse(SubDomainBase):
    id: uuid.UUID
    created_at: datetime


class DomainResponse(DomainBase):
    id: uuid.UUID
    created_at: datetime


class DomainWithSubDomainsResponse(DomainResponse):
    sub_domains: List[SubDomainResponse] = []
