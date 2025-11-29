import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { calculateEAR, calculateMAR, LANDMARK_INDICES } from '../utils/mathUtils';
import { DriverState, DetectionStats, AlertLog } from '../types';
import { audioService } from '../services/audioService';

interface Props {
  onStatsUpdate: (stats: DetectionStats) => void;
  onLogEntry: (log: AlertLog) => void;
  active: boolean;
}

// Minimal type definition for FaceMesh Results
interface Results {
  multiFaceLandmarks: { x: number; y: number; z: number }[][];
  image: any;
}

const WebcamProcessor: React.FC<Props> = ({ onStatsUpdate, onLogEntry, active }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceMeshRef = useRef<any>(null);
  
  // Logic State Refs
  const stateRef = useRef<DriverState>(DriverState.CALIBRATING);
  const calibrationFramesRef = useRef(40);
  
  // Thresholds & Baselines
  const baselineEARRef = useRef<number | null>(null);
  const baselineNoseYRef = useRef<number | null>(null); // For nodding
  const earThreshRef = useRef(0.22);
  const NODDING_THRESH = 0.05; // Drop in Y coordinate (image space 0-1)
  
  const drowsyFramesRef = useRef(0);
  const yawnEventTimeRef = useRef<number[]>([]); // Track yawn timestamps for "Tired" detection
  
  const earHistoryRef = useRef<number[]>([]);
  const marHistoryRef = useRef<number[]>([]);
  const noseYHistoryRef = useRef<number[]>([]);

  const statsRef = useRef<DetectionStats>({
    ear: 0,
    mar: 0,
    blinkCount: 0,
    yawnCount: 0,
    drowsyCount: 0,
    heartRate: 78,
    expression: 'Neutral'
  });

  // UI State
  const [uiState, setUiState] = useState<DriverState>(DriverState.CALIBRATING);
  const [uiCalibrationFrames, setUiCalibrationFrames] = useState(40);

  const propsRef = useRef({ onStatsUpdate, onLogEntry });
  useEffect(() => {
    propsRef.current = { onStatsUpdate, onLogEntry };
  }, [onStatsUpdate, onLogEntry]);

  const MAR_THRESH = 0.55;
  const DROWSY_FRAMES_THRESH = 15; // Faster detection for demo

  const drawFace = (landmarks: any) => {
    const video = webcamRef.current?.video;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Eyes
    ctx.fillStyle = '#00ff9d';
    [...LANDMARK_INDICES.LEFT_EYE, ...LANDMARK_INDICES.RIGHT_EYE].forEach(idx => {
       const lm = landmarks[idx];
       ctx.beginPath();
       ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 2, 0, 2 * Math.PI);
       ctx.fill();
    });

    // Draw Mouth
    const currentState = stateRef.current;
    ctx.fillStyle = currentState === DriverState.YAWNING ? '#ffcc00' : '#00ccff';
    LANDMARK_INDICES.MOUTH.forEach(idx => {
      const lm = landmarks[idx];
       ctx.beginPath();
       ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 3, 0, 2 * Math.PI);
       ctx.fill();
    });

    // Draw Nose Tip (for visual feedback of nodding)
    const nose = landmarks[1];
    ctx.fillStyle = currentState === DriverState.NODDING ? '#ff0055' : '#ffffff';
    ctx.beginPath();
    ctx.arc(nose.x * canvas.width, nose.y * canvas.height, 4, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw Baseline Nose Line if calibrated
    if (baselineNoseYRef.current) {
        const y = (baselineNoseYRef.current + NODDING_THRESH) * canvas.height;
        ctx.strokeStyle = 'rgba(255, 0, 85, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
  };

  const processResults = (results: Results) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;

    const landmarks = results.multiFaceLandmarks[0];
    
    // 1. Calculate Metrics
    const leftEAR = calculateEAR(landmarks as any, LANDMARK_INDICES.LEFT_EYE);
    const rightEAR = calculateEAR(landmarks as any, LANDMARK_INDICES.RIGHT_EYE);
    const avgEAR = (leftEAR + rightEAR) / 2;
    const mar = calculateMAR(landmarks as any, LANDMARK_INDICES.MOUTH);
    const noseY = landmarks[1].y; // Nose tip

    statsRef.current.ear = avgEAR;
    statsRef.current.mar = mar;

    // 2. Expression Classification
    let currentExpression = "Neutral";
    if (mar > 0.5) currentExpression = "Happy/Talking";
    if (mar > MAR_THRESH + 0.2) currentExpression = "Surprised/Yawning";
    statsRef.current.expression = currentExpression;

    // 3. Calibration Phase
    if (calibrationFramesRef.current > 0) {
      if (avgEAR > 0.15) { 
        earHistoryRef.current.push(avgEAR);
        noseYHistoryRef.current.push(noseY);
      }
      calibrationFramesRef.current -= 1;
      setUiCalibrationFrames(calibrationFramesRef.current);
      
      if (calibrationFramesRef.current <= 0) {
        // EAR Calibration
        const sumEar = earHistoryRef.current.reduce((a, b) => a + b, 0);
        const avgHistEar = sumEar / (earHistoryRef.current.length || 1);
        baselineEARRef.current = avgHistEar;
        earThreshRef.current = avgHistEar * 0.75; // 75% of baseline
        
        // Nose Calibration
        const sumNose = noseYHistoryRef.current.reduce((a, b) => a + b, 0);
        baselineNoseYRef.current = sumNose / (noseYHistoryRef.current.length || 1);

        stateRef.current = DriverState.NORMAL;
        setUiState(DriverState.NORMAL);
        propsRef.current.onLogEntry({ timestamp: new Date().toLocaleTimeString(), type: DriverState.NORMAL, details: "Calibration Complete" });
      }
      drawFace(landmarks);
      return; 
    }

    // 4. Detection Logic
    let newState = DriverState.NORMAL;
    
    // Smiling Heuristic: Wide mouth (high MAR) but typically corners move up (simple approximation: MAR > X and EAR < Y is usually laughing/smiling with eyes closing)
    // However, for safety, we allow "Happy" to override Drowsy only if MAR is significant.
    const isSmiling = mar > 0.40; 

    // Check Nodding (Priority 1: Physical Collapse)
    // If nose drops significantly below baseline (Y value increases)
    if (baselineNoseYRef.current && (noseY - baselineNoseYRef.current > NODDING_THRESH)) {
       newState = DriverState.NODDING;
       drowsyFramesRef.current += 1; // Increment just so we track it
    }
    // Check Drowsiness (Priority 2: Eyes Closed)
    else if (avgEAR < earThreshRef.current) {
      if (!isSmiling) {
        drowsyFramesRef.current += 1;
        if (drowsyFramesRef.current >= DROWSY_FRAMES_THRESH) {
          newState = DriverState.DROWSY;
        }
      } else {
         newState = DriverState.HAPPY;
         drowsyFramesRef.current = 0;
      }
    } 
    // Check Yawning (Priority 3: Mouth Open)
    else if (mar > MAR_THRESH) {
      newState = DriverState.YAWNING;
      // If we just entered Yawning state from something else, log it
      if (stateRef.current !== DriverState.YAWNING) {
         // Track Yawn for Tiredness
         const now = Date.now();
         yawnEventTimeRef.current.push(now);
         // Filter yawns older than 2 minutes
         yawnEventTimeRef.current = yawnEventTimeRef.current.filter(t => now - t < 120000);
      }
      drowsyFramesRef.current = 0; 
    }
    // Normal
    else {
      drowsyFramesRef.current = 0;
    }
    
    // Check for accumulated Tiredness (e.g., frequent yawning)
    if (newState === DriverState.NORMAL && yawnEventTimeRef.current.length >= 3) {
        newState = DriverState.TIRED;
    }

    // 5. Action Handler (Alarm Logic)
    if (stateRef.current !== newState) {
        stateRef.current = newState;
        setUiState(newState);

        if (newState === DriverState.DROWSY) {
            statsRef.current.drowsyCount += 1;
            propsRef.current.onLogEntry({ timestamp: new Date().toLocaleTimeString(), type: DriverState.DROWSY, details: `Eyes Closed (${(avgEAR).toFixed(2)})` });
        } else if (newState === DriverState.NODDING) {
            statsRef.current.drowsyCount += 1; 
            propsRef.current.onLogEntry({ timestamp: new Date().toLocaleTimeString(), type: DriverState.NODDING, details: `Head Nod Detected` });
        } else if (newState === DriverState.YAWNING) {
            statsRef.current.yawnCount += 1;
            propsRef.current.onLogEntry({ timestamp: new Date().toLocaleTimeString(), type: DriverState.YAWNING, details: `Yawn Detected` });
        } else if (newState === DriverState.TIRED) {
             propsRef.current.onLogEntry({ timestamp: new Date().toLocaleTimeString(), type: DriverState.TIRED, details: `Frequent Yawning (${yawnEventTimeRef.current.length} in 2m)` });
        }
    }

    // Continuous Alarm Management
    if (newState === DriverState.DROWSY || newState === DriverState.NODDING) {
        audioService.startAlarm(newState); // Will loop until stopped
    } else if (newState === DriverState.YAWNING) {
        audioService.startAlarm(newState);
    } else if (newState === DriverState.TIRED) {
        audioService.startAlarm(newState); // Caution alarm
    } else {
        // If Happy or Normal, ensure alarm is stopped
        audioService.stop();
    }

    // Update histories
    marHistoryRef.current = [...marHistoryRef.current.slice(-10), mar];

    // Simulated Heart Rate
    if (Math.random() > 0.95) {
      const change = Math.floor(Math.random() * 3) - 1;
      statsRef.current.heartRate = Math.min(100, Math.max(60, statsRef.current.heartRate + change));
    }

    propsRef.current.onStatsUpdate({ ...statsRef.current });
    drawFace(landmarks);
  };

  // Initialize FaceMesh
  useEffect(() => {
    const FaceMesh = (window as any).FaceMesh;
    if (!FaceMesh) return;

    const faceMesh = new FaceMesh({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults(processResults);
    faceMeshRef.current = faceMesh;

    return () => {
      audioService.stop(); // Ensure audio stops on unmount
      faceMesh.close();
    };
  }, []);

  // Animation Loop
  const requestRef = useRef<number>(0);
  
  const detect = useCallback(async () => {
    if (
        active &&
        webcamRef.current &&
        webcamRef.current.video &&
        webcamRef.current.video.readyState === 4 &&
        faceMeshRef.current
    ) {
        try {
            await faceMeshRef.current.send({ image: webcamRef.current.video });
        } catch (e) {
            // ignore dropped frames
        }
    }
    requestRef.current = requestAnimationFrame(detect);
  }, [active]);

  useEffect(() => {
    if (active) {
        requestRef.current = requestAnimationFrame(detect);
    } else {
        cancelAnimationFrame(requestRef.current);
        audioService.stop(); // Stop audio if monitoring stops
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [active, detect]);

  return (
    <div className="relative rounded-3xl overflow-hidden border-2 border-slate-800 bg-black shadow-2xl shadow-hud-green/10">
      <Webcam
        ref={webcamRef}
        audio={false}
        className="w-full object-cover transform scale-x-[-1]" 
        width={640}
        height={480}
        screenshotFormat="image/jpeg"
        videoConstraints={{
            width: 640,
            height: 480,
            facingMode: "user"
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
      />
      
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10">
        <div className="flex items-center gap-2">
           <div className={`w-3 h-3 rounded-full animate-pulse ${
             uiState === DriverState.NORMAL ? 'bg-hud-green' : 
             (uiState === DriverState.DROWSY || uiState === DriverState.NODDING) ? 'bg-hud-red' : 
             uiState === DriverState.YAWNING ? 'bg-hud-yellow' : 
             uiState === DriverState.HAPPY ? 'bg-pink-500' : 'bg-white'
           }`} />
           <span className={`font-mono font-bold text-lg tracking-wider ${
             (uiState === DriverState.DROWSY || uiState === DriverState.NODDING) ? 'text-hud-red animate-pulse' : 'text-white'
           }`}>
             {uiState === DriverState.CALIBRATING ? `CALIBRATING ${uiCalibrationFrames}` : uiState}
           </span>
        </div>
      </div>
    </div>
  );
};

export default WebcamProcessor;