"""YouTube transcript extraction with Whisper fallback."""

import logging
import re
import tempfile
from pathlib import Path

from youtube_transcript_api import YouTubeTranscriptApi

logger = logging.getLogger(__name__)

# Match standard YouTube URL patterns
YOUTUBE_URL_PATTERN = re.compile(
    r"(?:https?://)?(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]{11})"
)

# Language preference order: manual EN first, then auto-generated EN variants, then any
_CAPTION_LANGUAGES = ["en", "en-US", "en-GB", "en-CA", "en-AU"]


def extract_video_id(url: str) -> str | None:
    """Extract the 11-character video ID from a YouTube URL."""
    match = YOUTUBE_URL_PATTERN.search(url)
    return match.group(1) if match else None


_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def get_transcript_from_captions(video_id: str, cookies_file: str = "") -> str | None:
    """Attempt to fetch transcript via youtube-transcript-api (v1.x API).

    Tries manual EN captions first, then auto-generated EN variants.
    Uses a browser-like User-Agent and optional cookies to avoid IP blocks.
    """
    import requests as _requests

    session = _requests.Session()
    session.headers.update({"User-Agent": _BROWSER_UA})
    if cookies_file:
        import http.cookiejar
        jar = http.cookiejar.MozillaCookieJar(cookies_file)
        jar.load(ignore_discard=True, ignore_expires=True)
        session.cookies = jar  # type: ignore[assignment]

    kwargs: dict = {"http_client": session}
    api = YouTubeTranscriptApi(**kwargs)

    # Try preferred languages
    try:
        fetched = api.fetch(video_id, languages=_CAPTION_LANGUAGES)
        return " ".join(s.text for s in fetched)
    except Exception as exc:
        logger.debug("Preferred language captions failed for %s: %s", video_id, exc)

    # Fall back to any available language
    try:
        fetched = api.fetch(video_id)
        return " ".join(s.text for s in fetched)
    except Exception as exc:
        logger.warning("All caption fetches failed for %s: %s", video_id, exc)
        return None


def get_transcript_from_whisper(
    video_id: str,
    openai_api_key: str,
    cookies_file: str = "",
) -> str:
    """Download audio via yt-dlp and transcribe with OpenAI Whisper API.

    Uses formats (m4a, webm) that don't require ffmpeg post-processing.
    Whisper API natively accepts m4a, mp4, mpeg, mpga, mp3, wav, webm.
    """
    import openai
    import yt_dlp

    client = openai.OpenAI(api_key=openai_api_key)

    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = str(Path(tmpdir) / "audio.%(ext)s")
        ydl_opts = {
            # Prefer m4a/webm — no ffmpeg needed for these containers
            "format": "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio[ext=opus]/bestaudio",
            "outtmpl": output_path,
            "quiet": True,
            "no_warnings": True,
            "http_headers": {"User-Agent": _BROWSER_UA},
        }
        if cookies_file:
            ydl_opts["cookiefile"] = cookies_file

        # Try download; on bot-detection retry with browser cookies
        def _download(opts: dict) -> None:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([f"https://www.youtube.com/watch?v={video_id}"])

        try:
            _download(ydl_opts)
        except yt_dlp.utils.DownloadError as exc:
            msg = str(exc)
            if "Sign in" not in msg and "bot" not in msg.lower():
                raise
            # Retry with Chrome cookies automatically
            logger.info("Bot detection on %s — retrying with Chrome cookies", video_id)
            try:
                _download({**ydl_opts, "cookiesfrombrowser": ("chrome",)})
            except Exception:
                raise RuntimeError(
                    f"YouTube blocked the audio download for video {video_id} "
                    "(bot detection). Options: (1) set YOUTUBE_COOKIES_FILE in .env "
                    "to a Netscape-format cookies file exported from your browser, "
                    "or (2) paste the transcript directly using the 'Paste transcript' option."
                ) from exc

        audio_files = list(Path(tmpdir).glob("audio.*"))
        if not audio_files:
            raise RuntimeError(f"No audio file produced for video {video_id}")
        audio_file = audio_files[0]

        with open(audio_file, "rb") as f:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="text",
            )
        return response


def extract_transcript(
    source: str,
    source_type: str,
    openai_api_key: str = "",
    cookies_file: str = "",
) -> str:
    """
    Main entry point for transcript extraction.

    For source_type='paste', returns the source text directly.
    For source_type='youtube', tries captions first, then Whisper fallback.
    """
    if source_type == "paste":
        text = source.strip()
        if not text:
            raise ValueError("Empty transcript provided")
        return text

    video_id = extract_video_id(source)
    if not video_id:
        raise ValueError(f"Could not extract video ID from URL: {source}")

    # Try captions first
    transcript = get_transcript_from_captions(video_id, cookies_file=cookies_file)
    if transcript:
        return transcript

    # Fallback to Whisper
    if not openai_api_key:
        raise RuntimeError(
            f"No captions available for video {video_id}. "
            "To process this video: (1) configure OPENAI_API_KEY for Whisper transcription, "
            "or (2) use the 'Paste transcript' option to paste the text directly."
        )

    logger.info("Falling back to Whisper for video %s", video_id)
    return get_transcript_from_whisper(video_id, openai_api_key, cookies_file=cookies_file)
