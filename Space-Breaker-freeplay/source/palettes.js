// palettes.js — 5 sector art directions (cyberpunk x Macross)
export const SECTORS = [
  {
    name: 'NEON HARBOR', set: 'planet',
    bg0: [4, 6, 24], bg1: [10, 16, 56],
    neb: [[30, 60, 160], [120, 20, 140]],
    star: '#aef2ff', accent: '#22d3ee', accent2: '#ff3ec8',
  },
  {
    name: 'CRIMSON GATE', set: 'fleet',
    bg0: [22, 4, 10], bg1: [56, 14, 24],
    neb: [[170, 30, 40], [120, 70, 10]],
    star: '#ffd9c9', accent: '#ff5c5c', accent2: '#ffb020',
  },
  {
    name: 'VIOLET DEEP', set: 'gate',
    bg0: [10, 4, 26], bg1: [30, 12, 64],
    neb: [[110, 30, 190], [20, 90, 130]],
    star: '#e2d6ff', accent: '#b06bff', accent2: '#3ef0d0',
  },
  {
    name: 'GOLD SECTOR', set: 'suns',
    bg0: [20, 12, 2], bg1: [52, 34, 8],
    neb: [[190, 130, 20], [90, 60, 140]],
    star: '#fff3d6', accent: '#ffd23f', accent2: '#3ef0ff',
  },
  {
    name: 'VOID CROWN', set: 'hole',
    bg0: [3, 12, 10], bg1: [8, 30, 26],
    neb: [[10, 130, 80], [150, 20, 110]],
    star: '#d6ffee', accent: '#39ff9a', accent2: '#ff4fd8',
  },
];

export function sectorFor(stage) { return SECTORS[(stage - 1) % SECTORS.length]; }
