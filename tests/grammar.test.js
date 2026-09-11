import { describe, test, assert, assertEqual, assertThrows } from './runner.js';
import { addState, addTransition, createAutomaton } from '../src/core/model.js';
import { areEquivalent } from '../src/core/convert.js';
import { accepts } from '../src/core/simulate.js';
import {
  GrammarError,
  automatonToGrammar,
  formatGrammar,
  grammarTextToAutomaton,
  grammarToAutomaton,
  parseGrammar,
} from '../src/core/grammar.js';

/** DFA sobre {0,1} que aceita cadeias terminadas em "01". */
function dfaTermina01() {
  const a = createAutomaton();
  const q0 = addState(a, 0, 0, { name: 'q0', initial: true });
  const q1 = addState(a, 0, 0, { name: 'q1' });
  const q2 = addState(a, 0, 0, { name: 'q2', final: true });
  addTransition(a, q0.id, q0.id, '1');
  addTransition(a, q0.id, q1.id, '0');
  addTransition(a, q1.id, q1.id, '0');
  addTransition(a, q1.id, q2.id, '1');
  addTransition(a, q2.id, q1.id, '0');
  addTransition(a, q2.id, q0.id, '1');
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

const CADEIAS_01 = ['', '0', '1', '01', '10', '001', '0101', '1101', '0110', '11', '00'];
const CADEIAS_AB = ['', 'a', 'b', 'ab', 'ba', 'aab', 'aaab', 'bb', 'aba'];

describe('grammar: AF para gramática', () => {
  test('o estado inicial vira a variável S', () => {
    const { start, names } = automatonToGrammar(dfaTermina01());
    assertEqual(start, 'S');
    assertEqual(names.get(0), 'S');
  });

  test('cada transição vira uma produção A -> aB', () => {
    const { productions } = automatonToGrammar(dfaTermina01());
    const doInicial = productions.filter((p) => p.left === 'S').map((p) => p.right);
    // q0 lê 1 e volta para q0 (S), lê 0 e vai para q1 (A)
    assertEqual(doInicial.sort(), ['0A', '1S']);
  });

  test('estado final ganha a produção λ', () => {
    const { productions, names } = automatonToGrammar(dfaTermina01());
    const finalVar = names.get(2);
    assert(
      productions.some((p) => p.left === finalVar && p.right === 'λ'),
      `faltou ${finalVar} -> λ`,
    );
  });

  test('transição λ vira produção unitária', () => {
    const { productions, names } = automatonToGrammar(nfaComLambda());
    const destino = names.get(1);
    assert(
      productions.some((p) => p.left === 'S' && p.right === destino),
      `faltou S -> ${destino}`,
    );
  });

  test('a impressão agrupa por variável', () => {
    const texto = formatGrammar([
      { left: 'S', right: '0A' },
      { left: 'S', right: '1S' },
      { left: 'A', right: 'λ' },
    ]);
    assertEqual(texto, 'S -> 0A | 1S\nA -> λ');
  });

  test('autômato sem estado inicial não tem variável inicial', () => {
    const a = dfaTermina01();
    for (const s of a.states) s.initial = false;
    assertEqual(automatonToGrammar(a).start, null);
  });
});

describe('grammar: leitura do texto', () => {
  test('lê produções separadas por |', () => {
    const productions = parseGrammar('S -> aA | b | λ');
    assertEqual(productions, [
      { left: 'S', right: 'aA' },
      { left: 'S', right: 'b' },
      { left: 'S', right: 'λ' },
    ]);
  });

  test('aceita → e ::= como seta', () => {
    assertEqual(parseGrammar('S → a')[0].right, 'a');
    assertEqual(parseGrammar('S ::= a')[0].right, 'a');
  });

  test('! é sinônimo de λ', () => {
    assertEqual(parseGrammar('S -> !')[0].right, 'λ');
  });

  test('linhas vazias e comentários são ignorados', () => {
    assertEqual(parseGrammar('# comentário\n\nS -> a\n').length, 1);
  });

  test('recusa linha sem seta, apontando o número da linha', () => {
    let message = '';
    try {
      parseGrammar('S -> a\nA a');
    } catch (error) {
      assert(error instanceof GrammarError, 'esperava GrammarError');
      message = error.message;
    }
    assert(message.includes('Linha 2'), `mensagem: ${message}`);
  });

  test('recusa lado esquerdo que não é variável', () => {
    assertThrows(() => parseGrammar('ab -> a'));
    assertThrows(() => parseGrammar('s -> a'));
  });

  test('recusa lado direito vazio', () => {
    assertThrows(() => parseGrammar('S -> a |'));
  });

  test('recusa gramática sem nenhuma produção', () => {
    assertThrows(() => parseGrammar('\n\n# só comentário'));
  });
});

describe('grammar: gramática para AF', () => {
  test('reconhece a linguagem de S -> aS | b', () => {
    const a = grammarTextToAutomaton('S -> aS | b');
    for (const input of ['b', 'ab', 'aaab']) assert(accepts(a, input), `deveria aceitar "${input}"`);
    for (const input of ['', 'a', 'ba', 'bb']) assert(!accepts(a, input), `não deveria aceitar "${input}"`);
  });

  test('S -> λ faz o inicial ser final', () => {
    const a = grammarTextToAutomaton('S -> aS | λ');
    assert(accepts(a, ''), 'deveria aceitar λ');
    assert(accepts(a, 'aaa'), 'deveria aceitar "aaa"');
    assert(!accepts(a, 'b'), 'não deveria aceitar "b"');
  });

  test('produção unitária vira transição λ', () => {
    const a = grammarTextToAutomaton('S -> A\nA -> b');
    assert(a.transitions.some((t) => t.read === ''), 'faltou a transição λ');
    assert(accepts(a, 'b'), 'deveria aceitar "b"');
  });

  test('terminal de mais de um símbolo vira uma transição só', () => {
    // linguagem (ab)*c
    const a = grammarTextToAutomaton('S -> abS | c');
    for (const input of ['c', 'abc', 'ababc']) {
      assert(accepts(a, input), `deveria aceitar "${input}"`);
    }
    for (const input of ['', 'ab', 'abab', 'ac', 'abcc']) {
      assert(!accepts(a, input), `não deveria aceitar "${input}"`);
    }
  });

  test('a variável inicial é S quando existe', () => {
    const a = grammarTextToAutomaton('A -> aS\nS -> b');
    assertEqual(a.states.find((s) => s.initial)?.name, 'S');
  });

  test('sem S, a primeira variável é a inicial', () => {
    const a = grammarTextToAutomaton('A -> aB\nB -> b');
    assertEqual(a.states.find((s) => s.initial)?.name, 'A');
  });

  test('o estado final único só é criado quando necessário', () => {
    const semTerminalPuro = grammarToAutomaton([{ left: 'S', right: 'λ' }]);
    assert(!semTerminalPuro.states.some((s) => s.name === 'F'), 'não deveria criar F');
    const comTerminalPuro = grammarToAutomaton([{ left: 'S', right: 'a' }]);
    assert(comTerminalPuro.states.some((s) => s.name === 'F'), 'deveria criar F');
  });
});

describe('grammar: ida e volta', () => {
  test('DFA -> gramática -> AF preserva a linguagem', () => {
    const original = dfaTermina01();
    const { productions } = automatonToGrammar(original);
    const volta = grammarToAutomaton(productions);
    const { equivalent, counterexample } = areEquivalent(original, volta);
    assert(equivalent, `divergiram em "${counterexample}"`);
    for (const input of CADEIAS_01) {
      assertEqual(accepts(volta, input), accepts(original, input), `divergiu em "${input}"`);
    }
  });

  test('NFA-λ -> gramática -> AF preserva a linguagem', () => {
    const original = nfaComLambda();
    const volta = grammarToAutomaton(automatonToGrammar(original).productions);
    assert(areEquivalent(original, volta).equivalent, 'deveriam ser equivalentes');
    for (const input of CADEIAS_AB) {
      assertEqual(accepts(volta, input), accepts(original, input), `divergiu em "${input}"`);
    }
  });

  test('o texto impresso é relido sem perda', () => {
    const { productions } = automatonToGrammar(dfaTermina01());
    assertEqual(parseGrammar(formatGrammar(productions)), productions);
  });
});
