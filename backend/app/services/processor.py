"""LLM processing engine with chunking and prompt rendering.

Uses Anthropic Claude when ANTHROPIC_API_KEY is set; falls back to
OpenAI GPT-4o when only OPENAI_API_KEY is available.
"""

import logging

from app.prompts import PROMPTS

logger = logging.getLogger(__name__)

# Token limits for chunking
MAX_CHUNK_TOKENS = 3000
OVERLAP_TOKENS = 200
# Rough approximation: 1 token ~ 4 characters
CHARS_PER_TOKEN = 4


def _estimate_tokens(text: str) -> int:
    """Rough token count estimate."""
    return len(text) // CHARS_PER_TOKEN


def chunk_transcript(text: str) -> list[str]:
    """
    Split transcript into chunks of ~MAX_CHUNK_TOKENS with OVERLAP_TOKENS overlap.
    If the text fits in one chunk, returns a single-element list.
    """
    max_chars = MAX_CHUNK_TOKENS * CHARS_PER_TOKEN
    overlap_chars = OVERLAP_TOKENS * CHARS_PER_TOKEN

    if len(text) <= max_chars:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + max_chars
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap_chars

    return chunks


def _call_claude(prompt: str, api_key: str, max_tokens: int = 4096) -> str:
    """Call Anthropic Claude API and return the text response."""
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


def _call_openai(prompt: str, api_key: str, max_tokens: int = 4096) -> str:
    """Call OpenAI GPT-4o API and return the text response."""
    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content or ""


def _call_nvidia(prompt: str, api_key: str, max_tokens: int = 4096) -> str:
    """Call NVIDIA API (OpenAI-compatible) using llama-3.1-8b-instruct."""
    from openai import OpenAI
    client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=api_key,
    )
    response = client.chat.completions.create(
        model="meta/llama-3.1-8b-instruct",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content or ""


def _call_llm(
    prompt: str,
    anthropic_api_key: str = "",
    openai_api_key: str = "",
    nvidia_api_key: str = "",
    max_tokens: int = 4096,
) -> str:
    """Call Claude if key present, else OpenAI GPT-4o, else NVIDIA llama-3.1."""
    if anthropic_api_key:
        return _call_claude(prompt, anthropic_api_key, max_tokens)
    elif openai_api_key:
        return _call_openai(prompt, openai_api_key, max_tokens)
    elif nvidia_api_key:
        return _call_nvidia(prompt, nvidia_api_key, max_tokens)
    else:
        raise ValueError("No LLM API key configured (set ANTHROPIC_API_KEY, OPENAI_API_KEY, or NVIDIA_API_KEY)")


def process_transcript(
    transcript: str,
    output_format: str,
    anthropic_api_key: str = "",
    openai_api_key: str = "",
    nvidia_api_key: str = "",
) -> str:
    """
    Process a transcript through the LLM with the specified output format.

    Chunks long transcripts, processes each chunk, then merges results.
    Returns the final Markdown string.
    """
    if output_format not in PROMPTS:
        raise ValueError(f"Unknown output format: {output_format}")

    template = PROMPTS[output_format]
    chunks = chunk_transcript(transcript)

    if len(chunks) == 1:
        prompt = template.format(transcript=chunks[0])
        return _call_llm(prompt, anthropic_api_key, openai_api_key, nvidia_api_key)

    # Process each chunk separately
    logger.info("Processing %d chunks for format '%s'", len(chunks), output_format)
    chunk_results = []
    for i, chunk in enumerate(chunks):
        prompt = template.format(transcript=chunk)
        result = _call_llm(prompt, anthropic_api_key, openai_api_key)
        chunk_results.append(result)
        logger.info("Completed chunk %d/%d", i + 1, len(chunks))

    # Merge: ask LLM to consolidate the chunked outputs
    merge_prompt = (
        "You are given multiple Markdown sections generated from different parts "
        "of the same transcript. Merge them into a single cohesive document.\n\n"
        "Rules:\n"
        "- Remove duplicate sections or bullets\n"
        "- Maintain the original formatting style\n"
        "- Preserve all unique content\n"
        "- Output Markdown only. No preamble.\n\n"
    )
    for i, result in enumerate(chunk_results):
        merge_prompt += f"--- SECTION {i + 1} ---\n{result}\n\n"

    return _call_llm(merge_prompt, anthropic_api_key, openai_api_key)
