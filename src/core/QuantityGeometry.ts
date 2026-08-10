import type { FoundationType, Roof } from './types.js';

export interface RoofQuantityConfig {
  grid: number;
  roofOverhang: number;
  rakeOverhang: number;
}

export interface FoundationQuantityConfig {
  baldrameWidth: number;
  baldrameThickness: number;
  radierMargin: number;
  radierThickness: number;
  steelRateKgM3: number;
}

export interface FoundationBaldrameQuantity {
  type: 'baldrame';
  length: number;
  concreteVolume: number;
  steelKg: number;
}

export interface FoundationRadierQuantity {
  type: 'radier';
  areaM2: number;
  concreteVolume: number;
  steelKg: number;
}

export type FoundationQuantity = FoundationBaldrameQuantity | FoundationRadierQuantity | null;

export function roofAreaMeters(roof: Roof, config: RoofQuantityConfig): number {
  const widthM = Math.abs(roof.x2 - roof.x1) / config.grid;
  const depthM = Math.abs(roof.y2 - roof.y1) / config.grid;
  if (roof.type === 'platibanda') return widthM * depthM;

  const pitchRad = (roof.pitchDeg || 0) * Math.PI / 180;
  const ridgeAlongX = roof.ridgeAxis === 'x';
  let extWidth: number, extDepth: number;
  if (roof.type === 'quatroAguas') {
    extWidth = widthM + 2 * config.roofOverhang;
    extDepth = depthM + 2 * config.roofOverhang;
  } else if (ridgeAlongX) {
    extWidth = widthM + 2 * config.rakeOverhang;
    extDepth = depthM + 2 * config.roofOverhang;
  } else {
    extWidth = widthM + 2 * config.roofOverhang;
    extDepth = depthM + 2 * config.rakeOverhang;
  }
  return (extWidth * extDepth) / Math.cos(pitchRad);
}

function roofExtendedFootprintMeters(roof: Roof, config: RoofQuantityConfig) {
  const ridgeAlongX = roof.ridgeAxis === 'x';
  const marginX = roof.type === 'quatroAguas' ? config.roofOverhang : (ridgeAlongX ? config.rakeOverhang : config.roofOverhang);
  const marginY = roof.type === 'quatroAguas' ? config.roofOverhang : (ridgeAlongX ? config.roofOverhang : config.rakeOverhang);
  return {
    minX: Math.min(roof.x1, roof.x2) / config.grid - marginX,
    maxX: Math.max(roof.x1, roof.x2) / config.grid + marginX,
    minY: Math.min(roof.y1, roof.y2) / config.grid - marginY,
    maxY: Math.max(roof.y1, roof.y2) / config.grid + marginY,
  };
}

function roofBodyFootprintMeters(roof: Roof, config: RoofQuantityConfig) {
  return {
    minX: Math.min(roof.x1, roof.x2) / config.grid,
    maxX: Math.max(roof.x1, roof.x2) / config.grid,
    minY: Math.min(roof.y1, roof.y2) / config.grid,
    maxY: Math.max(roof.y1, roof.y2) / config.grid,
  };
}

export function roofNetAreas(roofs: Roof[], config: RoofQuantityConfig): Record<string, number> {
  const result: Record<string, number> = {};
  roofs.forEach((roof) => { result[roof.id] = roofAreaMeters(roof, config); });
  for (let i = 0; i < roofs.length; i++) for (let j = i + 1; j < roofs.length; j++) {
    const a = roofs[i]!, b = roofs[j]!;
    if (!a.compoundGroupId || a.compoundGroupId !== b.compoundGroupId || a.ridgeAxis === b.ridgeAxis) continue;
    const ra = roofExtendedFootprintMeters(a, config), rb = roofExtendedFootprintMeters(b, config);
    const areaA = (ra.maxX - ra.minX) * (ra.maxY - ra.minY);
    const areaB = (rb.maxX - rb.minX) * (rb.maxY - rb.minY);
    const secondary = areaA < areaB || (Math.abs(areaA - areaB) <= 1e-9 && a.id > b.id) ? a : b;
    const primary = secondary === a ? b : a;
    const secondaryFootprint = secondary === a ? ra : rb;
    const primaryBody = roofBodyFootprintMeters(primary, config);
    const overlap = Math.max(0, Math.min(secondaryFootprint.maxX, primaryBody.maxX) - Math.max(secondaryFootprint.minX, primaryBody.minX)) *
      Math.max(0, Math.min(secondaryFootprint.maxY, primaryBody.maxY) - Math.max(secondaryFootprint.minY, primaryBody.minY));
    if (overlap <= 1e-9) continue;
    const slopeFactor = secondary.type === 'platibanda' ? 1 : 1 / Math.cos((secondary.pitchDeg || 0) * Math.PI / 180);
    result[secondary.id] = Math.max(0, result[secondary.id]! - overlap * slopeFactor);
  }
  return result;
}

export function gableAreaMeters(roof: Roof, config: RoofQuantityConfig): number {
  if (roof.type !== 'duasAguas') return 0;
  const widthM = (roof.ridgeAxis === 'x' ? Math.abs(roof.y2 - roof.y1) : Math.abs(roof.x2 - roof.x1)) / config.grid;
  const pitchRad = (roof.pitchDeg || 0) * Math.PI / 180;
  const baseRise = config.roofOverhang * Math.tan(pitchRad);
  const triangleRise = widthM / 2 * Math.tan(pitchRad);
  return widthM * baseRise + widthM * triangleRise / 2;
}

export function computeFoundationQuantity(
  type: FoundationType,
  wallLength: number,
  roomAreaM2: number,
  roomPerimeterM: number,
  config: FoundationQuantityConfig,
): FoundationQuantity {
  if (roomAreaM2 <= 0 && wallLength <= 0) return null;
  if (type === 'baldrame') {
    const concreteVolume = wallLength * config.baldrameWidth * config.baldrameThickness;
    return { type, length: wallLength, concreteVolume, steelKg: concreteVolume * config.steelRateKgM3 };
  }
  const areaM2 = roomAreaM2 + roomPerimeterM * config.radierMargin;
  const concreteVolume = areaM2 * config.radierThickness;
  return { type, areaM2, concreteVolume, steelKg: concreteVolume * config.steelRateKgM3 };
}
