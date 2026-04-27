"""Unit tests for the LLM processor with mocked API calls."""

from unittest.mock import MagicMock, patch

import pytest

from app.services.processor import chunk_transcript, process_transcript


class TestChunkTranscript:
    def test_short_text_single_chunk(self):
        text = "Short text" * 10
        chunks = chunk_transcript(text)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_long_text_multiple_chunks(self):
        # MAX_CHUNK_TOKENS=3000, CHARS_PER_TOKEN=4 => 12000 chars per chunk
        text = "A" * 30000
        chunks = chunk_transcript(text)
        assert len(chunks) > 1

    def test_chunks_have_overlap(self):
        # OVERLAP_TOKENS=200, CHARS_PER_TOKEN=4 => 800 chars overlap
        text = "A" * 30000
        chunks = chunk_transcript(text)
        # Check that second chunk starts before first chunk ends
        assert len(chunks) >= 2
        # With overlap of 800 chars, chunks should overlap
        first_end = 12000
        second_start = 12000 - 800
        assert chunks[1][:800] == text[second_start : second_start + 800]


class TestProcessTranscript:
    @patch("app.services.processor._call_claude")
    def test_single_chunk_processing(self, mock_claude):
        mock_claude.return_value = "## Phase 1\n- Do the thing"
        result = process_transcript(
            transcript="Short transcript about building things",
            output_format="bullets",
            anthropic_api_key="sk-ant-test",
        )
        assert result == "## Phase 1\n- Do the thing"
        mock_claude.assert_called_once()

    @patch("app.services.processor._call_claude")
    def test_multi_chunk_merges(self, mock_claude):
        # 30000 chars / 12000 per chunk with 800 overlap = 3 chunks + 1 merge
        mock_claude.side_effect = [
            "## Phase 1\n- Step one",
            "## Phase 2\n- Step two",
            "## Phase 3\n- Step three",
            "## Phase 1\n- Step one\n\n## Phase 2\n- Step two\n\n## Phase 3\n- Step three",
        ]
        long_text = "A" * 30000  # Forces multiple chunks
        result = process_transcript(
            transcript=long_text,
            output_format="sop",
            anthropic_api_key="sk-ant-test",
        )
        assert "Phase 1" in result
        # 3 chunk calls + 1 merge call
        assert mock_claude.call_count == 4

    def test_invalid_format_raises(self):
        with pytest.raises(ValueError, match="Unknown output format"):
            process_transcript(
                transcript="test",
                output_format="invalid",
                anthropic_api_key="sk-ant-test",
            )

    @patch("app.services.processor._call_claude")
    def test_all_formats_work(self, mock_claude):
        mock_claude.return_value = "## Output"
        for fmt in ("bullets", "sop", "study", "concepts"):
            result = process_transcript(
                transcript="Test transcript",
                output_format=fmt,
                anthropic_api_key="sk-ant-test",
            )
            assert result == "## Output"
