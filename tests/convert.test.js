import { describe, test, assert, assertEqual, assertThrows } from './runner.js';
import { addState, addTransition, alphabet, createAutomaton } from '../src/core/model.js';
import {
  ConversionError,
  areEquivalent,
  minimizeDFA,
  removeUnreachable,
  removeUseless,
  subsetConstruction,
} from '../src/core/convert.js';
import { accepts, isDeterministic } from '../src/core/simulate.js';

/** NFA das cadeias sobre {0,1} que terminam em "01" — o exemplo clássico. */
function nfaTermina01() {
  const a = createAutomaton();
  const q0 = addState(a, 0, 0, { name: 'q0', initial: true });
  const q1 = addState(a, 0, 0, { name: 'q1' });
  const q2 = addState(a, 0, 0, { name: 'q2', final: true });
  addTransition(a, q0.id, q0.id, '0');
  addTransition(a, q0.id, q0.id, '1');
  addTransition(a, q0.id, q1.id, '0');
  addTransition(a, q1.id, q2.id, '1');
  return a;
}

/** NFA-λ que aceita a*b. */
function nfaComLambda() {
  const a = createAutomaton();
  const q0 = addState(a, 0, 0, { name: 'q0', initial: true });
  const q1 = addState(a, 0, 0, { name: 'q1' });
  const q2 = addState(a, 0, 0, { name: 'q2', final: true });
  addTransition(a, q0.id, q0.id, 'a');
  addTransition(a, q0.id, q1.id, '');
  addTransition(a, q1.id, q2.id, 'b');
  return a;
}

/**
 * DFA com redundância de propósito: q1 e q2 são equivalentes, e q3 é
 * inalcançável.
 */
function dfaRedundante() {
  const a = createAutomaton();
  const q0 = addState(a, 0, 0, { name: 'q0', initial: true });
  const q1 = addState(a, 0, 0, { name: 'q1', final: true });
  const q2 = addState(a, 0, 0, { name: 'q2', final: true });
  const q3 = addState(a, 0, 0, { name: 'q3' });
  addTransition(a, q0.id, q1.id, 'a');
  addTransition(a, q0.id, q2.id, 'b');
  addTransition(a, q1.id, q1.id, 'a');
  addTransition(a, q1.id, q2.id, 'b');
  addTransition(a, q2.id, q1.id, 'a');
  addTransition(a, q2.id, q2.id, 'b');
  addTransition(a, q3.id, q0.id, 'a');
  return a;
}

const CADEIAS_01 = ['', '0', '1', '01', '10', '001', '0101', '1101', '0110', '11', '00'];
const CADEIAS_AB = ['', 'a', 'b', 'ab', 'ba', 'aab', 'aba', 'bb', 'aaab'];

function mesmaLinguagem(a, b, cadeias) {
  for (const input of cadeias) {
    if (accepts(a, input) !== accepts(b, input)) return input;
  }
  return null;
}

describe('convert: NFA para DFA', () => {
  test('o resultado é determinístico', () => {
    const { automaton } = subsetConstruction(nfaTermina01());
    assert(isDeterministic(automaton), 'o DFA gerado ainda tem não-determinismo');
  });

  test('preserva a linguagem', () => {
    const nfa = nfaTermina01();
    const { automaton } = subsetConstruction(nfa);
    assertEqual(mesmaLinguagem(nfa, automaton, CADEIAS_01), null);
  });

  test('elimina as transições λ', () => {
    const nfa = nfaComLambda();
    const { automaton } = subsetConstruction(nfa);
    assert(!automaton.transitions.some((t) => t.read === ''), 'sobrou transição λ');
    assertEqual(mesmaLinguagem(nfa, automaton, CADEIAS_AB), null);
  });

  test('cada estado do DFA é um conjunto de estados do NFA', () => {
    const { automaton, mapping } = subsetConstruction(nfaTermina01());
    assertEqual(mapping.size, automaton.states.length);
    const inicial = automaton.states.find((s) => s.initial);
    assertEqual(mapping.get(inicial.id), [0]);
  });

  test('o conjunto inicial já vem fechado sob λ', () => {
    const { automaton, mapping } = subsetConstruction(nfaComLambda());
    const inicial = automaton.states.find((s) => s.initial);
    assertEqual(mapping.get(inicial.id), [0, 1]);
  });

  test('conjunto vazio não vira estado: o DFA sai parcial', () => {
    const a = createAutomaton();
    const q0 = addState(a, 0, 0, { name: 'q0', initial: true });
    const q1 = addState(a, 0, 0, { name: 'q1', final: true });
    addTransition(a, q0.id, q1.id, 'a');
    addTransition(a, q0.id, q0.id, 'b');
    const { automaton } = subsetConstruction(a);
    // de q1 não há transição com 'a' nem com 'b': nenhum estado de erro criado
    assert(automaton.states.length <= 2, `estados demais: ${automaton.states.length}`);
  });

  test('há exatamente um estado inicial', () => {
    const { automaton } = subsetConstruction(nfaTermina01());
    assertEqual(automaton.states.filter((s) => s.initial).length, 1);
  });

  test('autômato sem estado inicial gera autômato vazio', () => {
    const a = nfaTermina01();
    for (const s of a.states) s.initial = false;
    assertEqual(subsetConstruction(a).automaton.states.length, 0);
  });
});

describe('convert: remoções', () => {
  test('remove o inalcançável e nada mais', () => {
    const a = dfaRedundante();
    assertEqual(removeUnreachable(a), 1);
    assert(!a.states.some((s) => s.name === 'q3'), 'q3 deveria ter sumido');
    assertEqual(a.states.length, 3);
  });

  test('remover inalcançável não altera a linguagem', () => {
    const original = dfaRedundante();
    const podado = dfaRedundante();
    removeUnreachable(podado);
    assertEqual(mesmaLinguagem(original, podado, CADEIAS_AB), null);
  });

  test('remove estados que não levam a nenhum final', () => {
    const a = createAutomaton();
    const q0 = addState(a, 0, 0, { name: 'q0', initial: true });
    const q1 = addState(a, 0, 0, { name: 'q1', final: true });
    const morto = addState(a, 0, 0, { name: 'morto' });
    addTransition(a, q0.id, q1.id, 'a');
    addTransition(a, q0.id, morto.id, 'b');
    addTransition(a, morto.id, morto.id, 'a');
    assertEqual(removeUseless(a), 1);
    assert(!a.states.some((s) => s.name === 'morto'), 'o sumidouro deveria ter sumido');
  });

  test('remover inúteis não altera a linguagem', () => {
    const original = dfaRedundante();
    const podado = dfaRedundante();
    removeUseless(podado);
    assertEqual(mesmaLinguagem(original, podado, CADEIAS_AB), null);
  });
});

describe('convert: minimização', () => {
  test('funde estados equivalentes e descarta inalcançáveis', () => {
    const { automaton, merged } = minimizeDFA(dfaRedundante());
    // q1 e q2 são equivalentes, q3 é inalcançável: sobram 2 estados
    assertEqual(automaton.states.length, 2);
    assertEqual(merged, 1);
  });

  test('preserva a linguagem', () => {
    const original = dfaRedundante();
    const { automaton } = minimizeDFA(original);
    assertEqual(mesmaLinguagem(original, automaton, CADEIAS_AB), null);
  });

  test('não altera um DFA que já é mínimo', () => {
    const minimo = minimizeDFA(dfaRedundante()).automaton;
    assertEqual(minimizeDFA(minimo).automaton.states.length, minimo.states.length);
  });

  test('o resultado continua determinístico e com um inicial', () => {
    const { automaton } = minimizeDFA(dfaRedundante());
    assert(isDeterministic(automaton), 'o resultado deveria ser determinístico');
    assertEqual(automaton.states.filter((s) => s.initial).length, 1);
  });

  test('groups mostra quais estados foram fundidos', () => {
    const { groups } = minimizeDFA(dfaRedundante());
    const fundidos = groups.find((g) => g.length > 1);
    assertEqual(fundidos?.length, 2);
  });

  test('recusa autômato não-determinístico', () => {
    assertThrows(() => minimizeDFA(nfaTermina01()));
    try {
      minimizeDFA(nfaComLambda());
    } catch (error) {
      assert(error instanceof ConversionError, 'esperava ConversionError');
      assert(error.message.includes('determinístico'), `mensagem: ${error.message}`);
    }
  });

  test('DFA parcial continua parcial', () => {
    const a = createAutomaton();
    const q0 = addState(a, 0, 0, { name: 'q0', initial: true });
    const q1 = addState(a, 0, 0, { name: 'q1', final: true });
    addTransition(a, q0.id, q1.id, 'a');
    const { automaton } = minimizeDFA(a);
    assertEqual(automaton.transitions.length, 1);
    assertEqual(automaton.states.length, 2);
  });

  test('minimizar o DFA de um NFA dá o mínimo da mesma linguagem', () => {
    const nfa = nfaTermina01();
    const dfa = subsetConstruction(nfa).automaton;
    const { automaton } = minimizeDFA(dfa);
    assertEqual(mesmaLinguagem(nfa, automaton, CADEIAS_01), null);
    // a linguagem "termina em 01" precisa de exatamente 3 estados
    assertEqual(automaton.states.length, 3);
  });
});

describe('convert: equivalência', () => {
  test('um autômato é equivalente a si mesmo', () => {
    assert(areEquivalent(dfaRedundante(), dfaRedundante()).equivalent, 'deveria ser equivalente');
  });

  test('minimizar preserva a equivalência', () => {
    const original = dfaRedundante();
    const { automaton } = minimizeDFA(original);
    assert(areEquivalent(original, automaton).equivalent, 'o mínimo deveria ser equivalente');
  });

  test('NFA e seu DFA são equivalentes', () => {
    const nfa = nfaTermina01();
    assert(areEquivalent(nfa, subsetConstruction(nfa).automaton).equivalent, 'deveriam bater');
  });

  test('linguagens diferentes são detectadas, com contraexemplo', () => {
    const a = nfaTermina01();
    const b = nfaComLambda();
    const resultado = areEquivalent(a, b);
    assert(!resultado.equivalent, 'não deveriam ser equivalentes');
    assert(resultado.counterexample !== null, 'faltou o contraexemplo');
    assertEqual(accepts(a, resultado.counterexample) !== accepts(b, resultado.counterexample), true);
  });

  test('o contraexemplo é aceito por um e rejeitado pelo outro', () => {
    const a = nfaTermina01();
    const b = createAutomaton();
    const s = addState(b, 0, 0, { name: 's', initial: true, final: true });
    addTransition(b, s.id, s.id, '0');
    addTransition(b, s.id, s.id, '1');
    const { equivalent, counterexample } = areEquivalent(a, b);
    assert(!equivalent, 'não deveriam ser equivalentes');
    assertEqual(accepts(a, counterexample) !== accepts(b, counterexample), true);
  });

  test('dois autômatos sem estado inicial são equivalentes (linguagem vazia)', () => {
    const a = createAutomaton();
    const b = createAutomaton();
    assert(areEquivalent(a, b).equivalent, 'ambos reconhecem a linguagem vazia');
  });

  test('alfabetos diferentes não confundem a comparação', () => {
    const a = createAutomaton();
    const q0 = addState(a, 0, 0, { initial: true, final: true });
    addTransition(a, q0.id, q0.id, 'a');
    const b = createAutomaton();
    const p0 = addState(b, 0, 0, { initial: true, final: true });
    addTransition(b, p0.id, p0.id, 'a');
    addTransition(b, p0.id, p0.id, 'b');
    const { equivalent, counterexample } = areEquivalent(a, b);
    assert(!equivalent, 'b aceita "b" e a não');
    assertEqual(counterexample, 'b');
  });

  test('o alfabeto do autômato não muda com a comparação', () => {
    const a = nfaTermina01();
    const antes = alphabet(a);
    areEquivalent(a, nfaComLambda());
    assertEqual(alphabet(a), antes);
  });
});
