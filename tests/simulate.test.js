import { describe, test, assert, assertEqual } from './runner.js';
import { addState, addTransition, createAutomaton } from '../src/core/model.js';
import {
  accepts,
  epsilonClosure,
  nondeterministicStates,
  runBatch,
  simulate,
  trace,
  unknownSymbols,
} from '../src/core/simulate.js';

/** DFA sobre {0,1} que aceita cadeias terminadas em "01". */
function dfaTermina01() {
  const a = createAutomaton();
  const q0 = addState(a, 0, 0, { name: 'q0', initial: true });
  const q1 = addState(a, 100, 0, { name: 'q1' });
  const q2 = addState(a, 200, 0, { name: 'q2', final: true });
  addTransition(a, q0.id, q0.id, '1');
  addTransition(a, q0.id, q1.id, '0');
  addTransition(a, q1.id, q1.id, '0');
  addTransition(a, q1.id, q2.id, '1');
  addTransition(a, q2.id, q1.id, '0');
  addTransition(a, q2.id, q0.id, '1');
  return a;
}

/** NFA-λ que aceita a* seguido de b (via λ) — exercita o fecho. */
function nfaComLambda() {
  const a = createAutomaton();
  const q0 = addState(a, 0, 0, { name: 'q0', initial: true });
  const q1 = addState(a, 100, 0, { name: 'q1' });
  const q2 = addState(a, 200, 0, { name: 'q2', final: true });
  addTransition(a, q0.id, q0.id, 'a');
  addTransition(a, q0.id, q1.id, ''); // λ
  addTransition(a, q1.id, q2.id, 'b');
  return a;
}

describe('simulate: fecho-λ', () => {
  test('fecho de um estado sem λ é ele mesmo', () => {
    const a = dfaTermina01();
    assertEqual(epsilonClosure(a, [0]), [0]);
  });

  test('fecho segue transições λ encadeadas', () => {
    const a = createAutomaton();
    const q0 = addState(a, 0, 0);
    const q1 = addState(a, 0, 0);
    const q2 = addState(a, 0, 0);
    addTransition(a, q0.id, q1.id, '');
    addTransition(a, q1.id, q2.id, '');
    assertEqual(epsilonClosure(a, [q0.id]), [q0.id, q1.id, q2.id]);
  });

  test('fecho não entra em laço com λ cíclico', () => {
    const a = createAutomaton();
    const q0 = addState(a, 0, 0);
    const q1 = addState(a, 0, 0);
    addTransition(a, q0.id, q1.id, '');
    addTransition(a, q1.id, q0.id, '');
    assertEqual(epsilonClosure(a, [q0.id]), [q0.id, q1.id]);
  });
});

describe('simulate: DFA', () => {
  test('aceita cadeias terminadas em 01', () => {
    const a = dfaTermina01();
    for (const input of ['01', '001', '1101', '0101']) {
      assert(accepts(a, input), `deveria aceitar "${input}"`);
    }
  });

  test('rejeita as demais', () => {
    const a = dfaTermina01();
    for (const input of ['', '0', '1', '10', '011', '0110']) {
      assert(!accepts(a, input), `não deveria aceitar "${input}"`);
    }
  });

  test('o caminho de aceitação tem um passo por símbolo', () => {
    const a = dfaTermina01();
    const result = simulate(a, '1101');
    const path = trace(result.accepting);
    assertEqual(path.length, 5); // configuração inicial + 4 símbolos
    assertEqual(path.map((c) => c.read), [null, '1', '1', '0', '1']);
    assertEqual(path[path.length - 1].position, 4);
  });

  test('sem estado inicial não há o que simular', () => {
    const a = dfaTermina01();
    for (const s of a.states) s.initial = false;
    const result = simulate(a, '01');
    assert(!result.accepted, 'não deveria aceitar');
    assertEqual(result.generations[0], []);
  });
});

describe('simulate: NFA com λ', () => {
  test('modo com fecho aceita usando a transição λ', () => {
    const a = nfaComLambda();
    assert(accepts(a, 'b', { closure: true }), 'deveria aceitar "b"');
    assert(accepts(a, 'aaab', { closure: true }), 'deveria aceitar "aaab"');
    assert(!accepts(a, 'ba', { closure: true }), 'não deveria aceitar "ba"');
  });

  test('modo por estado chega ao mesmo veredito', () => {
    const a = nfaComLambda();
    for (const input of ['b', 'aaab', 'a', '', 'ba']) {
      assertEqual(
        accepts(a, input, { closure: false }),
        accepts(a, input, { closure: true }),
        `divergência em "${input}"`,
      );
    }
  });

  test('modo por estado gasta um passo na transição λ', () => {
    const a = nfaComLambda();
    const comFecho = simulate(a, 'b', { closure: true }).generations.length;
    const porEstado = simulate(a, 'b', { closure: false }).generations.length;
    assert(porEstado > comFecho, `esperava mais gerações por estado (${porEstado} vs ${comFecho})`);
  });

  test('a primeira geração com fecho já inclui os estados alcançados por λ', () => {
    const a = nfaComLambda();
    const primeira = simulate(a, 'b').generations[0].map((c) => c.state);
    assertEqual(primeira.sort(), [0, 1]);
  });

  test('λ cíclico não trava a simulação', () => {
    const a = createAutomaton();
    const q0 = addState(a, 0, 0, { initial: true });
    const q1 = addState(a, 0, 0);
    addTransition(a, q0.id, q1.id, '');
    addTransition(a, q1.id, q0.id, '');
    const result = simulate(a, 'x', { closure: false });
    assert(!result.accepted, 'não deveria aceitar');
    assertEqual(result.halted, 'esgotou');
  });
});

describe('simulate: rótulos de mais de um caractere', () => {
  test('uma transição pode consumir vários símbolos', () => {
    const a = createAutomaton();
    const q0 = addState(a, 0, 0, { initial: true });
    const q1 = addState(a, 0, 0, { final: true });
    addTransition(a, q0.id, q1.id, 'ab');
    assert(accepts(a, 'ab'), 'deveria aceitar "ab"');
    assert(!accepts(a, 'a'), 'não deveria aceitar "a"');
    assert(!accepts(a, 'abc'), 'não deveria aceitar "abc"');
  });
});

describe('simulate: lote e diagnósticos', () => {
  test('runBatch devolve um veredito por entrada, na ordem', () => {
    const a = dfaTermina01();
    assertEqual(runBatch(a, ['01', '10', '']), [
      { input: '01', accepted: true },
      { input: '10', accepted: false },
      { input: '', accepted: false },
    ]);
  });

  test('não-determinismo: dois destinos com o mesmo símbolo', () => {
    const a = createAutomaton();
    const q0 = addState(a, 0, 0, { initial: true });
    const q1 = addState(a, 0, 0);
    const q2 = addState(a, 0, 0);
    addTransition(a, q0.id, q1.id, 'a');
    addTransition(a, q0.id, q2.id, 'a');
    assertEqual([...nondeterministicStates(a)], [q0.id]);
  });

  test('DFA não acusa não-determinismo', () => {
    assertEqual([...nondeterministicStates(dfaTermina01())], []);
  });

  test('λ com outra transição no mesmo estado é não-determinismo', () => {
    assertEqual([...nondeterministicStates(nfaComLambda())], [0]);
  });

  test('aponta símbolos fora do alfabeto', () => {
    assertEqual(unknownSymbols(dfaTermina01(), '01x2'), ['x', '2']);
    assertEqual(unknownSymbols(dfaTermina01(), '0101'), []);
  });
});
