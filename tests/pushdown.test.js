import { describe, test, assert, assertEqual } from './runner.js';
import {
  addState,
  addTransition,
  createAutomaton,
  parsePushdownTuple,
  setInitial,
  stackAlphabet,
  toggleFinal,
  transitionLabel,
  validate,
} from '../src/core/model.js';
import { acceptsPushdown, simulatePushdown } from '../src/core/pushdown.js';
import { parseJFF, serializeJFF } from '../src/io/jff.js';

/**
 * Constrói um PDA a partir de uma descrição enxuta.
 * @param {{accept?:'final'|'empty', states:Array<[string,{i?:boolean,f?:boolean}?]>,
 *          moves:Array<[string,string,string,string,string]>}} spec
 */
function pda({ accept = 'final', states, moves }) {
  const m = createAutomaton('pda');
  m.accept = accept;
  const id = new Map();
  states.forEach(([name, opts = {}], i) => {
    const s = addState(m, i * 80, 0, { name });
    id.set(name, s.id);
    if (opts.i) setInitial(m, s.id);
    if (opts.f) toggleFinal(m, s.id);
  });
  for (const [from, to, read, pop, push] of moves) {
    addTransition(m, id.get(from), id.get(to), read, { pop, push });
  }
  return m;
}

// aⁿbⁿ, n ≥ 0, aceitação por estado final. O estado q3 só é alcançado por uma
// λ-transição que exige o Z no topo — é isso que impede aceitar sobras de 'a'.
const anbnFinal = () =>
  pda({
    accept: 'final',
    states: [['q0', { i: true, f: true }], ['q1'], ['q2'], ['q3', { f: true }]],
    moves: [
      ['q0', 'q1', 'a', 'Z', 'aZ'],
      ['q1', 'q1', 'a', 'a', 'aa'],
      ['q1', 'q2', 'b', 'a', ''],
      ['q2', 'q2', 'b', 'a', ''],
      ['q2', 'q3', '', 'Z', 'Z'],
    ],
  });

// aⁿbⁿ, n ≥ 1, aceitação por pilha vazia (esvazia o Z no fim).
const anbnEmpty = () =>
  pda({
    accept: 'empty',
    states: [['q0', { i: true }], ['q1']],
    moves: [
      ['q0', 'q0', 'a', 'Z', 'aZ'],
      ['q0', 'q0', 'a', 'a', 'aa'],
      ['q0', 'q1', 'b', 'a', ''],
      ['q1', 'q1', 'b', 'a', ''],
      ['q1', 'q1', '', 'Z', ''],
    ],
  });

// Palíndromos pares w wᴿ sobre {a,b}: não-determinístico (adivinha o meio).
const evenPalindrome = () =>
  pda({
    accept: 'empty',
    states: [['q0', { i: true }], ['q1']],
    moves: [
      ['q0', 'q0', 'a', 'Z', 'aZ'],
      ['q0', 'q0', 'b', 'Z', 'bZ'],
      ['q0', 'q0', 'a', 'a', 'aa'],
      ['q0', 'q0', 'a', 'b', 'ab'],
      ['q0', 'q0', 'b', 'a', 'ba'],
      ['q0', 'q0', 'b', 'b', 'bb'],
      ['q0', 'q1', '', 'Z', 'Z'],
      ['q0', 'q1', '', 'a', 'a'],
      ['q0', 'q1', '', 'b', 'b'],
      ['q1', 'q1', 'a', 'a', ''],
      ['q1', 'q1', 'b', 'b', ''],
      ['q1', 'q1', '', 'Z', ''],
    ],
  });

describe('PDA: aⁿbⁿ por estado final', () => {
  test('aceita as cadeias da linguagem, incluindo n = 0', () => {
    const m = anbnFinal();
    for (const w of ['', 'ab', 'aabb', 'aaabbb', 'aaaabbbb']) {
      assert(acceptsPushdown(m, w), `deveria aceitar "${w}"`);
    }
  });

  test('rejeita contagens ou ordens erradas', () => {
    const m = anbnFinal();
    for (const w of ['a', 'b', 'aab', 'abb', 'ba', 'abab', 'aabbb', 'aaabb']) {
      assert(!acceptsPushdown(m, w), `não deveria aceitar "${w}"`);
    }
  });

  test('a sobra de a no topo impede a aceitação (não ignora a pilha)', () => {
    // "aab": em q2 sobra "aZ"; a λ-transição para q3 exige Z no topo
    const r = simulatePushdown(anbnFinal(), 'aab');
    assertEqual(r.accepted, false);
    assertEqual(r.halted, 'rejeitou');
  });
});

describe('PDA: aⁿbⁿ por pilha vazia', () => {
  test('aceita n ≥ 1 e rejeita a vazia', () => {
    const m = anbnEmpty();
    for (const w of ['ab', 'aabb', 'aaabbb']) assert(acceptsPushdown(m, w), `deveria aceitar "${w}"`);
    for (const w of ['', 'a', 'aab', 'abb', 'ba']) assert(!acceptsPushdown(m, w), `não deveria aceitar "${w}"`);
  });

  test('o modo de aceitação importa: por estado final aceitaria diferente', () => {
    const m = anbnEmpty();
    // sem estado final e por pilha vazia, "ab" aceita; trocando para final, não
    assert(acceptsPushdown(m, 'ab'), 'por pilha vazia deveria aceitar');
    m.accept = 'final';
    assert(!acceptsPushdown(m, 'ab'), 'sem estado final, por estado final não aceita nada');
  });
});

describe('PDA: não-determinismo (palíndromos pares)', () => {
  test('aceita w wᴿ', () => {
    const m = evenPalindrome();
    for (const w of ['', 'aa', 'bb', 'abba', 'baab', 'aabbaa', 'abaaba']) {
      assert(acceptsPushdown(m, w), `deveria aceitar "${w}"`);
    }
  });

  test('rejeita o que não é palíndromo par', () => {
    const m = evenPalindrome();
    for (const w of ['a', 'ab', 'aba', 'abab', 'aab', 'abb']) {
      assert(!acceptsPushdown(m, w), `não deveria aceitar "${w}"`);
    }
  });
});

describe('PDA: modelo e rótulos', () => {
  test('o rótulo da transição segue o formato do JFLAP', () => {
    const m = anbnFinal();
    const t = m.transitions[0]; // q0 -a,Z;aZ-> q1
    assertEqual(transitionLabel(m, t), 'a, Z ; aZ');
    const lam = m.transitions.find((x) => x.read === '' && x.pop === 'Z'); // q2 -λ,Z;Z-> q3
    assertEqual(transitionLabel(m, lam), 'λ, Z ; Z');
  });

  test('parsePushdownTuple entende vírgula, ponto e vírgula e λ', () => {
    assertEqual(parsePushdownTuple('a, Z ; aZ'), { read: 'a', pop: 'Z', push: 'aZ' });
    assertEqual(parsePushdownTuple('a, a, aa'), { read: 'a', pop: 'a', push: 'aa' });
    assertEqual(parsePushdownTuple('λ, Z ; λ'), { read: '', pop: 'Z', push: '' });
    assertEqual(parsePushdownTuple(' , , '), { read: '', pop: '', push: '' });
  });

  test('stackAlphabet reúne pop, push e o fundo', () => {
    assertEqual(stackAlphabet(anbnFinal()), ['Z', 'a']);
  });

  test('por pilha vazia, não reclama da falta de estado final', () => {
    assertEqual(validate(anbnEmpty()), []);
  });
});

describe('PDA: ida e volta pelo .jff', () => {
  test('serializa e relê preservando tipo e comportamento', () => {
    const xml = serializeJFF(anbnFinal());
    assert(xml.includes('<type>pda</type>'), 'o tipo deveria ser pda');
    assert(xml.includes('<pop>Z</pop>') && xml.includes('<push>aZ</push>'), 'pop/push no XML');
    const volta = parseJFF(xml).automaton;
    assertEqual(volta.type, 'pda');
    assert(acceptsPushdown(volta, 'aabb') && !acceptsPushdown(volta, 'aab'), 'mudou de comportamento');
  });

  test('pop/push vazios viram <pop/> <push/> e voltam como λ', () => {
    const xml = serializeJFF(anbnFinal());
    assert(xml.includes('<push/>'), 'push vazio deveria virar tag vazia');
    const t = parseJFF(xml).automaton.transitions.find((x) => x.read === 'b');
    assertEqual(t.push, '');
  });
});
