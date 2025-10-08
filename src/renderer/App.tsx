import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

interface PythonAudioResponse {
  status: string;
  original_data: any; // Adjust type if known
  simulated_amplitude: number;
  error?: string;
}

function Hello() {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [toggleRecordingTrigger, setToggleRecordingTrigger] = useState(false); // New state for triggering

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

  const [isSpeakingFromPython, setIsSpeakingFromPython] = useState(false);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMediaStream(stream);
      setIsRecording(true);

      // Setup AudioContext for visualization
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048; // More data points for smoother waveform
      analyserRef.current.smoothingTimeConstant = 0.8; // Make waveform smoother
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;
      source.connect(analyserRef.current);

      dataArrayRef.current = new Uint8Array(analyserRef.current.fftSize);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please check permissions.');
      setIsRecording(false);
    }
  }, []); // Empty dependency array for startRecording

  const stopRecording = useCallback(() => {
    if (mediaStreamRef.current) {
      // Use ref to get latest mediaStream value
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
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

  // Effect to send audio data to Python backend
  // eslint-disable-next-line consistent-return
  useEffect(() => {
    if (!isRecording) {
      return () => {}; // Always return a cleanup function, even if empty
    }

    const interval = setInterval(() => {
      if (dataArrayRef.current) {
        // Convert Uint8Array to a regular array for IPC
        const audioDataArray = Array.from(dataArrayRef.current);
        window.electron.ipcRenderer.sendMessage(
          'send-audio-to-python',
          audioDataArray,
        );
      }
    }, 100); // Send data every 100ms (adjust as needed)

    return () => clearInterval(interval);
  }, [isRecording]);

  // Effect to listen for responses from Python backend
  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on(
      'python-audio-response',
      // eslint-disable-next-line consistent-return
      (response: string) => {
        try {
          const parsedResponse: PythonAudioResponse = JSON.parse(response);
          if (parsedResponse.simulated_amplitude !== undefined) {
            // Define a threshold for Python's simulated amplitude
            const pythonSpeechThreshold = 50; // Adjust this value based on Python's output
            setIsSpeakingFromPython(
              parsedResponse.simulated_amplitude > pythonSpeechThreshold,
            );
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

  return (
    <div className="empty-ui-container">
      <div className="static-line top" />
      <div className="static-line right" />
      <div className="static-line bottom" />
      <div className="static-line left" />

      <div
        className={`microphone-control ${isRecording ? 'is-recording-active' : ''}`}
      >
        <p className="app-title">{isRecording ? 'Stop Recording' : 'F5'}</p>
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
            <p className="recording-status">Recording audio...</p>
            <canvas ref={canvasRef} width="300" height="100" />
          </div>
        )}
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
