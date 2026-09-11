/**
 * Simulação de máquinas de Turing de uma fita.
 *
 * Segue a definição do Menezes usada no curso — M = (Σ, Q, Π, q0, F, V, ß, Δ)
 * — com as três condições de parada do slide 26:
 *
 *   1. entrar em estado final: para e ACEITA;
 *   2. Π indefinida para (estado, símbolo lido): para e REJEITA;
 *   3. mover à esquerda estando na célula 0: para e REJEITA.
 *
 * A convenção do JFLAP (fita infinita nos dois lados, sem Δ) também é aceita;
 * a diferença fica toda em `initialConfiguration` e na regra 3.
 *
 * Nas duas, a máquina pode ser não-determinística: a simulação percorre todas
 * as computações em largura, como a dos autômatos finitos. Uma MT também pode
 * não parar, por isso há um teto de passos; atingi-lo é reportado como
 * "possível loop", não como rejeição.
 */

import { getInitialState, START_MARKER, tapeConvention } from './model.js';

/**
 * @typedef {Object} TMConfiguration
 * @property {number}   state
 * @property {string[]} cells   conteúdo da fita; índice 0 é a célula mais à esquerda já vista
 * @property {number}   head    índice em `cells`
 * @property {number}   origin  número da célula que está em cells[0] (só muda na convenção jflap)
 * @property {TMConfiguration|null} parent
 * @property {import('./model.js').Transition|null} via
 */

/** Branco interno: a string vazia, a mesma que o .jff usa. */
export const BLANK = '';

const MAX_STEPS = 10000;

/** Divide a entrada em símbolos, respeitando caracteres fora do BMP. */
function toSymbols(input) {
  return Array.from(input || '');
}

/**
 * Configuração inicial conforme a convenção.
 *   menezes: [Δ, w...], cabeça na célula 0 (sobre o Δ)
 *   jflap:   [w...],    cabeça na célula 0 (primeiro símbolo da entrada)
 */
export function initialConfiguration(automaton, input) {
  const start = getInitialState(automaton);
  if (!start) return null;
  const symbols = toSymbols(input);
  const menezes = tapeConvention(automaton) === 'menezes';
  return {
    state: start.id,
    cells: menezes ? [START_MARKER, ...symbols] : symbols.length ? symbols : [BLANK],
    head: 0,
    origin: 0,
    parent: null,
    via: null,
  };
}

/** Símbolo sob a cabeça; fora da fita já vista é branco. */
export function readCell(config) {
  return config.cells[config.head] ?? BLANK;
}

/**
 * Aplica uma transição a uma configuração, devolvendo a nova configuração —
 * ou null quando o movimento é inválido (regra 3).
 */
export function applyTransition(automaton, config, transition) {
  const cells = config.cells.slice();
  // garante que a célula existe antes de gravar
  while (cells.length <= config.head) cells.push(BLANK);
  cells[config.head] = transition.write;

  let head = config.head;
  let origin = config.origin;
  if (transition.move === 'R') head += 1;
  else if (transition.move === 'L') head -= 1;

  if (head < 0) {
    if (tapeConvention(automaton) === 'menezes') return null;
    // jflap: a fita cresce para a esquerda
    cells.unshift(BLANK);
    head = 0;
    origin -= 1;
  }

  return { state: transition.to, cells, head, origin, parent: config, via: transition };
}

function isFinal(automaton, config) {
  return Boolean(automaton.states.find((s) => s.id === config.state)?.final);
}

/** Transições aplicáveis: mesmo estado e mesmo símbolo lido. */
export function applicable(automaton, config) {
  const symbol = readCell(config);
  return automaton.transitions.filter((t) => t.from === config.state && t.read === symbol);
}

/**
 * Executa a máquina por completo, guardando cada geração para o passo a passo.
 *
 * @returns {{
 *   generations: TMConfiguration[][],
 *   accepted: boolean,
 *   accepting: TMConfiguration|null,
 *   halted: 'aceitou'|'rejeitou'|'limite'|'sem-inicial',
 *   reason: string,
 *   steps: number
 * }}
 */
export function simulateTuring(automaton, input, { maxSteps = MAX_STEPS } = {}) {
  const first = initialConfiguration(automaton, input);
  if (!first) {
    return {
      generations: [],
      accepted: false,
      accepting: null,
      halted: 'sem-inicial',
      reason: 'Sem estado inicial.',
      steps: 0,
    };
  }

  let configs = [first];
  const generations = [configs];
  let steps = 0;
  let lastReason = '';

  const acceptingIn = (list) => list.find((c) => isFinal(automaton, c)) || null;
  let accepting = acceptingIn(configs);

  while (!accepting && configs.length > 0 && steps < maxSteps) {
    const next = [];
    const reasons = [];
    for (const config of configs) {
      const options = applicable(automaton, config);
      if (options.length === 0) {
        reasons.push('função indefinida');
        continue;
      }
      for (const t of options) {
        const moved = applyTransition(automaton, config, t);
        if (moved === null) reasons.push('movimento inválido à esquerda do Δ');
        else next.push(moved);
      }
    }
    if (next.length === 0) {
      lastReason = [...new Set(reasons)].join('; ');
      break;
    }
    configs = next;
    generations.push(configs);
    steps += 1;
    accepting = acceptingIn(configs);
  }

  if (accepting) {
    return { generations, accepted: true, accepting, halted: 'aceitou', reason: 'estado final', steps };
  }
  if (steps >= maxSteps) {
    return {
      generations,
      accepted: false,
      accepting: null,
      halted: 'limite',
      reason: `${maxSteps} passos sem parar — possível loop`,
      steps,
    };
  }
  return { generations, accepted: false, accepting: null, halted: 'rejeitou', reason: lastReason, steps };
}

/** Só o veredito. */
export function acceptsTuring(automaton, input, options) {
  return simulateTuring(automaton, input, options).accepted;
}

/** Caminho da raiz até a configuração. */
export function traceTuring(config) {
  const path = [];
  for (let c = config; c; c = c.parent) path.unshift(c);
  return path;
}

/**
 * Fita como texto, com a célula sob a cabeça entre colchetes: `Δ A [a] b ß`.
 * Brancos à direita são cortados, exceto o que está sob a cabeça.
 */
export function formatTape(config, blank = 'ß') {
  const cells = config.cells.slice();
  while (cells.length <= config.head) cells.push(BLANK);
  let end = cells.length;
  while (end - 1 > config.head && cells[end - 1] === BLANK) end -= 1;
  return cells
    .slice(0, end)
    .map((c, i) => {
      const text = c === BLANK ? blank : c;
      return i === config.head ? `[${text}]` : text;
    })
    .join(' ');
}

/** Conteúdo útil da fita ao parar: sem Δ e sem brancos nas pontas. */
export function tapeOutput(config) {
  const cells = config.cells.filter((c) => c !== START_MARKER);
  let start = 0;
  let end = cells.length;
  while (start < end && cells[start] === BLANK) start += 1;
  while (end > start && cells[end - 1] === BLANK) end -= 1;
  return cells.slice(start, end).join('');
}
