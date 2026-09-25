/**
 * Simulação de autômatos com pilha (PDA).
 *
 * Convenção compatível com o JFLAP:
 *   - a pilha começa com um único símbolo de fundo (Z, por padrão);
 *   - cada transição lê um símbolo da entrada (ou λ), desempilha uma string do
 *     topo (ou λ) e empilha uma string (ou λ), com o 1º caractere no topo;
 *   - a aceitação é por estado final (padrão) ou por pilha vazia.
 *
 * O PDA é naturalmente não-determinístico e tem λ-movimentos, então a simulação
 * percorre todas as computações em largura, como a dos autômatos finitos e da
 * MT. Um conjunto de configurações já vistas evita ciclos de λ; um teto de
 * passos protege contra a pilha crescer para sempre (reportado como "possível
 * loop", não como rejeição).
 *
 * A pilha é uma string cujo índice 0 é o TOPO: empilhar "aZ" deixa 'a' no topo,
 * desempilhar "a" exige que a string comece por 'a'.
 */

import { acceptMode, getInitialState, stackBottom } from './model.js';

/**
 * @typedef {Object} PDAConfiguration
 * @property {number} state
 * @property {number} pos     quantos símbolos da entrada já foram consumidos
 * @property {string} stack   conteúdo da pilha; índice 0 é o topo
 * @property {PDAConfiguration|null} parent
 * @property {import('./model.js').Transition|null} via
 */

const MAX_STEPS = 10000;
const MAX_WIDTH = 20000;

/** Divide a entrada em símbolos, respeitando caracteres fora do BMP. */
function toSymbols(input) {
  return Array.from(input || '');
}

/** Configuração inicial: entrada intocada e a pilha só com o símbolo de fundo. */
export function initialConfiguration(automaton, input) {
  const start = getInitialState(automaton);
  if (!start) return null;
  return { state: start.id, pos: 0, stack: stackBottom(automaton), parent: null, via: null };
}

/**
 * Transições aplicáveis a uma configuração: mesmo estado, o símbolo lido bate
 * com a entrada (ou é λ) e o topo da pilha começa com o que se desempilha.
 */
export function applicable(automaton, config, symbols) {
  return automaton.transitions.filter((t) => {
    if (t.from !== config.state) return false;
    if (t.read !== '' && symbols[config.pos] !== t.read) return false;
    if (t.pop !== '' && !config.stack.startsWith(t.pop)) return false;
    return true;
  });
}

/** Aplica uma transição, devolvendo a nova configuração. */
export function applyTransition(config, transition) {
  const consumed = transition.read === '' ? 0 : 1;
  const afterPop = transition.pop === '' ? config.stack : config.stack.slice(transition.pop.length);
  return {
    state: transition.to,
    pos: config.pos + consumed,
    stack: transition.push + afterPop,
    parent: config,
    via: transition,
  };
}

function isFinalState(automaton, id) {
  return Boolean(automaton.states.find((s) => s.id === id)?.final);
}

/** Uma configuração é de aceitação se a entrada acabou e o critério é atendido. */
export function isAccepting(automaton, config, inputLength) {
  if (config.pos !== inputLength) return false;
  return acceptMode(automaton) === 'empty' ? config.stack === '' : isFinalState(automaton, config.state);
}

/** Assinatura para deduplicar configurações e cortar ciclos de λ. */
function signature(config) {
  return `${config.state}|${config.pos}|${config.stack}`;
}

/**
 * Executa a máquina por completo, guardando cada geração para o passo a passo.
 *
 * @returns {{
 *   generations: PDAConfiguration[][],
 *   accepted: boolean,
 *   accepting: PDAConfiguration|null,
 *   halted: 'aceitou'|'rejeitou'|'limite'|'sem-inicial',
 *   reason: string,
 *   steps: number
 * }}
 */
export function simulatePushdown(automaton, input, { maxSteps = MAX_STEPS } = {}) {
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

  const symbols = toSymbols(input);
  const inputLength = symbols.length;
  const acceptingIn = (list) => list.find((c) => isAccepting(automaton, c, inputLength)) || null;

  let configs = [first];
  const generations = [configs];
  const seen = new Set([signature(first)]);
  let steps = 0;
  let accepting = acceptingIn(configs);

  while (!accepting && configs.length > 0 && steps < maxSteps) {
    const next = [];
    for (const config of configs) {
      for (const t of applicable(automaton, config, symbols)) {
        const moved = applyTransition(config, t);
        const sig = signature(moved);
        if (seen.has(sig)) continue; // já explorada: corta ciclos de λ
        seen.add(sig);
        next.push(moved);
      }
    }
    if (next.length === 0) break; // toda computação morreu: rejeita
    if (next.length > MAX_WIDTH) {
      return {
        generations,
        accepted: false,
        accepting: null,
        halted: 'limite',
        reason: 'não-determinismo grande demais — possível loop',
        steps,
      };
    }
    configs = next;
    generations.push(configs);
    steps += 1;
    accepting = acceptingIn(configs);
  }

  if (accepting) {
    const criterio = acceptMode(automaton) === 'empty' ? 'pilha vazia' : 'estado final';
    return { generations, accepted: true, accepting, halted: 'aceitou', reason: criterio, steps };
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
  return {
    generations,
    accepted: false,
    accepting: null,
    halted: 'rejeitou',
    reason: 'nenhuma computação aceita a entrada',
    steps,
  };
}

/** Só o veredito. */
export function acceptsPushdown(automaton, input, options) {
  return simulatePushdown(automaton, input, options).accepted;
}

/** Caminho da raiz até a configuração. */
export function tracePushdown(config) {
  const path = [];
  for (let c = config; c; c = c.parent) path.unshift(c);
  return path;
}

/**
 * Pilha como texto legível, do topo para o fundo, com o topo à esquerda.
 * Pilha vazia vira "λ".
 */
export function formatStack(config) {
  return config.stack === '' ? 'λ' : config.stack.split('').join(' ');
}
