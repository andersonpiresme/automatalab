import { describe, test, assert, assertEqual } from './runner.js';
import {
  addState,
  addTransition,
  alphabet,
  createAutomaton,
  displaySymbol,
  groupTransitions,
  nextStateId,
  parseSymbol,
  removeState,
  setInitial,
  toggleFinal,
  validate,
} from '../src/core/model.js';

function automatonComDoisEstados() {
  const automaton = createAutomaton();
  const a = addState(automaton, 0, 0);
  const b = addState(automaton, 100, 0);
  return { automaton, a, b };
}

describe('model: estados', () => {
  test('o primeiro estado criado é o inicial', () => {
    const { a, b } = automatonComDoisEstados();
    assert(a.initial, 'o primeiro deveria ser inicial');
    assert(!b.initial, 'o segundo não deveria ser inicial');
  });

  test('nomes seguem q0, q1, ...', () => {
    const { a, b } = automatonComDoisEstados();
    assertEqual([a.name, b.name], ['q0', 'q1']);
  });

  test('ids liberados por remoção são reaproveitados', () => {
    const { automaton, a } = automatonComDoisEstados();
    removeState(automaton, a.id);
    assertEqual(nextStateId(automaton), 0);
  });

  test('remover um estado remove as transições incidentes', () => {
    const { automaton, a, b } = automatonComDoisEstados();
    addTransition(automaton, a.id, b.id, 'x');
    addTransition(automaton, b.id, b.id, 'y');
    removeState(automaton, b.id);
    assertEqual(automaton.transitions.length, 0);
  });

  test('setInitial mantém apenas um estado inicial', () => {
    const { automaton, b } = automatonComDoisEstados();
    setInitial(automaton, b.id);
    assertEqual(automaton.states.filter((s) => s.initial).map((s) => s.id), [b.id]);
  });

  test('toggleFinal alterna', () => {
    const { automaton, a } = automatonComDoisEstados();
    toggleFinal(automaton, a.id);
    assert(a.final, 'deveria ser final');
    toggleFinal(automaton, a.id);
    assert(!a.final, 'não deveria mais ser final');
  });
});

describe('model: transições', () => {
  test('transições duplicadas são ignoradas', () => {
    const { automaton, a, b } = automatonComDoisEstados();
    assert(addTransition(automaton, a.id, b.id, 'x'), 'a primeira deveria ser criada');
    assert(addTransition(automaton, a.id, b.id, 'x') === null, 'a duplicata deveria ser recusada');
    assertEqual(automaton.transitions.length, 1);
  });

  test('mesmo par com símbolos diferentes gera transições distintas', () => {
    const { automaton, a, b } = automatonComDoisEstados();
    addTransition(automaton, a.id, b.id, 'x');
    addTransition(automaton, a.id, b.id, 'y');
    assertEqual(automaton.transitions.length, 2);
  });

  test('groupTransitions junta o mesmo par em uma aresta só', () => {
    const { automaton, a, b } = automatonComDoisEstados();
    addTransition(automaton, a.id, b.id, 'x');
    addTransition(automaton, a.id, b.id, 'y');
    addTransition(automaton, b.id, a.id, 'z');
    const groups = groupTransitions(automaton);
    assertEqual(groups.length, 2);
    assertEqual(groups[0].transitions.length, 2);
  });

  test('alfabeto é ordenado e não inclui lambda', () => {
    const { automaton, a, b } = automatonComDoisEstados();
    addTransition(automaton, a.id, b.id, 'b');
    addTransition(automaton, a.id, b.id, 'a');
    addTransition(automaton, a.id, b.id, '');
    assertEqual(alphabet(automaton), ['a', 'b']);
  });
});

describe('model: símbolos', () => {
  test('string vazia é exibida como λ', () => {
    assertEqual(displaySymbol(''), 'λ');
    assertEqual(displaySymbol('a'), 'a');
  });

  test('entrada vazia, λ ou "lambda" viram a transição vazia', () => {
    assertEqual(parseSymbol(''), '');
    assertEqual(parseSymbol('  '), '');
    assertEqual(parseSymbol('λ'), '');
    assertEqual(parseSymbol('Lambda'), '');
  });

  test('espaços em volta do símbolo são descartados', () => {
    assertEqual(parseSymbol(' a '), 'a');
  });
});

describe('model: validação', () => {
  test('autômato vazio não gera reclamações', () => {
    assertEqual(validate(createAutomaton()), []);
  });

  test('aponta ausência de estado final', () => {
    const { automaton } = automatonComDoisEstados();
    assert(validate(automaton).some((p) => p.includes('final')), 'esperava aviso sobre final');
  });

  test('aponta ausência de estado inicial', () => {
    const { automaton, a } = automatonComDoisEstados();
    a.initial = false;
    assert(validate(automaton).some((p) => p.includes('inicial')), 'esperava aviso sobre inicial');
  });
});
