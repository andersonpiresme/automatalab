/**
 * Exemplos embutidos. Vivem fora da interface para que os testes e a interface
 * usem exatamente a mesma máquina.
 *
 * As máquinas de Turing seguem a convenção do Menezes usada na disciplina:
 * Δ na célula 0, cabeça começa sobre ele, movimentos E (L) e D (R).
 */

import { START_MARKER, addState, addTransition, createAutomaton } from './model.js';

/** DFA das cadeias sobre {0,1} terminadas em "01". */
export function exampleAutomaton() {
  const automaton = createAutomaton();
  const q0 = addState(automaton, 200, 300, { name: 'q0', initial: true });
  const q1 = addState(automaton, 420, 300, { name: 'q1' });
  const q2 = addState(automaton, 640, 300, { name: 'q2', final: true });
  addTransition(automaton, q0.id, q1.id, '0');
  addTransition(automaton, q0.id, q0.id, '1');
  addTransition(automaton, q1.id, q1.id, '0');
  addTransition(automaton, q1.id, q2.id, '1');
  addTransition(automaton, q2.id, q1.id, '0');
  addTransition(automaton, q2.id, q0.id, '1');
  return automaton;
}

/** Atalho para escrever transições de MT como no slide: t(q0, q1, 'a', 'A', 'D'). */
function tm(machine) {
  const MOVE = { E: 'L', D: 'R', S: 'S' };
  return (from, to, read, write, move) =>
    addTransition(machine, from.id, to.id, read, { write, move: MOVE[move] });
}

/**
 * A MT do slide 10 da aula 9 — L = aⁿbⁿ — com a mesma disposição do slide:
 * q0, q1, q2 em linha no alto; q3 e q4 descendo à esquerda.
 */
export function exampleTuring() {
  const m = createAutomaton('turing');
  const q0 = addState(m, 200, 180, { name: 'q0', initial: true });
  const q1 = addState(m, 460, 180, { name: 'q1' });
  const q2 = addState(m, 720, 180, { name: 'q2' });
  const q3 = addState(m, 200, 400, { name: 'q3' });
  const q4 = addState(m, 200, 600, { name: 'q4', final: true });
  const t = tm(m);
  t(q0, q0, START_MARKER, START_MARKER, 'D');
  t(q0, q1, 'a', 'A', 'D');
  t(q0, q3, 'B', 'B', 'D');
  t(q0, q4, '', '', 'D');
  t(q1, q1, 'a', 'a', 'D');
  t(q1, q1, 'B', 'B', 'D');
  t(q1, q2, 'b', 'B', 'E');
  t(q2, q2, 'a', 'a', 'E');
  t(q2, q2, 'B', 'B', 'E');
  t(q2, q0, 'A', 'A', 'D');
  t(q3, q3, 'B', 'B', 'D');
  t(q3, q4, '', '', 'E');
  return m;
}
