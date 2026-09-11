/**
 * Simulação de autômatos finitos.
 *
 * Reproduz os dois modos do JFLAP:
 *
 *   - "com fecho" (step with closure): cada passo consome um símbolo e o
 *     resultado já vem fechado sob λ. É a leitura clássica de δ*.
 *   - "por estado" (step by state): uma transição λ é um passo próprio, que
 *     não consome entrada. Mostra ao aluno o custo real do não-determinismo.
 *
 * Uma configuração é (estado, posição na entrada). Guardar `parent` permite
 * reconstruir o caminho de aceitação sem repetir a busca.
 */

import { getInitialState } from './model.js';

/**
 * @typedef {Object} Configuration
 * @property {number} state
 * @property {number} position       índice do próximo símbolo a ler
 * @property {Configuration|null} parent
 * @property {string|null} read      rótulo consumido para chegar aqui ('' = λ)
 */

/** Limite de gerações, para que um autômato patológico não trave a página. */
const MAX_STEPS = 2000;

/** Divide a entrada em símbolos, respeitando caracteres fora do BMP. */
export function toSymbols(input) {
  return Array.from(input || '');
}

/**
 * Quantos símbolos o rótulo `read` consome a partir de `position`.
 * @returns {number} -1 quando não casa; 0 para λ
 */
function match(symbols, position, read) {
  const label = Array.from(read);
  if (label.length === 0) return 0;
  if (position + label.length > symbols.length) return -1;
  for (let i = 0; i < label.length; i += 1) {
    if (symbols[position + i] !== label[i]) return -1;
  }
  return label.length;
}

/**
 * Fecho-λ de um conjunto de estados.
 * @returns {number[]} ids em ordem crescente
 */
export function epsilonClosure(automaton, ids) {
  const seen = new Set(ids);
  const stack = [...ids];
  while (stack.length > 0) {
    const id = stack.pop();
    for (const t of automaton.transitions) {
      if (t.from === id && t.read === '' && !seen.has(t.to)) {
        seen.add(t.to);
        stack.push(t.to);
      }
    }
  }
  return [...seen].sort((a, b) => a - b);
}

/** Expande uma configuração por transições λ, preservando a cadeia de parents. */
function closeConfiguration(automaton, config) {
  const result = [config];
  const seen = new Set([config.state]);
  const queue = [config];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const t of automaton.transitions) {
      if (t.from === current.state && t.read === '' && !seen.has(t.to)) {
        seen.add(t.to);
        const next = { state: t.to, position: current.position, parent: current, read: '' };
        result.push(next);
        queue.push(next);
      }
    }
  }
  return result;
}

/**
 * Configurações iniciais.
 * @returns {Configuration[]} vazio se não houver estado inicial
 */
export function initialConfigurations(automaton, { closure = true } = {}) {
  const start = getInitialState(automaton);
  if (!start) return [];
  const root = { state: start.id, position: 0, parent: null, read: null };
  return closure ? closeConfiguration(automaton, root) : [root];
}

/**
 * Um passo de simulação.
 * @param {Configuration[]} configs
 * @param {string[]} symbols entrada já dividida
 * @returns {Configuration[]} configurações da geração seguinte
 */
export function step(automaton, configs, symbols, { closure = true } = {}) {
  const next = [];
  const seen = new Set();
  const push = (config) => {
    const key = `${config.state}:${config.position}`;
    if (seen.has(key)) return;
    seen.add(key);
    next.push(config);
  };

  for (const config of configs) {
    for (const t of automaton.transitions) {
      if (t.from !== config.state) continue;

      if (closure) {
        // no modo com fecho, λ não é um passo: já veio embutido
        if (t.read === '') continue;
        const consumed = match(symbols, config.position, t.read);
        if (consumed <= 0) continue;
        const moved = {
          state: t.to,
          position: config.position + consumed,
          parent: config,
          read: t.read,
        };
        for (const closed of closeConfiguration(automaton, moved)) push(closed);
      } else {
        const consumed = match(symbols, config.position, t.read);
        if (consumed < 0) continue;
        push({
          state: t.to,
          position: config.position + consumed,
          parent: config,
          read: t.read,
        });
      }
    }
  }
  return next;
}

/** A configuração consumiu toda a entrada e parou em estado final? */
export function isAccepting(automaton, config, symbols) {
  if (config.position !== symbols.length) return false;
  const state = automaton.states.find((s) => s.id === config.state);
  return Boolean(state && state.final);
}

/**
 * Executa a simulação inteira, guardando cada geração para exibição passo a
 * passo.
 *
 * @returns {{
 *   symbols: string[],
 *   generations: Configuration[][],
 *   accepted: boolean,
 *   accepting: Configuration|null,
 *   halted: 'aceitou'|'esgotou'|'limite'
 * }}
 */
export function simulate(automaton, input, { closure = true, maxSteps = MAX_STEPS } = {}) {
  const symbols = toSymbols(input);
  let configs = initialConfigurations(automaton, { closure });
  const generations = [configs];

  // (estado, posição) já visitados: corta ciclos de λ no modo por estado
  const visited = new Set(configs.map((c) => `${c.state}:${c.position}`));

  const findAccepting = (list) => list.find((c) => isAccepting(automaton, c, symbols)) || null;
  let accepting = findAccepting(configs);

  let steps = 0;
  while (!accepting && configs.length > 0 && steps < maxSteps) {
    const produced = step(automaton, configs, symbols, { closure });
    configs = produced.filter((c) => {
      const key = `${c.state}:${c.position}`;
      if (visited.has(key)) return false;
      visited.add(key);
      return true;
    });
    if (configs.length === 0) break;
    generations.push(configs);
    accepting = findAccepting(configs);
    steps += 1;
  }

  return {
    symbols,
    generations,
    accepted: Boolean(accepting),
    accepting,
    halted: accepting ? 'aceitou' : steps >= maxSteps ? 'limite' : 'esgotou',
  };
}

/** Só o veredito — usado na execução em lote. */
export function accepts(automaton, input, options = {}) {
  return simulate(automaton, input, options).accepted;
}

/**
 * Caminho da raiz até a configuração, para exibir a execução aceita.
 * @returns {Configuration[]}
 */
export function trace(config) {
  const path = [];
  for (let current = config; current; current = current.parent) path.unshift(current);
  return path;
}

/**
 * @param {string[]} inputs
 * @returns {{input: string, accepted: boolean}[]}
 */
export function runBatch(automaton, inputs, options = {}) {
  return inputs.map((input) => ({ input, accepted: accepts(automaton, input, options) }));
}

/**
 * Estados com não-determinismo: mais de uma transição com o mesmo rótulo, ou
 * qualquer transição λ — que já basta para tornar a escolha não-determinística.
 * @returns {Set<number>}
 */
export function nondeterministicStates(automaton) {
  const result = new Set();
  const byState = new Map();
  for (const t of automaton.transitions) {
    if (!byState.has(t.from)) byState.set(t.from, []);
    byState.get(t.from).push(t);
  }
  // numa MT a leitura vazia é o branco, um símbolo como outro qualquer;
  // só nos AFs ela é λ e, portanto, não-determinismo por si só
  const lambdaCounts = automaton.type !== 'turing';
  for (const [id, transitions] of byState) {
    const labels = transitions.map((t) => t.read);
    const hasDuplicate = labels.some((label, i) => labels.indexOf(label) !== i);
    if (hasDuplicate || (lambdaCounts && labels.includes(''))) result.add(id);
  }
  return result;
}

/** Sem λ e sem escolha ambígua: as conversões que exigem DFA usam este teste. */
export function isDeterministic(automaton) {
  return nondeterministicStates(automaton).size === 0;
}

/* ------------------------------------------------------------------ *
 * Máquina de Moore
 * ------------------------------------------------------------------ */

/**
 * Executa uma máquina de Moore.
 *
 * Moore emite a saída do estado em que está: primeiro a do estado inicial, e
 * depois uma a cada transição percorrida. A execução é determinística — havendo
 * mais de uma transição possível, segue a primeira e sinaliza em `ambiguous`,
 * para o painel poder avisar em vez de escolher em silêncio.
 *
 * @returns {{
 *   symbols: string[],
 *   steps: {state:number, position:number, read:string|null, output:string|null}[],
 *   output: string[],
 *   halted: 'fim'|'sem-transicao'|'sem-inicial',
 *   ambiguous: boolean
 * }}
 */
export function simulateMoore(automaton, input) {
  const symbols = toSymbols(input);
  const start = getInitialState(automaton);
  if (!start) {
    return { symbols, steps: [], output: [], halted: 'sem-inicial', ambiguous: false };
  }

  const steps = [{ state: start.id, position: 0, read: null, output: start.output }];
  let current = start;
  let position = 0;
  let ambiguous = false;
  let halted = 'fim';

  while (position < symbols.length) {
    const candidates = automaton.transitions.filter(
      (t) => t.from === current.id && match(symbols, position, t.read) > 0,
    );
    if (candidates.length === 0) {
      halted = 'sem-transicao';
      break;
    }
    if (candidates.length > 1) ambiguous = true;

    const chosen = candidates[0];
    const consumed = match(symbols, position, chosen.read);
    const next = automaton.states.find((s) => s.id === chosen.to);
    if (!next) {
      halted = 'sem-transicao';
      break;
    }
    position += consumed;
    current = next;
    steps.push({ state: next.id, position, read: chosen.read, output: next.output });
  }

  return {
    symbols,
    steps,
    output: steps.map((s) => s.output).filter((o) => o != null),
    halted,
    ambiguous,
  };
}

/** Símbolos da entrada que não aparecem em nenhuma transição. */
export function unknownSymbols(automaton, input) {
  const known = new Set(automaton.transitions.map((t) => t.read).filter(Boolean));
  // rótulos de mais de um caractere tornam a checagem por símbolo inconclusiva
  if ([...known].some((label) => Array.from(label).length > 1)) return [];
  const unknown = new Set();
  for (const symbol of toSymbols(input)) {
    if (!known.has(symbol)) unknown.add(symbol);
  }
  return [...unknown];
}
