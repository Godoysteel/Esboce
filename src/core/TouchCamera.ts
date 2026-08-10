export interface TouchPoint {
  clientX: number;
  clientY: number;
}

export interface TouchCameraAnchor {
  centerX: number;
  centerY: number;
  distance: number;
  cameraDistance: number;
}

export interface TouchCameraState {
  angle: number;
  elevation: number;
  distance: number;
}

export function touchCameraAnchor(a: TouchPoint, b: TouchPoint, cameraDistance: number): TouchCameraAnchor {
  return {
    centerX: (a.clientX + b.clientX) / 2,
    centerY: (a.clientY + b.clientY) / 2,
    distance: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)),
    cameraDistance,
  };
}

export function updateTouchCamera(
  state: TouchCameraState,
  anchor: TouchCameraAnchor,
  a: TouchPoint,
  b: TouchPoint,
  minDistance: number,
  maxDistance: number,
): { state: TouchCameraState; anchor: TouchCameraAnchor } {
  const nextAnchor = touchCameraAnchor(a, b, anchor.cameraDistance);
  const deltaX = nextAnchor.centerX - anchor.centerX;
  const deltaY = nextAnchor.centerY - anchor.centerY;

  return {
    state: {
      angle: state.angle - deltaX * 0.008,
      elevation: Math.max(0.15, Math.min(1.4, state.elevation + deltaY * 0.008)),
      distance: Math.max(
        minDistance,
        Math.min(maxDistance, anchor.cameraDistance * (anchor.distance / nextAnchor.distance)),
      ),
    },
    anchor: {
      ...nextAnchor,
      cameraDistance: Math.max(
        minDistance,
        Math.min(maxDistance, anchor.cameraDistance * (anchor.distance / nextAnchor.distance)),
      ),
    },
  };
}
