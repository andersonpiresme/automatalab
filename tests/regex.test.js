import { describe, test, assert, assertEqual, assertThrows } from './runner.js';
import { addState, addTransition, createAutomaton } from '../src/core/model.js';
import { areEquivalent } from '../src/core/convert.js';
import { accepts } from '../src/core/simulate.js';
import {
  NOTHING,
  RegexError,
  automatonToRegex,
  automatonToRegexNode,
  formatRegex,
  parseRegex,
  regexToAutomaton,
  thompson,
} from '../src/core/regex.js';

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

const CADEIAS_01 = ['', '0', '1', '01', '10', '001', '0101', '1101', '0110', '11', '00', '10101'];
const CADEIAS_AB = ['', 'a', 'b', 'ab', 'ba', 'abb', 'aabb', 'babb', 'abba', 'bb', 'aab'];

function ida(texto) {
  return formatRegex(parseRegex(texto));
}

describe('regex: análise e impressão', () => {
  test('símbolos, concatenação, união e fecho', () => {
    assertEqual(ida('a'), 'a');
    assertEqual(ida('ab'), 'ab');
    assertEqual(ida('a+b'), 'a+b');
    assertEqual(ida('a*'), 'a*');
  });

  test('| é sinônimo de +', () => {
    assertEqual(ida('a|b'), 'a+b');
  });

  test('λ e ! são a cadeia vazia', () => {
    assertEqual(ida('λ'), 'λ');
    assertEqual(ida('!'), 'λ');
  });

  test('a impressão só põe parênteses onde a precedência exige', () => {
    assertEqual(ida('ab+c'), 'ab+c');
    assertEqual(ida('(ab)+c'), 'ab+c');
    assertEqual(ida('a(b+c)'), 'a(b+c)');
    assertEqual(ida('(a+b)*'), '(a+b)*');
    assertEqual(ida('(ab)*'), '(ab)*');
    assertEqual(ida('ab*'), 'ab*');
  });

  test('parênteses redundantes somem', () => {
    assertEqual(ida('((a))'), 'a');
    assertEqual(ida('(a)(b)'), 'ab');
  });

  test('a**  é simplificado para a*', () => {
    assertEqual(ida('a**'), 'a*');
  });

  test('espaços em branco são ignorados', () => {
    assertEqual(ida(' a  +  b '), 'a+b');
  });

  test('recusa expressão vazia', () => {
    assertThrows(() => parseRegex(''));
  });

  test('recusa operando faltando', () => {
    assertThrows(() => parseRegex('a+'));
    assertThrows(() => parseRegex('+a'));
    assertThrows(() => parseRegex('*a'));
  });

  test('recusa parênteses desbalanceados, com mensagem clara', () => {
    assertThrows(() => parseRegex('(a'));
    let message = '';
    try {
      parseRegex('a)');
    } catch (error) {
      assert(error instanceof RegexError, 'esperava RegexError');
      message = error.message;
    }
    assert(message.toLowerCase().includes('parêntese'), `mensagem: ${message}`);
  });
});

describe('regex: ER para AF (Thompson)', () => {
  test('reconhece a linguagem de (a+b)*abb', () => {
    const a = regexToAutomaton('(a+b)*abb');
    for (const input of ['abb', 'aabb', 'babb', 'ababb']) {
      assert(accepts(a, input), `deveria aceitar "${input}"`);
    }
    for (const input of ['', 'ab', 'abba', 'b', 'aab']) {
      assert(!accepts(a, input), `não deveria aceitar "${input}"`);
    }
  });

  test('a* aceita a cadeia vazia', () => {
    const a = regexToAutomaton('a*');
    assert(accepts(a, ''), 'deveria aceitar λ');
    assert(accepts(a, 'aaa'), 'deveria aceitar "aaa"');
    assert(!accepts(a, 'b'), 'não deveria aceitar "b"');
  });

  test('λ aceita apenas a cadeia vazia', () => {
    const a = regexToAutomaton('λ');
    assert(accepts(a, ''), 'deveria aceitar λ');
    assert(!accepts(a, 'a'), 'não deveria aceitar "a"');
  });

  test('a união aceita os dois lados', () => {
    const a = regexToAutomaton('ab+ba');
    assert(accepts(a, 'ab') && accepts(a, 'ba'), 'deveria aceitar os dois');
    assert(!accepts(a, 'aa') && !accepts(a, 'abba'), 'não deveria aceitar os outros');
  });

  test('há exatamente um estado inicial e um final', () => {
    const a = regexToAutomaton('(a+b)*abb');
    assertEqual(a.states.filter((s) => s.initial).length, 1);
    assertEqual(a.states.filter((s) => s.final).length, 1);
  });

  test('∅ não aceita nada', () => {
    const a = thompson(NOTHING);
    for (const input of ['', 'a', 'ab']) {
      assert(!accepts(a, input), `não deveria aceitar "${input}"`);
    }
  });
});

describe('regex: AF para ER (eliminação de estados)', () => {
  test('a expressão gerada reconhece a mesma linguagem', () => {
    const dfa = dfaTermina01();
    const expressao = automatonToRegex(dfa);
    const volta = regexToAutomaton(expressao);
    const { equivalent, counterexample } = areEquivalent(dfa, volta);
    assert(equivalent, `divergiram em "${counterexample}" (ER: ${expressao})`);
  });

  test('ida e volta preserva a linguagem de (a+b)*abb', () => {
    const original = regexToAutomaton('(a+b)*abb');
    const expressao = automatonToRegex(original);
    const volta = regexToAutomaton(expressao);
    assert(areEquivalent(original, volta).equivalent, `ER gerada: ${expressao}`);
    for (const input of CADEIAS_AB) {
      assertEqual(accepts(volta, input), accepts(original, input), `divergiu em "${input}"`);
    }
  });

  test('a expressão gerada é sintaticamente válida', () => {
    const expressao = automatonToRegex(dfaTermina01());
    // se não fosse, parseRegex lançaria
    assertEqual(formatRegex(parseRegex(expressao)), expressao);
  });

  test('sem estado final a linguagem é vazia', () => {
    const a = dfaTermina01();
    for (const s of a.states) s.final = false;
    assertEqual(automatonToRegexNode(a), NOTHING);
    assertEqual(automatonToRegex(a), '∅');
  });

  test('sem estado inicial a linguagem é vazia', () => {
    const a = dfaTermina01();
    for (const s of a.states) s.initial = false;
    assertEqual(automatonToRegex(a), '∅');
  });

  test('estado inicial que também é final aceita λ', () => {
    const a = createAutomaton();
    addState(a, 0, 0, { name: 'q0', initial: true, final: true });
    const volta = regexToAutomaton(automatonToRegex(a));
    assert(accepts(volta, ''), 'deveria aceitar λ');
    assert(!accepts(volta, 'a'), 'não deveria aceitar "a"');
  });

  test('não altera o autômato de origem', () => {
    const a = dfaTermina01();
    const antes = JSON.stringify(a);
    automatonToRegex(a);
    assertEqual(JSON.stringify(a), antes);
  });

  test('laços viram fecho de Kleene', () => {
    const a = createAutomaton();
    const q0 = addState(a, 0, 0, { name: 'q0', initial: true, final: true });
    addTransition(a, q0.id, q0.id, 'a');
    const volta = regexToAutomaton(automatonToRegex(a));
    for (const input of ['', 'a', 'aaaa']) {
      assert(accepts(volta, input), `deveria aceitar "${input}"`);
    }
    assert(!accepts(volta, 'b'), 'não deveria aceitar "b"');
  });

  test('o DFA de "termina em 01" bate cadeia a cadeia com a ER', () => {
    const dfa = dfaTermina01();
    const volta = regexToAutomaton(automatonToRegex(dfa));
    for (const input of CADEIAS_01) {
      assertEqual(accepts(volta, input), accepts(dfa, input), `divergiu em "${input}"`);
    }
  });
});
