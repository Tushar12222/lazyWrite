import sys
import json
import base64
import os
import subprocess
import numpy as np
from typing import cast
import whisper
from whisper import Whisper, audio


# Global Whisper model
whisper_model: Whisper


# ========== Utility Logging ==========
def log(message: str):
    print(message)
    sys.stdout.flush()


# ========== FFmpeg Path Handling ==========
def get_ffmpeg_path() -> str:
    """Return correct ffmpeg path depending on bundle state."""
    if getattr(sys, 'frozen', False):
        # Inside PyInstaller bundle
        return os.path.join(sys._MEIPASS, 'bin', 'ffmpeg')
    # Dev mode
    return "ffmpeg"


# ========== Whisper Model Handling ==========
def get_whisper_model_path(model_name: str = "tiny") -> str:
    """Return correct whisper model path depending on environment."""
    if getattr(sys, 'frozen', False):
        # Inside PyInstaller bundle
        model_path = os.path.join(sys._MEIPASS, "ai_models", "whisper", f"{model_name}.pt")
    else:
        # Dev mode
        model_path = os.path.join("ai_models", "whisper", f"{model_name}.pt")
    return model_path


def load_whisper_model() -> Whisper:
    """Load the Whisper model from a local .pt file."""
    model_path = get_whisper_model_path("tiny")

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Whisper model file not found at: {model_path}")

    log(f"Loading Whisper model from: {model_path}")
    model = whisper.load_model(model_path, device="cpu")
    return model


# ========== Audio Processing ==========
def decode_base64_to_bytes(audio_base64: str) -> tuple[bytes | None, str | None]:
    try:
        return (base64.b64decode(audio_base64), None)
    except Exception as e:
        return (None, f"Failed to decode the base64 string with error: {e}")


def convert_audio_to_whisper_format(audio_base64: str, sr: int = 16000) -> tuple[np.ndarray | None, str | None]:
    """Decode base64 -> PCM float32 audio using ffmpeg."""
    ffmpeg_path = get_ffmpeg_path()
    cmd = [
        ffmpeg_path,
        "-nostdin",
        "-threads", "0",
        "-i", "pipe:0",
        "-f", "s16le",
        "-ac", "1",
        "-acodec", "pcm_s16le",
        "-ar", str(sr),
        "-"
    ]

    try:
        audio_bytes, error = decode_base64_to_bytes(audio_base64)
        if error:
            return (None, error)
        audio_bytes = cast(bytes, audio_bytes)

        process = subprocess.run(cmd, input=audio_bytes, capture_output=True, check=True)
        samples = np.frombuffer(process.stdout, np.int16).astype(np.float32) / 32768.0
        return (samples, None)

    except subprocess.CalledProcessError as e:
        return (None, f"ffmpeg failed (exit {e.returncode}): {e.stderr.decode(errors='ignore')}")
    except FileNotFoundError:
        return (None, "ffmpeg not found. Make sure it is bundled or installed.")
    except PermissionError:
        return (None, "Permission denied when running ffmpeg.")
    except Exception as e:
        return (None, f"Unexpected error while decoding audio: {e}")


# Override Whisper's audio loader
audio.load_audio = convert_audio_to_whisper_format


# ========== Whisper Processing ==========
def process_audio_with_whisper(base64_audio_data: str) -> tuple[str | None, str | None]:
    try:
        result = whisper_model.transcribe(base64_audio_data)
        return (result["text"], None)
    except Exception as e:
        return (None, f"Failed to process audio with Whisper: {e}")


def process_audio_data(base64_audio_data: str):
    transcript, error = process_audio_with_whisper(base64_audio_data)
    if error:
        raise Exception(error)
    transcript = cast(str, transcript)
    return {"status": "success", "transcript": transcript}


# ========== Main Loop ==========
if __name__ == "__main__":
    try:
        whisper_model = load_whisper_model()
    except Exception as e:
        log(f"[ERROR] Could not load Whisper model: {e}")
        sys.exit(1)

    log("Audio processor ready.")
    sys.stdout.flush()

    for line in sys.stdin:
        try:
            input_data = json.loads(line)
            base64_audio_data: str = input_data.get("audio")

            if not base64_audio_data:
                print(json.dumps({"error": "Missing 'audio' field"}), file=sys.stderr)
                sys.stderr.flush()
                continue

            result = process_audio_data(base64_audio_data)
            print(json.dumps(result))
            sys.stdout.flush()

        except json.JSONDecodeError:
            print(json.dumps({"error": "Invalid JSON input"}), file=sys.stderr)
            sys.stderr.flush()
        except Exception as e:
            print(json.dumps({"error": str(e)}), file=sys.stderr)
            sys.stderr.flush()
