import { describe, test, assert, assertEqual, assertThrows } from './runner.js';
import { parseJFF, serializeJFF, JFFError } from '../src/io/jff.js';
import { alphabet, createAutomaton, addState, addTransition } from '../src/core/model.js';
import {
  DFA_TERMINA_01,
  NFA_COM_LAMBDA,
  FA_INCONSISTENTE,
  GRAMATICA,
  JFLAP4_SEM_AUTOMATON,
} from './fixtures.js';

/** Forma normalizada, para comparar dois autômatos ignorando ids internos. */
function normalize(automaton) {
  return {
    states: automaton.states.map((s) => ({
      id: s.id,
      name: s.name,
      x: s.x,
      y: s.y,
      initial: s.initial,
      final: s.final,
      label: s.label,
    })),
    transitions: automaton.transitions.map((t) => ({ from: t.from, to: t.to, read: t.read })),
    notes: automaton.notes,
  };
}

describe('parseJFF', () => {
  test('lê estados e transições de um DFA do JFLAP', () => {
    const { automaton, warnings } = parseJFF(DFA_TERMINA_01);
    assertEqual(warnings, []);
    assertEqual(automaton.states.length, 3);
    assertEqual(automaton.transitions.length, 6);
    assertEqual(automaton.states.map((s) => s.name), ['q0', 'q1', 'q2']);
  });

  test('preserva coordenadas, inicial e final', () => {
    const { automaton } = parseJFF(DFA_TERMINA_01);
    const [q0, q1, q2] = automaton.states;
    assertEqual([q0.x, q0.y], [110, 150]);
    assert(q0.initial, 'q0 deveria ser inicial');
    assert(!q1.initial && !q1.final, 'q1 não deveria ter marcações');
    assert(q2.final, 'q2 deveria ser final');
  });

  test('<read/> vazio vira lambda (string vazia)', () => {
    const { automaton } = parseJFF(NFA_COM_LAMBDA);
    const lambda = automaton.transitions.find((t) => t.read === '');
    assert(lambda, 'transição lambda não encontrada');
    assertEqual([lambda.from, lambda.to], [0, 1]);
    // lambda não entra no alfabeto de entrada
    assertEqual(alphabet(automaton), ['a']);
  });

  test('preserva <label> de estado e coordenada fracionária', () => {
    const { automaton } = parseJFF(NFA_COM_LAMBDA);
    assertEqual(automaton.states[0].label, 'início');
    assertEqual(automaton.states[1].x, 250.5);
  });

  test('avisa e corrige múltiplos estados iniciais', () => {
    const { automaton, warnings } = parseJFF(FA_INCONSISTENTE);
    assertEqual(automaton.states.filter((s) => s.initial).length, 1);
    assert(warnings.some((w) => w.includes('iniciais')), `avisos: ${warnings}`);
  });

  test('descarta transição para estado inexistente, sem quebrar', () => {
    const { automaton, warnings } = parseJFF(FA_INCONSISTENTE);
    assertEqual(automaton.transitions.length, 1);
    assert(warnings.some((w) => w.includes('descartada')), `avisos: ${warnings}`);
  });

  test('lê o formato do JFLAP 4, sem o invólucro <automaton>', () => {
    const { automaton } = parseJFF(JFLAP4_SEM_AUTOMATON);
    assertEqual(automaton.states.length, 2);
    assertEqual(automaton.transitions.length, 1);
    assert(automaton.states[1].initial, 'o estado 0 deveria ser inicial');
    assert(automaton.states[0].final, 'o estado 3 deveria ser final');
  });

  test('sem atributo name, o estado recebe o nome do id', () => {
    const { automaton } = parseJFF(JFLAP4_SEM_AUTOMATON);
    assertEqual(automaton.states.map((s) => s.name), ['q3', 'q0']);
  });

  test('<read></read> também é lambda', () => {
    const { automaton } = parseJFF(JFLAP4_SEM_AUTOMATON);
    assertEqual(automaton.transitions[0].read, '');
  });

  test('recusa tipos ainda não suportados com mensagem clara', () => {
    let message = '';
    try {
      parseJFF(GRAMATICA);
    } catch (error) {
      assert(error instanceof JFFError, 'esperava JFFError');
      message = error.message;
    }
    assert(message.includes('gramática'), `mensagem pouco clara: ${message}`);
  });

  test('recusa XML malformado', () => {
    assertThrows(() => parseJFF('<structure><type>fa</type>'));
  });

  test('recusa arquivo que não é .jff', () => {
    assertThrows(() => parseJFF('<html><body>oi</body></html>'));
  });
});

describe('serializeJFF', () => {
  test('ida e volta preserva o autômato', () => {
    const original = parseJFF(DFA_TERMINA_01).automaton;
    const roundTripped = parseJFF(serializeJFF(original)).automaton;
    assertEqual(normalize(roundTripped), normalize(original));
  });

  test('ida e volta preserva lambda e label', () => {
    const original = parseJFF(NFA_COM_LAMBDA).automaton;
    const roundTripped = parseJFF(serializeJFF(original)).automaton;
    assertEqual(normalize(roundTripped), normalize(original));
  });

  test('grava lambda como <read/> vazio, como o JFLAP espera', () => {
    const automaton = createAutomaton();
    const a = addState(automaton, 0, 0);
    const b = addState(automaton, 100, 0);
    addTransition(automaton, a.id, b.id, '');
    assert(serializeJFF(automaton).includes('<read/>'), 'esperava <read/>');
  });

  test('escapa caracteres especiais de XML', () => {
    const automaton = createAutomaton();
    addState(automaton, 0, 0, { name: 'a<b&c' });
    const xml = serializeJFF(automaton);
    assert(xml.includes('a&lt;b&amp;c'), 'nome não foi escapado');
    assertEqual(parseJFF(xml).automaton.states[0].name, 'a<b&c');
  });

  test('gera coordenadas em ponto flutuante como o JFLAP', () => {
    const automaton = createAutomaton();
    addState(automaton, 110, 150);
    assert(serializeJFF(automaton).includes('<x>110.0</x>'), 'esperava 110.0');
  });
});
