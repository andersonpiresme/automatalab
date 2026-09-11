/**
 * Reposicionamento automático dos estados (Fruchterman-Reingold).
 *
 * Serve para arquivos importados com estados sobrepostos ou espalhados. É
 * determinístico de propósito: a posição inicial vem de um círculo, não de
 * números aleatórios, para que o mesmo autômato caia sempre no mesmo desenho.
 */

/** Distância mínima considerada, evita divisão por zero em estados colados. */
const EPSILON = 0.01;

/**
 * @param {import('../core/model.js').Automaton} automaton
 * @returns {Map<number, {x:number, y:number}>} novas posições por id de estado
 */
export function springLayout(automaton, options = {}) {
  const { width = 900, height = 560, iterations = 300, padding = 60 } = options;
  const states = automaton.states;
  const n = states.length;
  const positions = new Map();

  if (n === 0) return positions;
  if (n === 1) {
    positions.set(states[0].id, { x: width / 2, y: height / 2 });
    return positions;
  }

  // posição inicial em círculo: determinística e já bem distribuída
  const radius = Math.min(width, height) / 2 - padding;
  states.forEach((state, i) => {
    const angle = (2 * Math.PI * i) / n;
    positions.set(state.id, {
      x: width / 2 + radius * Math.cos(angle),
      y: height / 2 + radius * Math.sin(angle),
    });
  });

  // arestas sem direção e sem duplicatas: só a topologia importa aqui
  const edges = new Set();
  for (const t of automaton.transitions) {
    if (t.from === t.to) continue;
    const [a, b] = t.from < t.to ? [t.from, t.to] : [t.to, t.from];
    edges.add(`${a}:${b}`);
  }
  const pairs = [...edges].map((key) => key.split(':').map(Number));

  const area = (width - padding * 2) * (height - padding * 2);
  const k = Math.sqrt(area / n);
  let temperature = Math.min(width, height) / 8;
  const cooling = temperature / (iterations + 1);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const displacement = new Map(states.map((s) => [s.id, { x: 0, y: 0 }]));

    // repulsão entre todos os pares
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const a = positions.get(states[i].id);
        const b = positions.get(states[j].id);
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let distance = Math.hypot(dx, dy);
        if (distance < EPSILON) {
          // estados exatamente sobrepostos: desempata pelo índice
          dx = (i - j) * EPSILON;
          dy = EPSILON;
          distance = Math.hypot(dx, dy);
        }
        const force = (k * k) / distance;
        const da = displacement.get(states[i].id);
        const db = displacement.get(states[j].id);
        da.x += (dx / distance) * force;
        da.y += (dy / distance) * force;
        db.x -= (dx / distance) * force;
        db.y -= (dy / distance) * force;
      }
    }

    // atração ao longo das arestas
    for (const [from, to] of pairs) {
      const a = positions.get(from);
      const b = positions.get(to);
      if (!a || !b) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.max(Math.hypot(dx, dy), EPSILON);
      const force = (distance * distance) / k;
      const da = displacement.get(from);
      const db = displacement.get(to);
      da.x -= (dx / distance) * force;
      da.y -= (dy / distance) * force;
      db.x += (dx / distance) * force;
      db.y += (dy / distance) * force;
    }

    // aplica o deslocamento, limitado pela temperatura, e prende na moldura
    for (const state of states) {
      const position = positions.get(state.id);
      const delta = displacement.get(state.id);
      const length = Math.max(Math.hypot(delta.x, delta.y), EPSILON);
      position.x += (delta.x / length) * Math.min(length, temperature);
      position.y += (delta.y / length) * Math.min(length, temperature);
      position.x = Math.min(width - padding, Math.max(padding, position.x));
      position.y = Math.min(height - padding, Math.max(padding, position.y));
    }

    temperature -= cooling;
  }

  // arredonda: coordenadas inteiras deixam o .jff mais limpo
  for (const [id, position] of positions) {
    positions.set(id, { x: Math.round(position.x), y: Math.round(position.y) });
  }
  return positions;
}
