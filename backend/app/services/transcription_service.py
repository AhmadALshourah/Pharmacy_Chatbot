"""Voice transcription via OpenAI Whisper."""

import logging
from pathlib import Path

log = logging.getLogger("pharmacy")


class TranscriptionService:
    """Transcribes audio files using OpenAI Whisper API."""

    def transcribe(self, audio_path: str | Path) -> str:
        """Transcribe an audio file to text. Returns empty string on failure."""
        if not audio_path:
            return ""
        try:
            from openai import OpenAI
            client = OpenAI()
            with open(audio_path, "rb") as f:
                result = client.audio.transcriptions.create(model="whisper-1", file=f)
            log.info(f"Transcribed audio: {result.text[:80]!r}")
            return result.text
        except Exception as e:
            log.error(f"Transcription error: {e}")
            return ""
