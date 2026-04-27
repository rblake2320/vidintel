"""LLM prompt templates for the four output modes."""

BULLET_PLAN = """You are a content distillation engine. Strip all filler, repetition, sponsor \
mentions, timestamps, and conversational padding. Return ONLY actionable, \
instructional content formatted as:

## [Stage/Phase Title]
- Bullet: concrete action or principle
- Bullet: fill in any implied steps the speaker assumed but skipped
- [NOTE: expand this] flag any vague or incomplete points

Rules:
- No intro paragraph. No summary at the end.
- No "In this video..." or "As I mentioned..."
- If the speaker implied a step without explaining it, add it and mark as [INFERRED]
- Max 6 bullets per stage
- Output Markdown only

TRANSCRIPT:
{transcript}"""

SOP = """Convert this transcript into a structured training document.

## [Module Title]
**Objective:** [one sentence — what the reader will be able to do]

### Step [N] — [Action Title]
**What to do:** [specific instruction]
**Why it matters:** [one sentence rationale]
**Watch out for:** [common mistake or edge case]

**Key Takeaways:**
- [3-5 bullets max]

Rules:
- Strip all filler, sponsorships, personal anecdotes, off-topic tangents
- Fill in missing how-to detail for any step that was implied but not explained
- Output Markdown only. No preamble. No closing remarks.

TRANSCRIPT:
{transcript}"""

STUDY_GUIDE = """Transform this transcript into a study guide with the following structure:

## Core Concepts
| Concept | Definition | Example |
|---|---|---|

## Frameworks & Models
[Name each framework, explain it in 2-3 sentences, state when to use it]

## Decision Points
[When to use X vs Y — formatted as a decision table or bullets]

## Action Checklist
- [ ] Actionable step 1
- [ ] Actionable step 2

Rules:
- No filler, no commentary, no timestamps
- If a concept is referenced but not explained, define it from context and mark [INFERRED]
- Output Markdown only

TRANSCRIPT:
{transcript}"""

KEY_CONCEPTS = """Extract every named concept, framework, tool, principle, or term from this \
transcript. For each one:

## [Concept Name]
**Type:** [framework / tool / principle / process]
**Definition:** [2-3 sentence explanation]
**When to use it:** [one sentence]
**Related concepts:** [comma-separated list]

Rules:
- Alphabetical order
- Only include genuinely named or defined items — not general statements
- Output Markdown only. No intro. No summary.

TRANSCRIPT:
{transcript}"""

PROMPTS = {
    "bullets": BULLET_PLAN,
    "sop": SOP,
    "study": STUDY_GUIDE,
    "concepts": KEY_CONCEPTS,
}
