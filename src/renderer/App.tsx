import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import './App.css';

interface PythonAudioResponse {
  status: string;
  transcript?: string; // New field for the transcript
  message?: string; // For error messages
  error?: string; // Keep for general errors
}

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  );
}

const TranscriptCard = React.forwardRef(
  ({ text, onSave }: { text: string; onSave: (newText: string) => void }, ref) => {
    const [copied, setCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(text);

    const handleCopy = () => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const handleSave = () => {
      onSave(editedText);
      setIsEditing(false);
    };

    const handleCancel = () => {
      setEditedText(text);
      setIsEditing(false);
    };

    return (
      <div className="transcript-card" ref={ref} onClick={() => setIsEditing(true)}>
        {isEditing ? (
          <div className="edit-mode-container">
            <textarea
              className="edit-textarea"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
            />
            <div className="edit-buttons">
              <button onClick={(e) => { e.stopPropagation(); handleSave(); }} className="save-button">Save</button>
              <button onClick={(e) => { e.stopPropagation(); handleCancel(); }} className="cancel-button">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <p>{text}</p>
            <button onClick={handleCopy} className="copy-button">
              {copied ? 'Copied!' : <CopyIcon />}
            </button>
          </>
        )}
      </div>
    );
  },
);

function Hello() {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [toggleRecordingTrigger, setToggleRecordingTrigger] = useState(false); // New state for triggering
  const [transcript, setTranscript] = useState<string[]>([]);

  const isRecordingRef = useRef(isRecording); // Ref to hold the latest isRecording state
  useEffect(() => {
    isRecordingRef.current = isRecording; // Keep ref updated with latest state
  }, [isRecording]);

  const mediaStreamRef = useRef<MediaStream | null>(null); // Ref to hold the latest mediaStream
  useEffect(() => {
    mediaStreamRef.current = mediaStream;
  }, [mediaStream]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef: React.RefObject<Uint8Array | null> = useRef(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [isSpeakingFromPython, setIsSpeakingFromPython] = useState(false);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMediaStream(stream);
      setIsRecording(true);

      // Setup AudioContext for visualization (existing code)
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;
      source.connect(analyserRef.current);

      dataArrayRef.current = new Uint8Array(analyserRef.current.fftSize);

      // --- New MediaRecorder setup ---
      audioChunksRef.current = []; // Clear previous chunks
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm; codecs=opus' }); // High quality, good compression
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Convert Blob to Base64 string
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result;
          if (base64data) {
            const base64Audio = (base64data as string).split(',')[1];
            console.log('Sending audio to Python:', { audio: base64Audio.substring(0, 50) + '...' }); // Log first 50 chars
            window.electron.ipcRenderer.sendMessage(
              'send-audio-to-python',
              { audio: base64Audio }, // Wrap in a JSON object
            );
          }
        };
        audioChunksRef.current = []; // Clear chunks after sending
      };

      mediaRecorder.start(); // Start recording
      // --- End new MediaRecorder setup ---

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please check permissions.');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaStreamRef.current) {
      // Use ref to get latest mediaStream value
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop(); // Stop the MediaRecorder
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    setIsRecording(false);
    setIsSpeakingFromPython(false); // Reset speaking state when recording stops
  }, []); // Empty dependency array for stopRecording

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]); // Dependency on stopRecording

  // Effect to setup and tear down canvas drawing when recording state changes
  useEffect(() => {
    if (!isRecording) {
      // Stop drawing if not recording
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      return;
    }

    // Start drawing if recording
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas element not found in useEffect!');
      return;
    }
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) {
      console.error('Canvas context not found in useEffect!');
      return;
    }

    const draw = () => {
      if (!analyserRef.current || !dataArrayRef.current || !canvasCtx) {
        return;
      }

      animationFrameIdRef.current = requestAnimationFrame(draw);

      analyserRef.current.getByteTimeDomainData(dataArrayRef.current as Uint8Array); // Get waveform data

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      // Use isSpeakingFromPython for conditional styling
      if (isSpeakingFromPython) {
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgba(220, 220, 220, 1)'; // Silver line when speaking
        canvasCtx.shadowBlur = 10; // Noticeable glow effect
        canvasCtx.shadowColor = 'rgba(220, 220, 220, 0.8)'; // Silver glow color
      } else {
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgba(128, 128, 128, 0.9)'; // Grey line when not speaking
        canvasCtx.shadowBlur = 0; // No glow
        canvasCtx.shadowColor = 'transparent';
      }

      canvasCtx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / dataArrayRef.current.length;
      let x = 0;

      for (let i = 0; i < dataArrayRef.current.length; i++) {
        const v = dataArrayRef.current[i] / 128.0; // Normalize to 0-2
        const y = (v * canvas.height) / 2; // Scale to canvas height

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        // eslint-disable-next-line no-plusplus
        // eslint-disable-next-line no-plusplus
        x += sliceWidth;
      }
      canvasCtx.stroke();
    };
    animationFrameIdRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [isRecording, isSpeakingFromPython]); // Re-run this effect when isRecording or isSpeakingFromPython changes



  // Effect to listen for responses from Python backend
  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on(
      'python-audio-response',
      // eslint-disable-next-line consistent-return
      (response: Uint8Array) => {
        try {
          console.log(response) 
          const decoder = new TextDecoder("utf-8");
          const decodedString = decoder.decode(response);
          const parsedResponse: PythonAudioResponse = JSON.parse(decodedString);
          if (parsedResponse.status === 'success' && parsedResponse.transcript) {
            console.log('Transcript from Python:', parsedResponse.transcript);
            setTranscript((prevTranscripts) => {
              if (prevTranscripts[prevTranscripts.length - 1] !== parsedResponse.transcript) {
                return [...prevTranscripts, parsedResponse.transcript || ''];
              }
              return prevTranscripts;
            });
          } else if (parsedResponse.status === 'error') {
            console.error('Error from Python:', parsedResponse.message || parsedResponse.error);
          }
        } catch (parseError) {
          console.error('Error parsing Python response:', parseError);
        }
      },
    );

    return () => {
      cleanup();
    };
  }, []); // Empty dependency array, runs once on mount

  // Effect to trigger recording based on toggleRecordingTrigger
  useEffect(() => {
    if (toggleRecordingTrigger) {
      if (isRecordingRef.current) {
        stopRecording();
      } else {
        startRecording();
      }
      setToggleRecordingTrigger(false); // Reset the trigger after acting on it
    }
  }, [toggleRecordingTrigger, startRecording, stopRecording]);

  // Handle global shortcut for recording
  const toggleRecordingListener = useCallback(() => {
    setToggleRecordingTrigger((prev) => !prev);
  }, []);

  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on(
      'toggle-recording',
      toggleRecordingListener,
    );

    return () => {
      cleanup(); // Call the cleanup function returned by preload.ts
    };
  }, [toggleRecordingListener]); // Dependency on the stable toggleRecordingListener

  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  const handleSaveTranscript = useCallback((index: number, newText: string) => {
    setTranscript((prevTranscripts) => {
      const newTranscripts = [...prevTranscripts];
      newTranscripts[index] = newText;
      return newTranscripts;
    });
  }, []);

  useEffect(() => {
    if (transcriptContainerRef.current) {
      // Delay scrolling slightly to allow DOM to update after animation
      setTimeout(() => {
        if (transcriptContainerRef.current) {
          transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
        }
      }, 100); // A small delay, adjust as needed
    }
  }, [transcript]);

  useEffect(() => {
    const handleGlobalScroll = (event: WheelEvent) => {
      if (transcriptContainerRef.current) {
        event.preventDefault(); // Prevent default window scrolling
        transcriptContainerRef.current.scrollTop += event.deltaY;
      }
    };

    window.addEventListener('wheel', handleGlobalScroll, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleGlobalScroll);
    };
  }, []); // Empty dependency array to run once on mount and cleanup on unmount

  return (
    <div className="empty-ui-container">
      <div className="static-line top" />
      <div className="static-line right" />
      <div className="static-line bottom" />
      <div className="static-line left" />

      <div
        className={`microphone-control ${isRecording ? 'is-recording-active' : ''}`}
      >
        
        {error && <p className="error-message">{error}</p>}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`record-button ${isRecording ? 'is-recording-active' : ''}`}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {isRecording ? (
            <span className="red-dot-icon" /> // Red dot icon
          ) : (
            <span className="start-icon-white-dot" /> // Start icon (white dot)
          )}
          {showTooltip && (
            <div className="button-tooltip">
              {isRecording ? 'Stop Recording' : 'Start Recording'}
              <br />
              (F5)
            </div>
          )}
        </button>
        {isRecording && (
          <div className="audio-visualizer-container">
            <canvas ref={canvasRef} width="300" height="100" />
          </div>
        )}
      </div>
      <div className="transcript-container" ref={transcriptContainerRef}>
        {transcript.map((item, index) => (
          <TranscriptCard key={index} text={item} onSave={(newText) => handleSaveTranscript(index, newText)} />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
