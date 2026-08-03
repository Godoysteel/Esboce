import { MaterialsPanel } from "./MaterialsPanel.js";

function format(value: number, unit: string): string {
  return `${value.toFixed(2).replace(".", ",")} ${unit}`;
}

export function refresh(): void {
  const walls = document.getElementById("statWalls");
  const floor = document.getElementById("statFloor");
  const roof = document.getElementById("statRoof");
  if (!walls || !floor || !roof) return;

  const quantities = MaterialsPanel.compute();
  walls.textContent = `Paredes: ${format(quantities.totals.wallLength, "m")} · ${format(quantities.totals.wallAreaNet, "m²")}`;
  floor.textContent = `Área: ${format(quantities.totals.floorArea, "m²")}`;
  roof.textContent = `Telhado: ${format(quantities.totals.roofArea, "m²")}`;
}

export const ViewportStats = { refresh };
