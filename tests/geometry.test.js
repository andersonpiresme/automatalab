import { describe, test, assert, assertEqual } from './runner.js';
import {
  LOOP_UP,
  STATE_RADIUS,
  bestLoopAngle,
  boundingBox,
  distance,
  distanceToSegment,
  edgeGeometry,
  obstacleOnEdge,
  selfLoopGeometry,
  sideOf,
} from '../src/render/geometry.js';

/** Extrai os pares numéricos de um path SVG. */
function points(path) {
  const numbers = path.match(/-?\d+(\.\d+)?/g).map(Number);
  const result = [];
  for (let i = 0; i < numbers.length; i += 2) result.push({ x: numbers[i], y: numbers[i + 1] });
  return result;
}

describe('geometry: arestas', () => {
  test('a aresta começa na borda do círculo de origem', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 200, y: 0 };
    const [start] = points(edgeGeometry(from, to, false).path);
    assertEqual(Math.round(distance(start, from)), STATE_RADIUS);
  });

  test('a ponta da seta para antes do círculo de destino', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 200, y: 0 };
    const parsed = points(edgeGeometry(from, to, false).path);
    const end = parsed[parsed.length - 1];
    assert(distance(end, to) > STATE_RADIUS, 'a seta invadiu o círculo');
  });

  test('aresta reta usa uma quadrática degenerada (controle no meio)', () => {
    const geometry = edgeGeometry({ x: 0, y: 0 }, { x: 200, y: 0 }, false);
    const [, control] = points(geometry.path);
    assertEqual([control.x, control.y], [100, 0]);
  });

  test('aresta curvada afasta o ponto de controle da reta', () => {
    const straight = edgeGeometry({ x: 0, y: 0 }, { x: 200, y: 0 }, false);
    const curved = edgeGeometry({ x: 0, y: 0 }, { x: 200, y: 0 }, true);
    assert(points(curved.path)[1].y !== points(straight.path)[1].y, 'a curva não se afastou');
  });

  test('sentidos opostos curvam para lados opostos', () => {
    const ida = points(edgeGeometry({ x: 0, y: 0 }, { x: 200, y: 0 }, true).path)[1];
    const volta = points(edgeGeometry({ x: 200, y: 0 }, { x: 0, y: 0 }, true).path)[1];
    assert(Math.sign(ida.y) === -Math.sign(volta.y), 'as duas curvaram para o mesmo lado');
  });

  test('estados sobrepostos não geram NaN', () => {
    const geometry = edgeGeometry({ x: 50, y: 50 }, { x: 50, y: 50 }, false);
    assert(!geometry.path.includes('NaN'), `path inválido: ${geometry.path}`);
  });

  test('o laço fica acima do estado por padrão', () => {
    const state = { x: 100, y: 100 };
    const geometry = selfLoopGeometry(state);
    assert(geometry.label.y < state.y - STATE_RADIUS, 'o rótulo do laço deveria ficar acima');
    assertEqual(Math.round(geometry.label.x), state.x);
  });

  test('o laço rotacionado para a direita põe o rótulo à direita', () => {
    const state = { x: 100, y: 100 };
    const geometry = selfLoopGeometry(state, 0);
    assert(geometry.label.x > state.x + STATE_RADIUS, 'rótulo deveria estar à direita');
    assertEqual(Math.round(geometry.label.y), state.y);
  });
});

describe('geometry: direção do laço', () => {
  test('sem vizinhos, aponta para cima', () => {
    assertEqual(bestLoopAngle({ x: 0, y: 0 }, []), LOOP_UP);
  });

  test('vizinhos só nos lados deixam o laço para cima', () => {
    const s = { x: 100, y: 100 };
    const angle = bestLoopAngle(s, [{ x: 0, y: 100 }, { x: 200, y: 100 }]);
    assertEqual(angle, LOOP_UP);
  });

  test('vizinho diretamente acima empurra o laço para outro lado', () => {
    const s = { x: 100, y: 100 };
    const angle = bestLoopAngle(s, [{ x: 100, y: 0 }]);
    // o único vão é o resto do círculo; o meio dele é "para baixo"
    assertEqual(Math.round(Math.sin(angle)), 1);
  });

  test('vizinhos acima e à esquerda deixam o laço apontando para baixo-direita', () => {
    const s = { x: 100, y: 100 };
    const angle = bestLoopAngle(s, [{ x: 100, y: 0 }, { x: 0, y: 100 }]);
    assert(Math.cos(angle) > 0 && Math.sin(angle) > 0, `ângulo ${angle} não aponta para baixo-direita`);
  });

  test('o próprio estado na lista é ignorado', () => {
    const s = { x: 100, y: 100 };
    assertEqual(bestLoopAngle(s, [s]), LOOP_UP);
  });
});

describe('geometry: desvio de obstáculos', () => {
  test('distância ao segmento: no meio, na ponta e além da ponta', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 0 };
    assertEqual(distanceToSegment({ x: 50, y: 30 }, a, b), 30);
    assertEqual(distanceToSegment({ x: 0, y: 10 }, a, b), 10);
    assertEqual(Math.round(distanceToSegment({ x: 130, y: 40 }, a, b)), 50);
  });

  test('detecta o estado que a reta atravessaria', () => {
    const q0 = { x: 0, y: 0 };
    const q1 = { x: 100, y: 0 };
    const q2 = { x: 200, y: 0 };
    assertEqual(obstacleOnEdge(q2, q0, [q0, q1, q2]), q1);
    assertEqual(obstacleOnEdge(q0, q1, [q0, q1, q2]), null);
  });

  test('estado longe da reta não é obstáculo', () => {
    const q0 = { x: 0, y: 0 };
    const q1 = { x: 100, y: 80 };
    const q2 = { x: 200, y: 0 };
    assertEqual(obstacleOnEdge(q2, q0, [q0, q1, q2]), null);
  });

  test('o desvio passa longe do obstáculo', () => {
    const q0 = { x: 0, y: 0 };
    const q1 = { x: 100, y: 0 };
    const q2 = { x: 200, y: 0 };
    const geometry = edgeGeometry(q2, q0, false, { detour: true, side: -sideOf(q1, q2, q0) });
    const control = points(geometry.path)[1];
    // a quadrática passa a meio caminho do controle: precisa superar o raio
    assert(Math.abs(control.y) / 2 > STATE_RADIUS, `controle a ${control.y}, curva não clareia o estado`);
  });

  test('curva para o lado oposto ao obstáculo', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 200, y: 0 };
    const acima = { x: 100, y: -30 };
    const abaixo = { x: 100, y: 30 };
    const gAcima = edgeGeometry(a, b, false, { detour: true, side: -sideOf(acima, a, b) });
    const gAbaixo = edgeGeometry(a, b, false, { detour: true, side: -sideOf(abaixo, a, b) });
    const cAcima = points(gAcima.path)[1];
    const cAbaixo = points(gAbaixo.path)[1];
    assert(Math.sign(cAcima.y) === Math.sign(abaixo.y), 'com obstáculo acima, deveria curvar para baixo');
    assert(Math.sign(cAbaixo.y) === Math.sign(acima.y), 'com obstáculo abaixo, deveria curvar para cima');
  });
});

describe('geometry: enquadramento', () => {
  test('sem estados não há caixa', () => {
    assertEqual(boundingBox([]), null);
  });

  test('a caixa envolve todos os estados com margem', () => {
    const box = boundingBox([{ x: 0, y: 0 }, { x: 100, y: 50 }], 10);
    assertEqual(box, { x: -10, y: -10, width: 120, height: 70 });
  });
});
