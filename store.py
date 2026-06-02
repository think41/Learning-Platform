import json
from typing import Dict, List, Optional
from models import (ApprovedPlan, GeneratedSection, SectionStatus,
                    StyleBlock, Module, Submodule, SectionBrief)


class PlanStore:
    def __init__(self):
        self._raw: dict = {}
        self.plan: Optional[ApprovedPlan] = None

    def approve(self, plan_dict: dict) -> ApprovedPlan:
        """Store and version an approved plan dict from the LLM."""
        version = (self.plan.version + 1) if self.plan else 1
        plan_dict["version"] = version
        self._raw = plan_dict
        self.plan = self._parse(plan_dict)
        return self.plan

    def _parse(self, d: dict) -> ApprovedPlan:
        sd = d.get("style", {})
        style = StyleBlock(
            audience_level=sd.get("audience_level", d.get("target_audience", "")),
            tone=sd.get("tone", "clear and educational"),
            reading_level=sd.get("reading_level", "general"),
            vocabulary_rules=sd.get("vocabulary_rules", []),
        )
        modules = []
        for m in d.get("modules", []):
            subs = []
            for s in m.get("submodules", []):
                subs.append(Submodule(
                    title=s.get("title", ""),
                    duration_minutes=s.get("duration_minutes", 0),
                    lesson_count=s.get("lesson_count", 0),
                    assumed_prior_knowledge=s.get("assumed_prior_knowledge", []),
                    concepts_to_cover=s.get("concepts_to_cover", []),
                    learning_objectives=s.get("learning_objectives", []),
                ))
            modules.append(Module(
                number=m.get("number", 0),
                title=m.get("title", ""),
                duration_minutes=m.get("duration_minutes", 0),
                submodules=subs,
            ))
        return ApprovedPlan(
            version=d.get("version", 1),
            title=d.get("title", ""),
            target_audience=d.get("target_audience", ""),
            skill_level=d.get("skill_level", ""),
            total_duration_hours=d.get("total_duration_hours", 0),
            description=d.get("description", ""),
            learning_objectives=d.get("learning_objectives", []),
            assumed_prior_knowledge=d.get("assumed_prior_knowledge", []),
            style=style,
            modules=modules,
            raw=d,
        )

    def section_briefs(self) -> List[SectionBrief]:
        if not self.plan:
            return []
        briefs = []
        for m in self.plan.modules:
            for i, sub in enumerate(m.submodules):
                briefs.append(SectionBrief(
                    module_number=m.number,
                    submodule_index=i,
                    module_title=m.title,
                    title=sub.title,
                    duration_minutes=sub.duration_minutes,
                    assumed_prior_knowledge=sub.assumed_prior_knowledge or self.plan.assumed_prior_knowledge,
                    concepts_to_cover=sub.concepts_to_cover,
                    learning_objectives=sub.learning_objectives,
                ))
        return briefs

    def compact_json(self) -> str:
        """Minimal plan representation to pin into every generation call."""
        if not self._raw:
            return "{}"
        compact = {
            "title": self._raw.get("title", ""),
            "target_audience": self._raw.get("target_audience", ""),
            "skill_level": self._raw.get("skill_level", ""),
            "assumed_prior_knowledge": self._raw.get("assumed_prior_knowledge", []),
            "modules": [
                {
                    "number": m.get("number"),
                    "title": m.get("title"),
                    "submodules": [
                        {
                            "title": s.get("title"),
                            "concepts_to_cover": s.get("concepts_to_cover", []),
                        }
                        for s in m.get("submodules", [])
                    ],
                }
                for m in self._raw.get("modules", [])
            ],
        }
        return json.dumps(compact, indent=2)

    def full_json(self) -> str:
        return json.dumps(self._raw, indent=2)


class SectionStore:
    def __init__(self):
        self.sections: Dict[str, GeneratedSection] = {}
        self.concepts_introduced: List[str] = []

    def add(self, section: GeneratedSection):
        self.sections[section.id] = section
        for c in section.concepts_introduced:
            if c not in self.concepts_introduced:
                self.concepts_introduced.append(c)

    def mark_stale_from(self, module_number: int):
        """Mark all sections at or after module_number as stale."""
        for s in self.sections.values():
            if s.module_number >= module_number:
                s.status = SectionStatus.STALE

    def mark_all_stale(self):
        for s in self.sections.values():
            s.status = SectionStatus.STALE

    def approve_section(self, section_id: str):
        if section_id in self.sections:
            self.sections[section_id].status = SectionStatus.APPROVED

    def stale_count(self) -> int:
        return sum(1 for s in self.sections.values() if s.status == SectionStatus.STALE)

    def get_summary(self) -> str:
        if not self.sections:
            return "No sections generated yet."
        return "\n".join(
            f"  m{s.module_number} | {s.title} | [{s.status.value}]"
            for s in self.sections.values()
        )
