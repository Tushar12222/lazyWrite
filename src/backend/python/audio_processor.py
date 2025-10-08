import sys
import json
import base64
import tempfile
import os

# Placeholder for Whisper processing
def process_audio_with_whisper(audio_file_path):
    # In a real scenario, you would use the OpenAI Whisper API or a local model here.
    # Example:
    # import openai
    # with open(audio_file_path, "rb") as audio_file:
    #     transcript = openai.Audio.transcribe("whisper-1", audio_file)["text"]
    # return transcript
    print(f"Processing audio file with Whisper: {audio_file_path}")
    return f"Transcript from {audio_file_path}: This is a simulated transcript."

def process_audio_data(base64_audio_data):
    print(f"Python received Base64 audio data (first 50 chars): {base64_audio_data[:50]}...") # New print statement
    try:
        # Decode Base64 audio data
        audio_bytes = base64.b64decode(base64_audio_data)

        # Create a temporary file to store the audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio_file:
            temp_audio_file.write(audio_bytes)
            temp_audio_file_path = temp_audio_file.name

        # Process the audio with Whisper
        transcript = process_audio_with_whisper(temp_audio_file_path)

        # Clean up the temporary file
        os.remove(temp_audio_file_path)

        return {"status": "success", "transcript": transcript}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
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
