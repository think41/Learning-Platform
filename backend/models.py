from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum


class SkillLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class SectionStatus(str, Enum):
    DRAFT = "draft"
    CRITIC_REVIEWED = "critic_reviewed"
    APPROVED = "approved"
    STALE = "stale"


@dataclass
class StyleBlock:
    audience_level: str
    tone: str
    reading_level: str
    vocabulary_rules: List[str] = field(default_factory=list)


@dataclass
class CriticReport:
    flagged_claims: List[str]
    out_of_order_concepts: List[str]
    style_violations: List[str]
    passed: bool


@dataclass
class GeneratedSection:
    id: str                          # e.g. "m1_s0"
    module_number: int
    title: str
    content: str
    concepts_introduced: List[str]
    status: SectionStatus = SectionStatus.DRAFT
    critic_report: Optional[CriticReport] = None
    summary: str = ""


@dataclass
class SectionBrief:
    module_number: int
    submodule_index: int
    module_title: str
    title: str
    duration_minutes: int
    assumed_prior_knowledge: List[str]
    concepts_to_cover: List[str]
    learning_objectives: List[str]


@dataclass
class Submodule:
    title: str
    duration_minutes: int
    lesson_count: int = 0
    assumed_prior_knowledge: List[str] = field(default_factory=list)
    concepts_to_cover: List[str] = field(default_factory=list)
    learning_objectives: List[str] = field(default_factory=list)


@dataclass
class Module:
    number: int
    title: str
    duration_minutes: int
    submodules: List[Submodule] = field(default_factory=list)


@dataclass
class ApprovedPlan:
    version: int
    title: str
    target_audience: str
    skill_level: str
    total_duration_hours: float
    description: str
    learning_objectives: List[str]
    assumed_prior_knowledge: List[str]
    style: StyleBlock
    modules: List[Module]
    raw: dict = field(default_factory=dict)
