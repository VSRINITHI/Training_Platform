import uuid
from typing import Optional, List, Any
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


class DomainResponse(DomainBase):
    id: uuid.UUID
    created_at: datetime


class SubDomainResponse(SubDomainBase):
    id: uuid.UUID
    created_at: datetime


class SubDomainDetailResponse(SubDomainResponse):
    domain: Optional[DomainResponse] = None
    published_course_count: int = 0


class DomainWithSubDomainsResponse(DomainResponse):
    sub_domains: List[SubDomainResponse] = []


class UserInterestDetailResponse(CoreBaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    sub_domain_id: uuid.UUID
    created_at: datetime
    sub_domain: Optional[SubDomainResponse] = None


class TaxonomyTreeResponse(CoreBaseModel):
    domains: List[DomainWithSubDomainsResponse] = []


class PersonalizedDiscoveryResponse(CoreBaseModel):
    is_personalized: bool
    interest_sub_domain_ids: List[uuid.UUID] = []
    matched_courses: List[Any] = []
    total_matches: int = 0
