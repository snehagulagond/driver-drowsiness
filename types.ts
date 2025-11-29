export enum DriverState {
  CALIBRATING = "CALIBRATING",
  NORMAL = "NORMAL",
  DROWSY = "DROWSY",
  YAWNING = "YAWNING",
  TIRED = "TIRED", // Based on frequency of yawns
  HAPPY = "HAPPY", // Detected but ignored for alarm
  NODDING = "NODDING" // Head dropping
}

export interface FaceLandmark {
  x: number;
  y: number;
  z: number;
}

export interface DetectionStats {
  ear: number;
  mar: number;
  blinkCount: number;
  yawnCount: number;
  drowsyCount: number;
  heartRate: number; // Simulated
  expression: string;
}

export interface AlertLog {
  timestamp: string;
  type: DriverState;
  details: string;
}

export const EMERGENCY_CONTACTS = [
  { name: "Mom", phone: "9876543210" },
  { name: "Dad", phone: "9123456780" },
  { name: "Brother", phone: "9988776655" }
];