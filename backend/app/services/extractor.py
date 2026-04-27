"""YouTube transcript extraction with Whisper fallback."""

import logging
import re
import tempfile
from pathlib import Path

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter

logger = logging.getLogger(__name__)

# Match standard YouTube URL patterns
YOUTUBE_URL_PATTERN = re.compile(
    r"(?:https?://)?(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]{11})"
)


def extract_video_id(url: str) -> str | None:
    """Extract the 11-character video ID from a YouTube URL."""
    match = YOUTUBE_URL_PATTERN.search(url)
    return match.group(1) if match else None


def get_transcript_from_captions(video_id: str) -> str | None:
    """Attempt to fetch transcript via youtube-transcript-api."""
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        # Prefer manually created, fall back to auto-generated
        try:
            transcript = transcript_list.find_manually_created_transcript(["en"])
        except Exception:
            transcript = transcript_list.find_generated_transcript(["en"])

        fetched = transcript.fetch()
        formatter = TextFormatter()
        return formatter.format_transcript(fetched)
    except Exception as exc:
        logger.warning("Caption fetch failed for %s: %s", video_id, exc)
        return None


def get_transcript_from_whisper(video_id: str, openai_api_key: str) -> str:
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
            # No postprocessors → no ffmpeg dependency
            "quiet": True,
            "no_warnings": True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([f"https://www.youtube.com/watch?v={video_id}"])

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
    transcript = get_transcript_from_captions(video_id)
    if transcript:
        return transcript

    # Fallback to Whisper
    if not openai_api_key:
        raise RuntimeError(
            f"No captions available for video {video_id} and no OpenAI API key "
            "configured for Whisper fallback"
        )

    logger.info("Falling back to Whisper for video %s", video_id)
    return get_transcript_from_whisper(video_id, openai_api_key)
