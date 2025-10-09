import sys
import json
import base64
import tempfile
import os
import whisper
from whisper import Whisper, audio
from typing import cast, Optional
import subprocess
import numpy as np

whisper_model: Whisper

def log(message: str):
    print(message)
    sys.stdout.flush()

def decode_base64_to_bytes(audio_base64: str) -> tuple[bytes | None, str | None]:
    try:
        return (base64.b64decode(audio_base64), None)
    except Exception as e:
        return (None, f"Failed to decode the base64 string with error: ${str(e)}")

def convert_audio_to_whisper_format(audio_base64: str, sr: int = 16000) -> tuple[bytes | None, str | None]:
    cmd = [
        "ffmpeg",
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

        audio_bytes = subprocess.run(cmd, input=audio_bytes, capture_output=True, check=True).stdout
        return np.frombuffer(audio_bytes, np.int16).flatten().astype(np.float32) / 32768.0
    except FileNotFoundError:
        return (None, "ffmpeg not found. Make sure it is installed and available in PATH.")

    except Exception as e:
        return (None, f"Unexpected error while decoding audio: {e}")


def process_audio_with_whisper(base64_audio_data: str) -> tuple[str | None, str | None]:
    try:
        result = whisper_model.transcribe(base64_audio_data)
        return (result["text"], None)
    except Exception as e:
        return (None, f"Failed to process audio with whisper with error: {str(e)}")

def process_audio_data(base64_audio_data: str):
    transcript, error = process_audio_with_whisper(base64_audio_data)
    if error:
        raise Exception(error)
    transcript = cast(str, transcript)
    assert isinstance(transcript, str)

    return {"status": "success", "transcript": transcript}

if __name__ == "__main__":
    audio.load_audio = convert_audio_to_whisper_format
    os.environ["XDG_CACHE_HOME"] = "./src/backend/python/ai_models"
    whisper_model = whisper.load_model("tiny", device="cpu")
    sys.stdout.flush()
    for line in sys.stdin:
        try:
            input_data = json.loads(line)
            # Expecting input_data to be a JSON object like { "audio": "base64string" }
            base64_audio_data: str = input_data.get("audio")
            if base64_audio_data:
                result = process_audio_data(base64_audio_data)
                print(json.dumps(result))
                sys.stdout.flush()
            else:
                print(json.dumps({"error": "Missing 'audio' data in JSON input"}), file=sys.stderr)
                sys.stderr.flush()
        except json.JSONDecodeError:
            print(json.dumps({"error": "Invalid JSON input"}), file=sys.stderr)
            sys.stderr.flush()
        except Exception as e:
            print(json.dumps({"error": str(e)}), file=sys.stderr)
            sys.stderr.flush()
