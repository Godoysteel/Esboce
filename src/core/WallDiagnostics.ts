import { Core } from './Core.ts';
import type { Wall } from './types.js';

export type WallDiagnosticPhase = 'started' | 'preview' | 'final';
export type WallDiagnosticSeverity = 'ok' | 'warning' | 'error';

export interface WallDiagnosticIssue {
  code: string;
  message: string;
  wallIds: string[];
  beforeLength?: number;
  afterLength?: number;
}

export interface RemovedWallResidue {
  wallId: string;
  length: number;
}

export interface WallResizeDiagnosticReport {
  operation: 'wall-resize';
  phase: WallDiagnosticPhase;
  severity: WallDiagnosticSeverity;
  wallId: string;
  deltaX: number;
  deltaY: number;
  beforeWallCount: number;
  afterWallCount: number;
  beforeJunctionCount: number;
  afterJunctionCount: number;
  issues: WallDiagnosticIssue[];
  removedResidues: RemovedWallResidue[];
  blocked?: boolean;
}

interface EndpointSnapshot {
  wallId: string;
  which: 1 | 2;
  x: number;
  y: number;
}

const MIN_WALL_LENGTH = 0.5;
const AXIS_TOLERANCE = 1e-4;
const BLOCKING_ISSUE_CODES = new Set([
  'WALL-NON-FINITE',
  'WALL-TOO-SHORT-CREATED',
  'WALL-UNEXPECTED-DIAGONAL',
  'WALL-JUNCTION-OPENED',
]);

export function isWallResizeReportBlocking(report: WallResizeDiagnosticReport): boolean {
  return report.issues.some((issue) => BLOCKING_ISSUE_CODES.has(issue.code));
}

export function cloneWallsForDiagnostics(walls: Wall[]): Wall[] {
  return walls.map((wall) => ({ ...wall }));
}

function wallLength(wall: Wall): number {
  return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
}

// Retorna somente residuos que nasceram durante a operacao. Uma parede
// que ja era degenerada antes do gesto nao pode ser apagada por uma acao
// que nao a criou; ela continua visivel no relatorio para investigacao.
export function findNewDegenerateWallResidues(
  before: Wall[],
  after: Wall[],
  minimumLength = 1,
): RemovedWallResidue[] {
  const beforeById = new Map(before.map((wall) => [wall.id, wall]));
  return after.flatMap((wall) => {
    const length = wallLength(wall);
    if (length >= minimumLength) return [];
    const oldWall = beforeById.get(wall.id);
    if (oldWall && wallLength(oldWall) < minimumLength) return [];
    return [{ wallId: wall.id, length }];
  });
}

function wallEndpoint(wall: Wall, which: 1 | 2): EndpointSnapshot {
  return which === 1
    ? { wallId: wall.id, which, x: wall.x1, y: wall.y1 }
    : { wallId: wall.id, which, x: wall.x2, y: wall.y2 };
}

function endpointIsSupported(endpoint: EndpointSnapshot, walls: Wall[]): boolean {
  return walls.some((wall) => wall.id !== endpoint.wallId && Core.distToSegment(
    endpoint.x,
    endpoint.y,
    wall.x1,
    wall.y1,
    wall.x2,
    wall.y2,
  ) <= Core.COINCIDENCE_TOL);
}

function connectedEndpoints(walls: Wall[]): EndpointSnapshot[] {
  const endpoints: EndpointSnapshot[] = [];
  walls.forEach((wall) => {
    const start = wallEndpoint(wall, 1);
    const end = wallEndpoint(wall, 2);
    if (endpointIsSupported(start, walls)) endpoints.push(start);
    if (endpointIsSupported(end, walls)) endpoints.push(end);
  });
  return endpoints;
}

function countJunctions(walls: Wall[]): number {
  const uniquePoints: { x: number; y: number }[] = [];
  connectedEndpoints(walls).forEach((endpoint) => {
    if (!uniquePoints.some((point) => Math.hypot(point.x - endpoint.x, point.y - endpoint.y) <= Core.COINCIDENCE_TOL)) {
      uniquePoints.push({ x: endpoint.x, y: endpoint.y });
    }
  });
  return uniquePoints.length;
}

function isAxisAligned(wall: Wall): boolean {
  return Math.abs(wall.x2 - wall.x1) <= AXIS_TOLERANCE || Math.abs(wall.y2 - wall.y1) <= AXIS_TOLERANCE;
}

function addIssue(issues: WallDiagnosticIssue[], issue: WallDiagnosticIssue): void {
  if (!issues.some((existing) => existing.code === issue.code && existing.wallIds.join('|') === issue.wallIds.join('|'))) {
    issues.push(issue);
  }
}

export function analyzeWallResize(
  before: Wall[],
  after: Wall[],
  wallId: string,
  deltaX: number,
  deltaY: number,
  phase: WallDiagnosticPhase,
  removedResidues: RemovedWallResidue[] = [],
): WallResizeDiagnosticReport {
  const issues: WallDiagnosticIssue[] = [];
  const beforeById = new Map(before.map((wall) => [wall.id, wall]));
  const afterById = new Map(after.map((wall) => [wall.id, wall]));

  after.forEach((wall) => {
    const coordinates = [wall.x1, wall.y1, wall.x2, wall.y2];
    if (coordinates.some((value) => !Number.isFinite(value))) {
      addIssue(issues, {
        code: 'WALL-NON-FINITE',
        message: 'A parede recebeu uma coordenada inválida.',
        wallIds: [wall.id],
      });
      return;
    }
    const afterLength = wallLength(wall);
    if (afterLength < MIN_WALL_LENGTH) {
      const oldWall = beforeById.get(wall.id);
      const beforeLength = oldWall ? wallLength(oldWall) : undefined;
      const alreadyExisted = beforeLength !== undefined && beforeLength < MIN_WALL_LENGTH;
      addIssue(issues, {
        code: alreadyExisted ? 'WALL-TOO-SHORT-PREEXISTING' : 'WALL-TOO-SHORT-CREATED',
        message: alreadyExisted
          ? 'A parede quase zerada ja existia antes deste arraste.'
          : 'A parede ficou com comprimento quase zero durante este arraste.',
        wallIds: [wall.id],
        ...(beforeLength !== undefined ? { beforeLength } : {}),
        afterLength,
      });
    }
  });

  before.forEach((oldWall) => {
    const newWall = afterById.get(oldWall.id);
    if (!newWall) return; // fusões e divisões podem substituir IDs legitimamente
    if (isAxisAligned(oldWall) && !isAxisAligned(newWall)) {
      addIssue(issues, {
        code: 'WALL-UNEXPECTED-DIAGONAL',
        message: 'Uma parede ortogonal ficou diagonal durante o arraste.',
        wallIds: [oldWall.id],
      });
    }
  });

  connectedEndpoints(before).forEach((oldEndpoint) => {
    const newWall = afterById.get(oldEndpoint.wallId);
    if (!newWall) return;
    const newEndpoint = wallEndpoint(newWall, oldEndpoint.which);
    if (!endpointIsSupported(newEndpoint, after)) {
      addIssue(issues, {
        code: 'WALL-JUNCTION-OPENED',
        message: 'Uma ponta que estava conectada ficou sem apoio.',
        wallIds: [oldEndpoint.wallId],
      });
    }
  });

  const beforeJunctionCount = countJunctions(before);
  const afterJunctionCount = countJunctions(after);
  const hasBlockingIssue = issues.some((issue) => BLOCKING_ISSUE_CODES.has(issue.code));
  const severity: WallDiagnosticSeverity = hasBlockingIssue
    ? 'error'
    : issues.length || removedResidues.length || afterJunctionCount < beforeJunctionCount
      ? 'warning'
      : 'ok';

  return {
    operation: 'wall-resize',
    phase,
    severity,
    wallId,
    deltaX,
    deltaY,
    beforeWallCount: before.length,
    afterWallCount: after.length,
    beforeJunctionCount,
    afterJunctionCount,
    issues,
    removedResidues,
  };
}

function meters(value: number): string {
  const result = value / Core.GRID;
  return `${result >= 0 ? '+' : ''}${result.toFixed(2)} m`;
}

function lengthMeters(value: number | undefined): string {
  if (value === undefined) return 'nao existia';
  return `${(value / Core.GRID).toFixed(3)} m`;
}

export function formatWallDiagnosticReport(report: WallResizeDiagnosticReport): string {
  const status = report.blocked
    ? 'REPROVADA — MOVIMENTO CANCELADO'
    : report.severity === 'error'
      ? 'REPROVADA'
    : report.severity === 'warning'
      ? 'ATENÇÃO'
      : report.phase === 'started' ? 'AGUARDANDO MOVIMENTO' : 'VÁLIDA';
  const phase = report.phase === 'final' ? 'final' : report.phase === 'preview' ? 'durante o arraste' : 'início';
  const lines = [
    'DIAGNÓSTICO DE PAREDES',
    '',
    `Operação: mover parede (${phase})`,
    `Parede selecionada: ${report.wallId}`,
    `Deslocamento: X ${meters(report.deltaX)} | Y ${meters(report.deltaY)}`,
    `Paredes: ${report.beforeWallCount} → ${report.afterWallCount}`,
    `Junções: ${report.beforeJunctionCount} → ${report.afterJunctionCount}`,
    `Validação: ${status}`,
  ];

  if (report.issues.length) {
    lines.push('', 'Ocorrências:');
    report.issues.forEach((issue) => {
      lines.push(`${issue.code}: ${issue.message}`);
      lines.push(`IDs: ${issue.wallIds.join(', ')}`);
      if (issue.afterLength !== undefined) {
        lines.push(`Comprimento: ${lengthMeters(issue.beforeLength)} → ${lengthMeters(issue.afterLength)}`);
      }
    });
    if (report.blocked) {
      lines.push('', 'Resultado: a planta original foi restaurada automaticamente.');
    }
  } else if (report.removedResidues.length) {
    lines.push('', 'Limpeza segura:');
    report.removedResidues.forEach((residue) => {
      lines.push(`WALL-RESIDUE-REMOVED: ${residue.wallId} (${lengthMeters(residue.length)})`);
    });
    lines.push('Resultado: residuo criado neste arraste foi removido.');
  } else if (report.severity === 'warning') {
    lines.push('', 'Código: WALL-JUNCTION-COUNT-DECREASED');
  } else {
    lines.push('', 'Código: WALL-OK');
  }

  return lines.join('\n');
}
