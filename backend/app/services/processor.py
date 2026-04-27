"""LLM processing engine with chunking and prompt rendering.

Supports any OpenAI-compatible provider (OpenAI, Google Gemini, Groq,
Together, Mistral, DeepSeek, xAI, NVIDIA NIM, Ollama) plus Anthropic
Claude via its native SDK.
"""

import logging

from app.prompts import PROMPTS

logger = logging.getLogger(__name__)

MAX_CHUNK_TOKENS = 3000
OVERLAP_TOKENS = 200
CHARS_PER_TOKEN = 4

# ── Provider registry ────────────────────────────────────────────────
# Every provider except Anthropic uses the OpenAI-compatible chat API.
# Format: provider -> (base_url, default_model, needs_api_key)
PROVIDERS: dict[str, tuple[str, str, bool]] = {
    "openai":      ("https://api.openai.com/v1",              "gpt-4.1-nano",                     True),
    "google":      ("https://generativelanguage.googleapis.com/v1beta/openai", "gemini-2.5-flash", True),
    "openrouter":  ("https://openrouter.ai/api/v1",           "meta-llama/llama-3.3-70b-instruct", True),
    "groq":        ("https://api.groq.com/openai/v1",         "llama-3.3-70b-versatile",          True),
    "together":    ("https://api.together.xyz/v1",             "meta-llama/Llama-3.3-70B-Instruct-Turbo", True),
    "mistral":     ("https://api.mistral.ai/v1",               "mistral-small-latest",             True),
    "deepseek":    ("https://api.deepseek.com",                "deepseek-v4-flash",                True),
    "xai":         ("https://api.x.ai/v1",                     "grok-4.20",                        True),
    "nvidia":      ("https://integrate.api.nvidia.com/v1",     "meta/llama-3.1-8b-instruct",       True),
    "ollama":      ("http://localhost:11434/v1",                "gemma3:latest",                    False),
    "huggingface": ("https://api-inference.huggingface.co/v1", "meta-llama/Llama-3.3-70B-Instruct", True),
}

# Models available per provider (shown in the frontend selector)
# Updated April 2026 — only currently-supported models
PROVIDER_MODELS: dict[str, list[str]] = {
    "anthropic": [
        "claude-opus-4-7",
        "claude-sonnet-4-6",
        "claude-haiku-4-5-20251001",
    ],
    "openai": [
        "gpt-5.5",
        "gpt-5.4",
        "gpt-5.4-mini",
        "gpt-5.4-nano",
        "gpt-4.1",
        "gpt-4.1-mini",
        "gpt-4.1-nano",
        "o3",
        "o3-pro",
        "o3-mini",
        "o4-mini",
    ],
    "google": [
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
    ],
    "groq": [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "gemma2-9b-it",
    ],
    "together": [
        "Qwen/Qwen3.5-397B-A17B",
        "deepseek-ai/DeepSeek-V4-Pro",
        "deepseek-ai/DeepSeek-R1",
        "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
        "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    ],
    "mistral": [
        "mistral-large-latest",
        "mistral-small-latest",
        "devstral-2512",
        "codestral-latest",
    ],
    "deepseek": [
        "deepseek-v4-pro",
        "deepseek-v4-flash",
        "deepseek-chat",
        "deepseek-reasoner",
    ],
    "xai": [
        "grok-4.20",
        "grok-4.20-reasoning",
        "grok-4.1-fast-reasoning",
        "grok-3-beta",
        "grok-3-mini-beta",
    ],
    "openrouter": [
        "meta-llama/llama-3.3-70b-instruct",
        "anthropic/claude-sonnet-4",
        "openai/gpt-5.4",
        "google/gemini-2.5-pro",
        "deepseek/deepseek-r1",
        "qwen/qwen-2.5-72b-instruct",
        "mistralai/mistral-large",
    ],
    "nvidia": [
        "meta/llama-3.1-8b-instruct",
        "meta/llama-3.1-70b-instruct",
        "mistralai/mixtral-8x7b-instruct-v01",
    ],
    "huggingface": [
        "meta-llama/Llama-3.3-70B-Instruct",
        "Qwen/Qwen2.5-72B-Instruct",
        "mistralai/Mixtral-8x7B-Instruct-v0.1",
        "google/gemma-2-27b-it",
    ],
    "ollama": [
        "gemma4:9b",
        "gemma3:latest",
        "llama3.3:70b",
        "llama3.1:latest",
        "deepseek-r1:32b",
        "deepseek-r1:7b",
        "qwen3:14b",
        "qwen2.5-coder:32b",
        "mistral:latest",
    ],
}


def _estimate_tokens(text: str) -> int:
    return len(text) // CHARS_PER_TOKEN


def chunk_transcript(text: str) -> list[str]:
    max_chars = MAX_CHUNK_TOKENS * CHARS_PER_TOKEN
    overlap_chars = OVERLAP_TOKENS * CHARS_PER_TOKEN
    if len(text) <= max_chars:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = start + max_chars
        chunks.append(text[start:end])
        start = end - overlap_chars
    return chunks


def _call_anthropic(prompt: str, api_key: str, model: str = "", max_tokens: int = 4096) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model=model or "claude-sonnet-4-6",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


def _call_openai_compatible(
    prompt: str,
    api_key: str,
    base_url: str,
    model: str,
    max_tokens: int = 4096,
) -> str:
    from openai import OpenAI
    client = OpenAI(base_url=base_url, api_key=api_key or "ollama")
    response = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content or ""


def _call_llm(
    prompt: str,
    provider: str = "",
    api_key: str = "",
    model: str = "",
    max_tokens: int = 4096,
) -> str:
    """Route to the correct LLM provider."""
    if not provider:
        raise ValueError(
            "No LLM provider configured. Set a provider in Tweaks or "
            "configure ANTHROPIC_API_KEY / OPENAI_API_KEY / NVIDIA_API_KEY on the server."
        )

    if provider == "anthropic":
        if not api_key:
            raise ValueError("Anthropic API key required")
        return _call_anthropic(prompt, api_key, model, max_tokens)

    if provider not in PROVIDERS:
        raise ValueError(f"Unknown provider: {provider}")

    base_url, default_model, needs_key = PROVIDERS[provider]
    if needs_key and not api_key:
        raise ValueError(f"{provider} API key required")

    return _call_openai_compatible(
        prompt,
        api_key=api_key,
        base_url=base_url,
        model=model or default_model,
        max_tokens=max_tokens,
    )


def process_transcript(
    transcript: str,
    output_format: str,
    provider: str = "",
    api_key: str = "",
    model: str = "",
) -> str:
    """Process a transcript through the LLM with the specified output format."""
    if output_format not in PROMPTS:
        raise ValueError(f"Unknown output format: {output_format}")

    template = PROMPTS[output_format]
    chunks = chunk_transcript(transcript)

    if len(chunks) == 1:
        prompt = template.format(transcript=chunks[0])
        return _call_llm(prompt, provider, api_key, model)

    logger.info("Processing %d chunks for format '%s'", len(chunks), output_format)
    chunk_results = []
    for i, chunk in enumerate(chunks):
        prompt = template.format(transcript=chunk)
        result = _call_llm(prompt, provider, api_key, model)
        chunk_results.append(result)
        logger.info("Completed chunk %d/%d", i + 1, len(chunks))

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

    return _call_llm(merge_prompt, provider, api_key, model)
