// formation.js — the living grid: sway + breathe, slot assignment (Galaga essence)
import { W } from '../engine/renderer.js';

export const Form = {
  cols: 10, rows: 4,
  spacingX: 92, spacingY: 92,
  topY: 300,
  t: 0,
};

export function initFormation(cols, rows) {
  Form.cols = cols; Form.rows = rows;
}

export function updateFormation(dt) {
  Form.t += dt;
}

// slot base position (no sway) for col/row
export function slotBase(col, row) {
  const totalW = (Form.cols - 1) * Form.spacingX;
  const x0 = (W - totalW) / 2;
  return { x: x0 + col * Form.spacingX, y: Form.topY + row * Form.spacingY };
}

// live slot position with sway (horizontal drift) + breathe (expand/contract)
export function slotPos(col, row) {
  const base = slotBase(col, row);
  const sway = Math.sin(Form.t * 0.55) * 42;
  const cx = W / 2, cy = Form.topY + ((Form.rows - 1) * Form.spacingY) / 2;
  const breathe = 1 + Math.sin(Form.t * 0.85) * 0.055;
  return {
    x: cx + (base.x + sway - cx) * breathe,
    y: cy + (base.y - cy) * breathe,
  };
}
