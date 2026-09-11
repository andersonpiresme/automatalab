/**
 * Operações que transformam o autômato no lugar.
 *
 * Equivalem aos itens "Add Trap State to DFA" e "Combine Automata" do JFLAP.
 */

import { addState, addTransition, alphabet, nextStateId } from './model.js';

/**
 * Completa a função de transição: todo par (estado, símbolo) sem destino passa
 * a levar a um estado de erro, do qual não se sai.
 *
 * @returns {{state: import('./model.js').State|null, added: number}}
 *          `added` conta as transições criadas
 */
export function addTrapState(automaton) {
  const symbols = alphabet(automaton);
  if (symbols.length === 0 || automaton.states.length === 0) {
    return { state: null, added: 0 };
  }

  const missing = [];
  for (const state of automaton.states) {
    for (const symbol of symbols) {
      const exists = automaton.transitions.some((t) => t.from === state.id && t.read === symbol);
      if (!exists) missing.push({ from: state.id, symbol });
    }
  }
  if (missing.length === 0) return { state: null, added: 0 };

  // posiciona abaixo do conjunto, onde é improvável cobrir algo
  const maxY = Math.max(...automaton.states.map((s) => s.y));
  const avgX = automaton.states.reduce((sum, s) => sum + s.x, 0) / automaton.states.length;
  const trap = addState(automaton, Math.round(avgX), Math.round(maxY) + 140, {
    name: uniqueName(automaton, 'trap'),
    initial: false,
  });

  let added = 0;
  for (const { from, symbol } of missing) {
    if (addTransition(automaton, from, trap.id, symbol)) added += 1;
  }
  for (const symbol of symbols) {
    if (addTransition(automaton, trap.id, trap.id, symbol)) added += 1;
  }
  return { state: trap, added };
}

function uniqueName(automaton, base) {
  const used = new Set(automaton.states.map((s) => s.name));
  if (!used.has(base)) return base;
  let n = 1;
  while (used.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

/**
 * Traz os estados e transições de outro autômato para dentro deste, sem
 * conectá-los: é a união disjunta que o JFLAP chama de "Combine Automata".
 * O estado inicial do autômato importado deixa de ser inicial, já que só pode
 * haver um.
 *
 * @returns {{states: number, transitions: number, initialDropped: boolean}}
 */
export function mergeAutomaton(target, source) {
  if (source.states.length === 0) {
    return { states: 0, transitions: 0, initialDropped: false };
  }

  // desloca para a direita do que já existe, para não sobrepor o desenho
  const offsetX =
    target.states.length === 0
      ? 0
      : Math.max(...target.states.map((s) => s.x)) -
        Math.min(...source.states.map((s) => s.x)) +
        180;

  const idMap = new Map();
  let nextId = nextStateId(target);
  const targetHasInitial = target.states.some((s) => s.initial);
  let initialDropped = false;

  for (const state of source.states) {
    const id = nextId;
    nextId += 1;
    idMap.set(state.id, id);
    const initial = state.initial && !targetHasInitial;
    if (state.initial && targetHasInitial) initialDropped = true;
    target.states.push({
      ...state,
      id,
      name: uniqueName(target, state.name),
      x: state.x + offsetX,
      initial,
    });
  }

  let transitions = 0;
  for (const t of source.transitions) {
    const from = idMap.get(t.from);
    const to = idMap.get(t.to);
    if (from == null || to == null) continue;
    // MT: leva gravação e movimento junto
    if (addTransition(target, from, to, t.read, { write: t.write, move: t.move })) transitions += 1;
  }

  for (const note of source.notes) {
    target.notes.push({ ...note, x: note.x + offsetX });
  }

  return { states: idMap.size, transitions, initialDropped };
}
