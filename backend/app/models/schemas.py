"""Pydantic request/response models."""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, HttpUrl


class SourceType(str, Enum):
    youtube = "youtube"
    paste = "paste"


class OutputFormat(str, Enum):
    bullets = "bullets"
    sop = "sop"
    study = "study"
    concepts = "concepts"


class ProcessRequest(BaseModel):
    source: str = Field(
        ...,
        min_length=1,
        max_length=100_000,
        description="YouTube URL or raw transcript text",
    )
    source_type: SourceType
    output_format: OutputFormat


class JobResponse(BaseModel):
    job_id: uuid.UUID
    session_id: uuid.UUID
    status: str

    model_config = {"from_attributes": True}


class JobStatusResponse(BaseModel):
    job_id: uuid.UUID
    session_id: uuid.UUID
    status: str
    error_message: str | None = None
    output_content: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    id: uuid.UUID
    source_url: str | None = None
    source_type: str
    output_format: str
    output_content: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BulkProcessItem(BaseModel):
    source: str = Field(..., min_length=1, max_length=100_000)
    source_type: SourceType
    output_format: OutputFormat


class BulkProcessRequest(BaseModel):
    items: list[BulkProcessItem] = Field(..., min_length=1, max_length=50)


class BulkJobResponse(BaseModel):
    jobs: list[JobResponse]
    total: int


class UsageResponse(BaseModel):
    jobs_this_hour: int
    limit_per_hour: int = 10


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
