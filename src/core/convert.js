/**
 * Conversões e simplificações sobre autômatos finitos.
 *
 * Equivalem aos itens "Convert to DFA", "Minimize DFA" e "Compare Equivalence"
 * do JFLAP. Todas devolvem um autômato novo — nenhuma altera a origem — exceto
 * as remoções, que trabalham no lugar por serem simplificações do próprio
 * autômato.
 *
 * As posições dos estados criados ficam em (0,0): quem chama decide o layout.
 */

import {
  addState,
  addTransition,
  alphabet,
  cloneAutomaton,
  createAutomaton,
  getInitialState,
  removeState,
} from './model.js';
import { epsilonClosure, isDeterministic } from './simulate.js';

/** Estado morto implícito: destino de todo par (estado, símbolo) sem transição. */
const DEAD = -1;

export class ConversionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConversionError';
  }
}

/**
 * Nome de um estado que representa um conjunto de estados de origem.
 * Conjuntos curtos viram "q0q1"; os longos viram "d3" com o conjunto no rótulo,
 * porque não cabe texto arbitrário dentro do círculo.
 */
function setName(names, index) {
  const joined = names.join('');
  return joined.length <= 8
    ? { name: joined, label: null }
    : { name: `d${index}`, label: names.join(',') };
}

/* ------------------------------------------------------------------ *
 * Simplificações
 * ------------------------------------------------------------------ */

/**
 * Remove o que não é alcançável a partir do estado inicial.
 * @returns {number} quantidade de estados removidos
 */
export function removeUnreachable(automaton) {
  const start = getInitialState(automaton);
  if (!start) return 0;

  const reachable = new Set([start.id]);
  const stack = [start.id];
  while (stack.length > 0) {
    const id = stack.pop();
    for (const t of automaton.transitions) {
      if (t.from === id && !reachable.has(t.to)) {
        reachable.add(t.to);
        stack.push(t.to);
      }
    }
  }

  const doomed = automaton.states.filter((s) => !reachable.has(s.id));
  for (const s of doomed) removeState(automaton, s.id);
  return doomed.length;
}

/**
 * Remove estados dos quais nenhum estado final é alcançável. Não altera a
 * linguagem reconhecida — apenas enxuga o desenho.
 * @returns {number} quantidade de estados removidos
 */
export function removeUseless(automaton) {
  const productive = new Set(automaton.states.filter((s) => s.final).map((s) => s.id));
  const stack = [...productive];
  while (stack.length > 0) {
    const id = stack.pop();
    for (const t of automaton.transitions) {
      if (t.to === id && !productive.has(t.from)) {
        productive.add(t.from);
        stack.push(t.from);
      }
    }
  }

  const doomed = automaton.states.filter((s) => !productive.has(s.id));
  for (const s of doomed) removeState(automaton, s.id);
  return doomed.length;
}

/* ------------------------------------------------------------------ *
 * NFA -> DFA
 * ------------------------------------------------------------------ */

/**
 * Construção de subconjuntos. Cada estado do DFA é um conjunto de estados do
 * NFA, já fechado sob λ. Conjuntos vazios não viram estado: o DFA sai parcial,
 * como no JFLAP — use "adicionar estado de erro" para completá-lo.
 *
 * @returns {{automaton: import('./model.js').Automaton, mapping: Map<number, number[]>}}
 *          `mapping` liga cada estado novo aos estados de origem
 */
export function subsetConstruction(source) {
  const result = createAutomaton();
  const mapping = new Map();
  const start = getInitialState(source);
  if (!start) return { automaton: result, mapping };

  const symbols = alphabet(source);
  const nameOf = new Map(source.states.map((s) => [s.id, s.name]));
  const finals = new Set(source.states.filter((s) => s.final).map((s) => s.id));
  const key = (set) => set.join(',');

  let index = 0;
  const created = new Map();

  const makeState = (set) => {
    const names = set.map((id) => nameOf.get(id) ?? `#${id}`);
    const state = addState(result, 0, 0, {
      ...setName(names, index),
      initial: index === 0,
      final: set.some((id) => finals.has(id)),
    });
    index += 1;
    created.set(key(set), state.id);
    mapping.set(state.id, set);
    return state;
  };

  const startSet = epsilonClosure(source, [start.id]);
  makeState(startSet);

  const queue = [startSet];
  while (queue.length > 0) {
    const set = queue.shift();
    const fromId = created.get(key(set));
    for (const symbol of symbols) {
      const targets = new Set();
      for (const t of source.transitions) {
        if (t.read === symbol && set.includes(t.from)) targets.add(t.to);
      }
      if (targets.size === 0) continue;

      const closed = epsilonClosure(source, [...targets]);
      const closedKey = key(closed);
      if (!created.has(closedKey)) {
        makeState(closed);
        queue.push(closed);
      }
      addTransition(result, fromId, created.get(closedKey), symbol);
    }
  }

  return { automaton: result, mapping };
}

/* ------------------------------------------------------------------ *
 * Minimização
 * ------------------------------------------------------------------ */

/** Destino de δ(id, símbolo), ou DEAD quando a transição não existe. */
function makeDelta(automaton) {
  const index = new Map();
  for (const t of automaton.transitions) index.set(`${t.from}|${t.read}`, t.to);
  return (id, symbol) => (id === DEAD ? DEAD : index.get(`${id}|${symbol}`) ?? DEAD);
}

/**
 * Minimização por refinamento de partições (Moore).
 *
 * O estado morto implícito entra na partição como um estado a mais e é
 * descartado no fim. Assim, um DFA completo continua completo e um DFA parcial
 * continua parcial, em vez de ganhar um sumidouro que o usuário não pediu.
 *
 * @throws {ConversionError} se o autômato não for determinístico
 * @returns {{
 *   automaton: import('./model.js').Automaton,
 *   groups: number[][],
 *   merged: number
 * }} `groups` traz os estados de origem de cada estado novo
 */
export function minimizeDFA(source) {
  if (!isDeterministic(source)) {
    throw new ConversionError(
      'A minimização exige um autômato determinístico. Converta para DFA primeiro.',
    );
  }
  const automaton = cloneAutomaton(source);
  removeUnreachable(automaton);

  if (automaton.states.length === 0) {
    return { automaton: createAutomaton(), groups: [], merged: 0 };
  }

  const symbols = alphabet(automaton);
  const delta = makeDelta(automaton);
  const finals = new Set(automaton.states.filter((s) => s.final).map((s) => s.id));
  const ids = [...automaton.states.map((s) => s.id), DEAD];

  // partição inicial: finais de um lado, o resto (com o estado morto) do outro
  let group = new Map(ids.map((id) => [id, finals.has(id) ? 1 : 0]));

  // o refinamento só divide classes, nunca junta: quando a quantidade de
  // classes para de crescer, chegou-se ao ponto fixo
  let classes = new Set(group.values()).size;
  for (;;) {
    const signatures = new Map();
    const next = new Map();
    for (const id of ids) {
      const signature = [group.get(id), ...symbols.map((s) => group.get(delta(id, s)))].join('|');
      if (!signatures.has(signature)) signatures.set(signature, signatures.size);
      next.set(id, signatures.get(signature));
    }
    group = next;
    if (signatures.size === classes) break;
    classes = signatures.size;
  }

  // agrupa preservando a ordem original dos estados
  const members = new Map();
  for (const state of automaton.states) {
    const g = group.get(state.id);
    if (!members.has(g)) members.set(g, []);
    members.get(g).push(state.id);
  }

  const result = createAutomaton();
  const stateOfGroup = new Map();
  const groups = [];
  const nameOf = new Map(automaton.states.map((s) => [s.id, s.name]));
  const initial = getInitialState(automaton);
  const initialGroup = initial ? group.get(initial.id) : null;

  let index = 0;
  for (const [g, ids_] of members) {
    const names = ids_.map((id) => nameOf.get(id));
    const created = addState(result, 0, 0, {
      ...setName(names, index),
      initial: g === initialGroup,
      final: ids_.some((id) => finals.has(id)),
    });
    stateOfGroup.set(g, created.id);
    groups.push(ids_);
    index += 1;
  }

  for (const [g, ids_] of members) {
    const representative = ids_[0];
    for (const symbol of symbols) {
      const target = delta(representative, symbol);
      if (target === DEAD) continue;
      const targetGroup = group.get(target);
      // grupo só com o estado morto não virou estado: a transição some
      if (!stateOfGroup.has(targetGroup)) continue;
      addTransition(result, stateOfGroup.get(g), stateOfGroup.get(targetGroup), symbol);
    }
  }

  return {
    automaton: result,
    groups,
    merged: automaton.states.length - result.states.length,
  };
}

/* ------------------------------------------------------------------ *
 * Equivalência
 * ------------------------------------------------------------------ */

/** Determiniza se necessário; devolve sempre um DFA. */
function toDFA(automaton) {
  return isDeterministic(automaton) ? cloneAutomaton(automaton) : subsetConstruction(automaton).automaton;
}

/**
 * Dois autômatos reconhecem a mesma linguagem?
 *
 * Percorre o produto dos dois DFAs a partir dos estados iniciais: se algum par
 * alcançável discorda quanto a ser final, as linguagens diferem. É o teste
 * clássico, e devolve o contraexemplo quando falha.
 *
 * @returns {{equivalent: boolean, counterexample: string|null}}
 */
export function areEquivalent(a, b) {
  const da = toDFA(a);
  const db = toDFA(b);
  const deltaA = makeDelta(da);
  const deltaB = makeDelta(db);
  const finalA = new Set(da.states.filter((s) => s.final).map((s) => s.id));
  const finalB = new Set(db.states.filter((s) => s.final).map((s) => s.id));

  const symbols = [...new Set([...alphabet(da), ...alphabet(db)])].sort();
  const startA = getInitialState(da)?.id ?? DEAD;
  const startB = getInitialState(db)?.id ?? DEAD;

  const seen = new Set([`${startA}|${startB}`]);
  // guarda a cadeia que leva a cada par, para poder mostrar o contraexemplo
  const queue = [{ a: startA, b: startB, word: '' }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (finalA.has(current.a) !== finalB.has(current.b)) {
      return { equivalent: false, counterexample: current.word };
    }
    for (const symbol of symbols) {
      const nextA = deltaA(current.a, symbol);
      const nextB = deltaB(current.b, symbol);
      const key = `${nextA}|${nextB}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ a: nextA, b: nextB, word: current.word + symbol });
    }
  }
  return { equivalent: true, counterexample: null };
}
