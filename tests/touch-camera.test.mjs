import assert from "node:assert/strict";
import test from "node:test";

import { touchCameraAnchor, updateTouchCamera } from "../src/core/TouchCamera.ts";

test("movimento conjunto de dois dedos gira a câmera sem alterar o zoom", () => {
  const anchor = touchCameraAnchor({ clientX: 100, clientY: 200 }, { clientX: 200, clientY: 200 }, 13);
  const result = updateTouchCamera(
    { angle: 1, elevation: 0.6, distance: 13 },
    anchor,
    { clientX: 120, clientY: 210 },
    { clientX: 220, clientY: 210 },
    3,
    35,
  );

  assert.ok(result.state.angle < 1);
  assert.ok(result.state.elevation > 0.6);
  assert.equal(result.state.distance, 13);
});

test("pinça aproxima e afasta respeitando os limites da câmera", () => {
  const anchor = touchCameraAnchor({ clientX: 100, clientY: 200 }, { clientX: 200, clientY: 200 }, 13);
  const zoomOut = updateTouchCamera(
    { angle: 1, elevation: 0.6, distance: 13 }, anchor,
    { clientX: 145, clientY: 200 }, { clientX: 155, clientY: 200 }, 3, 35,
  );
  const zoomIn = updateTouchCamera(
    { angle: 1, elevation: 0.6, distance: 13 }, anchor,
    { clientX: 0, clientY: 200 }, { clientX: 300, clientY: 200 }, 3, 35,
  );

  assert.equal(zoomOut.state.distance, 35);
  assert.ok(zoomIn.state.distance < 13);
  assert.ok(zoomIn.state.distance >= 3);
});
