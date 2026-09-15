/**
 * Geometria das arestas. Isolado da renderização para poder ser testado sem DOM.
 */

/** Raio do círculo de um estado, em unidades do SVG. */
export const STATE_RADIUS = 24;

/** Distância entre os dois círculos de um estado final. */
export const FINAL_RING_GAP = 5;

/** Quanto uma aresta se curva quando existe a aresta oposta. */
const BEND = 34;

/** Afastamento do rótulo em relação à curva. */
const LABEL_OFFSET = 15;

/** Ponto sobre o círculo do estado `center`, na direção de `toward`. */
function pointOnCircle(center, toward, radius) {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: center.x + (dx / len) * radius, y: center.y + (dy / len) * radius };
}

/** Direção padrão do laço: para cima, como nos slides. */
export const LOOP_UP = -Math.PI / 2;

/**
 * Caminho de um laço (transição de um estado para ele mesmo).
 *
 * A geometria é desenhada apontando para cima e depois rotacionada para
 * `angle`, de modo que o laço possa fugir das arestas que chegam ao estado.
 * @param {number} angle direção do laço em radianos; LOOP_UP por padrão
 */
export function selfLoopGeometry(state, angle = LOOP_UP) {
  const top = -STATE_RADIUS;
  const base = {
    start: { x: -13, y: top + 3 },
    end: { x: 13, y: top + 3 },
    c1: { x: -48, y: top - 60 },
    c2: { x: 48, y: top - 60 },
    // o ápice da cúbica fica a 45 do topo; o rótulo vai logo além dele
    label: { x: 0, y: top - 56 },
  };
  const rotation = angle - LOOP_UP;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const place = (p) => ({ x: state.x + p.x * cos - p.y * sin, y: state.y + p.x * sin + p.y * cos });
  const s = place(base.start);
  const e = place(base.end);
  const c1 = place(base.c1);
  const c2 = place(base.c2);
  return {
    path: `M ${s.x} ${s.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${e.x} ${e.y}`,
    label: place(base.label),
    angle,
  };
}

/**
 * Para que lado desenhar o laço de um estado: para cima, se nenhuma aresta
 * chega ou sai por ali; senão, para o meio do maior vão entre as arestas.
 * @param {{x:number,y:number}} state
 * @param {{x:number,y:number}[]} neighbors estados ligados a este por arestas
 */
export function bestLoopAngle(state, neighbors) {
  const angles = neighbors
    .filter((n) => n !== state)
    .map((n) => Math.atan2(n.y - state.y, n.x - state.x));
  if (angles.length === 0) return LOOP_UP;

  const separation = (a, b) => {
    const d = Math.abs(a - b) % (2 * Math.PI);
    return d > Math.PI ? 2 * Math.PI - d : d;
  };
  // prefere "para cima" sempre que couber: é a convenção dos slides
  if (angles.every((a) => separation(a, LOOP_UP) > Math.PI / 3)) return LOOP_UP;

  const sorted = [...angles].sort((a, b) => a - b);
  let bestGap = -1;
  let bestAngle = LOOP_UP;
  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 2 * Math.PI;
    const gap = next - current;
    if (gap > bestGap) {
      bestGap = gap;
      bestAngle = current + gap / 2;
    }
  }
  return bestAngle;
}

/** Curvatura maior, para contornar um estado que está no caminho da aresta. */
const DETOUR_BEND = 96;

/**
 * Caminho de uma aresta entre estados distintos.
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {boolean} curved true quando existe a aresta oposta (evita sobreposição)
 * @param {{detour?: boolean, side?: 1|-1}} [options]
 *        detour: curva forte para desviar de um estado no caminho;
 *        side: para que lado da reta curvar (1 = normal à esquerda)
 */
export function edgeGeometry(from, to, curved, options = {}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  // normal unitária, usada tanto para curvar quanto para afastar o rótulo
  const side = options.side ?? 1;
  const nx = (-dy / len) * side;
  const ny = (dx / len) * side;
  const bend = options.detour ? DETOUR_BEND : curved ? BEND : 0;

  // ponto de controle da quadrática
  const cx = (from.x + to.x) / 2 + nx * bend;
  const cy = (from.y + to.y) / 2 + ny * bend;
  const control = { x: cx, y: cy };

  // as pontas encostam no círculo, apontando para o ponto de controle
  const start = pointOnCircle(from, control, STATE_RADIUS);
  const end = pointOnCircle(to, control, STATE_RADIUS + 7);

  // ponto da quadrática em t = 0.5
  const midX = 0.25 * start.x + 0.5 * cx + 0.25 * end.x;
  const midY = 0.25 * start.y + 0.5 * cy + 0.25 * end.y;

  // numa aresta de desvio o rótulo vai mais para fora, longe do estado contornado
  const labelOffset = options.detour ? LABEL_OFFSET * 2.2 : LABEL_OFFSET;
  return {
    path: `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`,
    label: { x: midX + nx * labelOffset, y: midY + ny * labelOffset },
  };
}

/** Seta que marca o estado inicial, entrando pela esquerda. */
export function initialMarkerGeometry(state) {
  const tipX = state.x - STATE_RADIUS - 3;
  return `M ${state.x - STATE_RADIUS - 30} ${state.y} L ${tipX} ${state.y}`;
}

/** Distância de um ponto ao centro de um estado — usado para acerto de clique. */
export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Distância do ponto `p` ao segmento de reta `a`–`b`. */
export function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(p, a);
  // projeção de p sobre a reta, presa ao intervalo do segmento
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * De que lado da reta orientada `a`→`b` o ponto `p` está.
 * @returns {1|-1} 1 = lado da normal esquerda (a usada por edgeGeometry)
 */
export function sideOf(p, a, b) {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  return cross > 0 ? 1 : -1;
}

/**
 * Primeiro estado, fora das pontas, que uma aresta reta atravessaria.
 * @returns {{x:number,y:number}|null}
 */
export function obstacleOnEdge(from, to, states) {
  const clearance = STATE_RADIUS + 10;
  return (
    states.find(
      (s) => s !== from && s !== to && distanceToSegment(s, from, to) < clearance,
    ) || null
  );
}

/**
 * Retângulo que envolve todos os estados, com margem. Serve para enquadrar o
 * autômato ao abrir um arquivo.
 * @returns {{x:number,y:number,width:number,height:number}|null}
 */
export function boundingBox(states, margin = 80) {
  if (states.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of states) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x);
    maxY = Math.max(maxY, s.y);
  }
  return {
    x: minX - margin,
    y: minY - margin,
    width: maxX - minX + margin * 2,
    height: maxY - minY + margin * 2,
  };
}
