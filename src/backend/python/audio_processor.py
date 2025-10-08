import sys
import json
import base64
import tempfile
import os
import whisper
from whisper import Whisper
from typing import cast

whisper_model: Whisper

def decode_base64_to_bytes(audio_base64: str) -> tuple[bytes | None, str | None]:
    try:
        return (base64.b64decode(audio_base64), None)
    except Exception as e:
        return (None, f"Failed to decode the base64 string with error: ${str(e)}")

# Placeholder for Whisper processing
def process_audio_with_whisper(audio_file_path):
    
    print(f"Processing audio file with Whisper: {audio_file_path}")
    return f"Transcript from {audio_file_path}: This is a simulated transcript."

def process_audio_data(base64_audio_data: str):
    print(f"Python received Base64 audio data (first 50 chars): {base64_audio_data[:50]}...") # New print statement
    
    # Decode Base64 audio data
    audio_bytes, error = decode_base64_to_bytes(base64_audio_data)
    if error:
        return [None, error]
    audio_bytes = cast(bytes, audio_bytes)
    assert isinstance(audio_bytes, bytes, f"Decoded audio bytes is not valid type.")

    transcript = process_audio_with_whisper(audio_bytes)


    return {"status": "success", "transcript": transcript}

if __name__ == "__main__":
    whisper_model = whisper.load_model("./ai_models/whisper/tiny.pt", device="cpu")
    for line in sys.stdin:
        print(f"Python received raw input: {line[:100]}...") # Removed file=sys.stderr
        try:
            input_data = json.loads(line)
            # Expecting input_data to be a JSON object like { "audio": "base64string" }
            base64_audio_data = input_data.get("audio")
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
