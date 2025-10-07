import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

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
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMediaStream(stream);
      setIsRecording(true);

      // Setup AudioContext for visualization
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
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
    if (mediaStreamRef.current) { // Use ref to get latest mediaStream value
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

      analyserRef.current.getByteTimeDomainData(dataArrayRef.current); // Get waveform data

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = 'rgba(220, 220, 220, 0.9)'; // Brighter silver line

      canvasCtx.beginPath();

      const sliceWidth = canvas.width * 1.0 / dataArrayRef.current.length;
      let x = 0;

      for (let i = 0; i < dataArrayRef.current.length; i++) {
        const v = dataArrayRef.current[i] / 128.0; // Normalize to 0-2
        const y = v * canvas.height / 2; // Scale to canvas height

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

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
  }, [isRecording]); // Re-run this effect when isRecording changes

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
    setToggleRecordingTrigger(prev => !prev);
  }, []);

  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on('toggle-recording', toggleRecordingListener);

    return () => {
      cleanup(); // Call the cleanup function returned by preload.ts
    };
  }, [toggleRecordingListener]); // Dependency on the stable toggleRecordingListener

  return (
    <div className="empty-ui-container">
      <div className="static-line top"></div>
      <div className="static-line right"></div>
      <div className="static-line bottom"></div>
      <div className="static-line left"></div>

      <div className={`microphone-control ${isRecording ? 'is-recording-active' : ''}`}>
        <p className="app-title">{isRecording ? 'Stop Recording' : 'F5'}</p>
        {error && <p className="error-message">{error}</p>}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`record-button ${isRecording ? 'is-recording-active' : ''}`}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {isRecording ? (
            <span className="red-dot-icon"></span> // Red dot icon
          ) : (
            <span className="start-icon-white-dot"></span> // Start icon (white dot)
          )}
          {showTooltip && (
            <div className="button-tooltip">
              {isRecording ? 'Stop Recording' : 'Start Recording'}<br />(F5)
            </div>
          )}
        </button>
        {isRecording && (
          <div className="audio-visualizer-container">
            <p className="recording-status">Recording audio...</p>
            <canvas ref={canvasRef} width="300" height="100"></canvas>
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
