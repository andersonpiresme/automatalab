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

/**
 * L = aⁿbⁿcⁿ, n ≥ 0 — a linguagem que separa MT de autômato com pilha.
 *
 * Estratégia: a cada volta marca um a→A, um b→B e um c→C, volta ao início e
 * repete. Quando não há mais a, confere que só sobraram B e C, nessa ordem.
 *
 *   q0  sobre Δ ou sobre o próximo a a marcar
 *   q1  marcou um a; procura o primeiro b (pula a e B)
 *   q2  marcou um b; procura o primeiro c (pula b e C)
 *   q3  marcou um c; volta até o último A
 *   q4  acabaram os a; confere os B
 *   q5  confere os C até o branco
 *   q6  aceita
 */
export function exampleAnBnCn() {
  const m = createAutomaton('turing');
  const q0 = addState(m, 160, 200, { name: 'q0', initial: true });
  const q1 = addState(m, 400, 200, { name: 'q1' });
  const q2 = addState(m, 640, 200, { name: 'q2' });
  const q3 = addState(m, 400, 400, { name: 'q3' });
  const q4 = addState(m, 160, 420, { name: 'q4' });
  const q5 = addState(m, 160, 620, { name: 'q5' });
  const q6 = addState(m, 700, 620, { name: 'q6', final: true });
  const t = tm(m);
  t(q0, q0, START_MARKER, START_MARKER, 'D');
  t(q0, q1, 'a', 'A', 'D');
  t(q0, q4, 'B', 'B', 'D');
  t(q0, q6, '', '', 'D'); // n = 0: a cadeia vazia pertence à linguagem
  t(q1, q1, 'a', 'a', 'D');
  t(q1, q1, 'B', 'B', 'D');
  t(q1, q2, 'b', 'B', 'D');
  t(q2, q2, 'b', 'b', 'D');
  t(q2, q2, 'C', 'C', 'D');
  t(q2, q3, 'c', 'C', 'E');
  t(q3, q3, 'C', 'C', 'E');
  t(q3, q3, 'b', 'b', 'E');
  t(q3, q3, 'B', 'B', 'E');
  t(q3, q3, 'a', 'a', 'E');
  t(q3, q0, 'A', 'A', 'D');
  t(q4, q4, 'B', 'B', 'D');
  t(q4, q5, 'C', 'C', 'D');
  t(q5, q5, 'C', 'C', 'D');
  t(q5, q6, '', '', 'D');
  return m;
}

/**
 * Somador de inteiros em notação unária: 1ᵐ+1ⁿ ⟹ 1ᵐ⁺ⁿ na fita.
 *
 * Estratégia: troca o + por 1 (ganha um 1 a mais), vai ao fim e apaga o
 * último 1. Funciona para m = 0 e n = 0 inclusive: "+" sozinho vira fita vazia.
 *
 *   q0  atravessa os 1 da primeira parcela; ao achar +, grava 1
 *   q1  atravessa os 1 da segunda parcela até o branco
 *   q2  volta um e apaga o último 1
 *   q3  aceita — o resultado está na fita
 */
export function exampleAdder() {
  const m = createAutomaton('turing');
  const q0 = addState(m, 160, 240, { name: 'q0', initial: true });
  const q1 = addState(m, 420, 240, { name: 'q1' });
  const q2 = addState(m, 680, 240, { name: 'q2' });
  const q3 = addState(m, 680, 460, { name: 'q3', final: true });
  const t = tm(m);
  t(q0, q0, START_MARKER, START_MARKER, 'D');
  t(q0, q0, '1', '1', 'D');
  t(q0, q1, '+', '1', 'D');
  t(q1, q1, '1', '1', 'D');
  t(q1, q2, '', '', 'E');
  t(q2, q3, '1', '', 'E');
  return m;
}
