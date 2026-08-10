import type { Floor } from './types.js';

export const ATTIC_KNEE_WALL_HEIGHT_M = 1.2;

export function floorWallHeight(floor: Floor, standardHeightM: number): number {
  if (floor.kind !== 'attic') return standardHeightM;
  const requested = floor.wallHeightM ?? ATTIC_KNEE_WALL_HEIGHT_M;
  return Math.max(0.6, Math.min(2.2, requested));
}
