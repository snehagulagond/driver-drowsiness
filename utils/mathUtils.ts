import { FaceLandmark } from '../types';

// Euclidean distance between two 3D points
const euclideanDistance = (p1: FaceLandmark, p2: FaceLandmark): number => {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) + 
    Math.pow(p1.y - p2.y, 2) + 
    Math.pow(p1.z - p2.z, 2)
  );
};

// Eye Aspect Ratio
// Indices correspond to MediaPipe FaceMesh
// P1, P2, P3, P4, P5, P6
export const calculateEAR = (landmarks: FaceLandmark[], indices: number[]): number => {
  if (indices.length !== 6) return 0;
  
  // Vertical distances
  const A = euclideanDistance(landmarks[indices[1]], landmarks[indices[5]]);
  const B = euclideanDistance(landmarks[indices[2]], landmarks[indices[4]]);
  
  // Horizontal distance
  const C = euclideanDistance(landmarks[indices[0]], landmarks[indices[3]]);
  
  if (C === 0) return 0;
  return (A + B) / (2.0 * C);
};

// Mouth Aspect Ratio
// Indices: top, bottom, left, right
export const calculateMAR = (landmarks: FaceLandmark[], indices: number[]): number => {
  if (indices.length !== 4) return 0;

  const vertical = euclideanDistance(landmarks[indices[0]], landmarks[indices[1]]);
  const horizontal = euclideanDistance(landmarks[indices[2]], landmarks[indices[3]]);

  if (horizontal === 0) return 0;
  return vertical / horizontal;
};

// Landmark Indices map
export const LANDMARK_INDICES = {
  LEFT_EYE: [33, 160, 158, 133, 153, 144],
  RIGHT_EYE: [263, 387, 385, 362, 380, 373],
  // Top (13), Bottom (14), Left (78), Right (308)
  MOUTH: [13, 14, 78, 308] 
};