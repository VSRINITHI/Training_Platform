from typing import Generic, List, TypeVar, Optional
from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class CoreBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MessageResponse(CoreBaseModel):
    message: str
    detail: Optional[str] = None


class PaginatedResponse(CoreBaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int
