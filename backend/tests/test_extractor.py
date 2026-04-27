"""Unit tests for the transcript extractor."""

from unittest.mock import MagicMock, patch

import pytest

from app.services.extractor import extract_transcript, extract_video_id


class TestExtractVideoId:
    def test_standard_url(self):
        assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_short_url(self):
        assert extract_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_no_protocol(self):
        assert extract_video_id("youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_invalid_url(self):
        assert extract_video_id("https://example.com/not-youtube") is None

    def test_empty_string(self):
        assert extract_video_id("") is None


class TestExtractTranscript:
    def test_paste_returns_source_directly(self):
        result = extract_transcript("Hello world transcript", "paste")
        assert result == "Hello world transcript"

    def test_paste_empty_raises(self):
        with pytest.raises(ValueError, match="Empty transcript"):
            extract_transcript("   ", "paste")

    def test_invalid_youtube_url_raises(self):
        with pytest.raises(ValueError, match="Could not extract video ID"):
            extract_transcript("not-a-url", "youtube")

    @patch("app.services.extractor.get_transcript_from_captions")
    def test_youtube_uses_captions_first(self, mock_captions):
        mock_captions.return_value = "Caption transcript text"
        result = extract_transcript(
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"
        )
        assert result == "Caption transcript text"
        mock_captions.assert_called_once_with("dQw4w9WgXcQ")

    @patch("app.services.extractor.get_transcript_from_whisper")
    @patch("app.services.extractor.get_transcript_from_captions")
    def test_youtube_falls_back_to_whisper(self, mock_captions, mock_whisper):
        mock_captions.return_value = None
        mock_whisper.return_value = "Whisper transcript text"
        result = extract_transcript(
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "youtube",
            openai_api_key="sk-test",
        )
        assert result == "Whisper transcript text"
        mock_whisper.assert_called_once_with("dQw4w9WgXcQ", "sk-test")

    @patch("app.services.extractor.get_transcript_from_captions")
    def test_youtube_no_captions_no_key_raises(self, mock_captions):
        mock_captions.return_value = None
        with pytest.raises(RuntimeError, match="No captions available"):
            extract_transcript(
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "youtube",
                openai_api_key="",
            )
