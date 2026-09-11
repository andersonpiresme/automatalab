import { describe, test, assert, assertEqual, assertThrows } from './runner.js';
import {
  START_MARKER,
  addState,
  addTransition,
  createAutomaton,
  parseTuringTuple,
  tapeAlphabet,
  tapeConvention,
  transitionLabel,
  validate,
} from '../src/core/model.js';
import { parseJFF, serializeJFF } from '../src/io/jff.js';
import {
  acceptsTuring,
  formatTape,
  simulateTuring,
  tapeOutput,
  traceTuring,
} from '../src/core/turing.js';

const D = 'R';
const E = 'L';

/**
 * A MT do slide 10 da aula 9, para L = aⁿbⁿ, exatamente como está na tabela Π:
 *
 *   q0: (Δ,Δ,D)→q0  (a,A,D)→q1  (B,B,D)→q3  (ß,ß,D)→q4
 *   q1: (a,a,D)→q1  (B,B,D)→q1  (b,B,E)→q2
 *   q2: (a,a,E)→q2  (B,B,E)→q2  (A,A,D)→q0
 *   q3: (B,B,D)→q3  (ß,ß,E)→q4
 *   q4: final
 */
function anbn() {
  const m = createAutomaton('turing');
  const q0 = addState(m, 0, 0, { name: 'q0', initial: true });
  const q1 = addState(m, 0, 0, { name: 'q1' });
  const q2 = addState(m, 0, 0, { name: 'q2' });
  const q3 = addState(m, 0, 0, { name: 'q3' });
  const q4 = addState(m, 0, 0, { name: 'q4', final: true });
  const t = (from, to, read, write, move) => addTransition(m, from.id, to.id, read, { write, move });
  t(q0, q0, START_MARKER, START_MARKER, D);
  t(q0, q1, 'a', 'A', D);
  t(q0, q3, 'B', 'B', D);
  t(q0, q4, '', '', D);
  t(q1, q1, 'a', 'a', D);
  t(q1, q1, 'B', 'B', D);
  t(q1, q2, 'b', 'B', E);
  t(q2, q2, 'a', 'a', E);
  t(q2, q2, 'B', 'B', E);
  t(q2, q0, 'A', 'A', D);
  t(q3, q3, 'B', 'B', D);
  t(q3, q4, '', '', E);
  return m;
}

/** MT na convenção JFLAP: troca a por b até o branco e aceita. */
function trocaJflap() {
  const m = createAutomaton('turing');
  m.tape = 'jflap';
  const q0 = addState(m, 0, 0, { name: 'q0', initial: true });
  const q1 = addState(m, 0, 0, { name: 'q1', final: true });
  addTransition(m, q0.id, q0.id, 'a', { write: 'b', move: 'R' });
  addTransition(m, q0.id, q1.id, '', { write: '', move: 'S' });
  return m;
}

const ANBN_JFF = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<structure>
	<type>turing</type>
	<automaton>
		<state id="0" name="q0"><x>0.0</x><y>0.0</y><initial/></state>
		<state id="1" name="q1"><x>0.0</x><y>0.0</y><final/></state>
		<transition><from>0</from><to>0</to><read>Δ</read><write>Δ</write><move>R</move></transition>
		<transition><from>0</from><to>1</to><read/><write/><move>L</move></transition>
	</automaton>
</structure>`;

describe('turing: modelo', () => {
  test('transição de MT guarda gravação e movimento', () => {
    const m = anbn();
    const t = m.transitions.find((x) => x.read === 'a' && x.write === 'A');
    assertEqual([t.write, t.move], ['A', 'R']);
  });

  test('duplicata exata é ignorada, mas gravação diferente não', () => {
    const m = createAutomaton('turing');
    const q = addState(m, 0, 0);
    assert(addTransition(m, q.id, q.id, 'a', { write: 'A', move: 'R' }), 'primeira');
    assert(addTransition(m, q.id, q.id, 'a', { write: 'A', move: 'R' }) === null, 'duplicata');
    assert(addTransition(m, q.id, q.id, 'a', { write: 'B', move: 'R' }), 'gravação diferente');
  });

  test('rótulo da aresta segue o curso: (lido,gravado,E/D)', () => {
    const m = anbn();
    const t = m.transitions.find((x) => x.read === 'b');
    assertEqual(transitionLabel(m, t), '(b,B,E)');
  });

  test('branco aparece como ß na convenção Menezes', () => {
    const m = anbn();
    const t = m.transitions.find((x) => x.from === 3 && x.read === '');
    assertEqual(transitionLabel(m, t), '(ß,ß,E)');
  });

  test('branco aparece como □ na convenção JFLAP', () => {
    const m = trocaJflap();
    const t = m.transitions.find((x) => x.read === '');
    assertEqual(transitionLabel(m, t), '(□,□,S)');
  });

  test('alfabeto da fita na ordem da tabela Π do slide: Δ, entrada, auxiliares, branco', () => {
    assertEqual(tapeAlphabet(anbn()), ['Δ', 'a', 'b', 'A', 'B', '']);
  });

  test('convenção é inferida pela presença do Δ', () => {
    const m = anbn();
    delete m.tape;
    assertEqual(tapeConvention(m), 'menezes');
    const j = trocaJflap();
    delete j.tape;
    assertEqual(tapeConvention(j), 'jflap');
  });

  test('valida que Π é função', () => {
    const m = anbn();
    assertEqual(validate(m), []);
    addTransition(m, 0, 2, 'a', { write: 'a', move: 'R' });
    assert(validate(m).some((p) => p.includes('não é função')), `avisos: ${validate(m)}`);
  });
});

describe('turing: leitura de tuplas digitadas', () => {
  test('lê o formato do curso com E/D', () => {
    assertEqual(parseTuringTuple('a,A,D'), { read: 'a', write: 'A', move: 'R' });
    assertEqual(parseTuringTuple('b, B, E'), { read: 'b', write: 'B', move: 'L' });
  });

  test('aceita parênteses, ponto e vírgula e letras do JFLAP', () => {
    assertEqual(parseTuringTuple('(a,A,D)'), { read: 'a', write: 'A', move: 'R' });
    assertEqual(parseTuringTuple('a;A;R'), { read: 'a', write: 'A', move: 'R' });
    assertEqual(parseTuringTuple('a,A,L').move, 'L');
    assertEqual(parseTuringTuple('a,A,S').move, 'S');
  });

  test('branco e Δ têm vários apelidos', () => {
    assertEqual(parseTuringTuple('ß,ß,D').read, '');
    assertEqual(parseTuringTuple('_,□,D'), { read: '', write: '', move: 'R' });
    assertEqual(parseTuringTuple(',,D'), { read: '', write: '', move: 'R' });
    assertEqual(parseTuringTuple('^,Δ,D'), { read: 'Δ', write: 'Δ', move: 'R' });
  });

  test('a letra b não é branco', () => {
    assertEqual(parseTuringTuple('b,b,D').read, 'b');
  });

  test('recusa tupla incompleta e movimento inválido', () => {
    assertThrows(() => parseTuringTuple('a,A'));
    assertThrows(() => parseTuringTuple('a,A,X'));
  });
});

describe('turing: aⁿbⁿ do slide', () => {
  test('aceita as cadeias da linguagem', () => {
    const m = anbn();
    for (const w of ['', 'ab', 'aabb', 'aaabbb']) {
      assert(acceptsTuring(m, w), `deveria aceitar "${w}"`);
    }
  });

  test('rejeita as que não estão', () => {
    const m = anbn();
    for (const w of ['a', 'b', 'ba', 'aab', 'abb', 'abab', 'aabbb']) {
      assert(!acceptsTuring(m, w), `não deveria aceitar "${w}"`);
    }
  });

  test('rejeição por função indefinida, não por loop', () => {
    const r = simulateTuring(anbn(), 'ba');
    assertEqual(r.halted, 'rejeitou');
    assert(r.reason.includes('indefinida'), r.reason);
  });

  test('a fita termina toda marcada: Δ A A B B', () => {
    const r = simulateTuring(anbn(), 'aabb');
    assertEqual(tapeOutput(r.accepting), 'AABB');
  });

  test('o passo a passo reproduz o slide: cabeça começa sobre o Δ', () => {
    const r = simulateTuring(anbn(), 'aabb');
    const path = traceTuring(r.accepting);
    assertEqual(formatTape(path[0]), '[Δ] a a b b');
    assertEqual(path[0].state, 0);
  });

  test('é determinística: uma configuração por geração', () => {
    const r = simulateTuring(anbn(), 'aabb');
    assert(r.generations.every((g) => g.length === 1), 'houve ramificação');
  });

  test('conta os passos', () => {
    // Δ a a b b: 14 movimentos até q4
    assertEqual(simulateTuring(anbn(), 'aabb').steps, 14);
  });
});

describe('turing: condições de parada', () => {
  test('mover à esquerda do Δ rejeita com o motivo certo', () => {
    const m = createAutomaton('turing');
    const q0 = addState(m, 0, 0, { initial: true });
    const q1 = addState(m, 0, 0, { final: true });
    addTransition(m, q0.id, q1.id, START_MARKER, { write: START_MARKER, move: 'L' });
    const r = simulateTuring(m, 'a');
    assertEqual(r.halted, 'rejeitou');
    assert(r.reason.includes('esquerda'), r.reason);
  });

  test('na convenção JFLAP a fita cresce para a esquerda em vez de rejeitar', () => {
    const m = createAutomaton('turing');
    m.tape = 'jflap';
    const q0 = addState(m, 0, 0, { initial: true });
    const q1 = addState(m, 0, 0, { final: true });
    addTransition(m, q0.id, q1.id, 'a', { write: 'a', move: 'L' });
    const r = simulateTuring(m, 'a');
    assert(r.accepted, 'deveria aceitar');
    assertEqual(r.accepting.origin, -1);
  });

  test('loop é detectado pelo teto de passos, não trava', () => {
    const m = createAutomaton('turing');
    m.tape = 'jflap'; // cabeça já sobre o "a"; em Menezes pararia no Δ por função indefinida
    const q0 = addState(m, 0, 0, { initial: true });
    addState(m, 0, 0, { final: true });
    addTransition(m, q0.id, q0.id, 'a', { write: 'a', move: 'S' });
    const r = simulateTuring(m, 'a', { maxSteps: 50 });
    assertEqual(r.halted, 'limite');
    assertEqual(r.steps, 50);
  });

  test('sem estado inicial não há execução', () => {
    const m = anbn();
    for (const s of m.states) s.initial = false;
    assertEqual(simulateTuring(m, 'ab').halted, 'sem-inicial');
  });

  test('estado inicial que já é final aceita de imediato', () => {
    const m = createAutomaton('turing');
    addState(m, 0, 0, { initial: true, final: true });
    const r = simulateTuring(m, 'xyz');
    assert(r.accepted, 'deveria aceitar sem mover');
    assertEqual(r.steps, 0);
  });

  test('não-determinismo ramifica e aceita se algum ramo aceita', () => {
    const m = createAutomaton('turing');
    m.tape = 'jflap';
    const q0 = addState(m, 0, 0, { initial: true });
    const morto = addState(m, 0, 0);
    const fim = addState(m, 0, 0, { final: true });
    addTransition(m, q0.id, morto.id, 'a', { write: 'a', move: 'R' });
    addTransition(m, q0.id, fim.id, 'a', { write: 'a', move: 'R' });
    const r = simulateTuring(m, 'a');
    assert(r.accepted, 'um dos ramos aceita');
    assertEqual(r.generations[1].length, 2);
  });
});

describe('turing: convenção JFLAP', () => {
  test('cabeça começa no primeiro símbolo e o branco é □', () => {
    const r = simulateTuring(trocaJflap(), 'aaa');
    assertEqual(formatTape(traceTuring(r.accepting)[0], '□'), '[a] a a');
    assert(r.accepted, 'deveria aceitar');
    assertEqual(tapeOutput(r.accepting), 'bbb');
  });

  test('entrada vazia começa sobre um branco', () => {
    const r = simulateTuring(trocaJflap(), '');
    assert(r.accepted, 'deveria aceitar a cadeia vazia');
  });
});

describe('turing: .jff', () => {
  test('lê type turing com write e move', () => {
    const { automaton, warnings } = parseJFF(ANBN_JFF);
    assertEqual(automaton.type, 'turing');
    assertEqual(warnings, []);
    assertEqual(automaton.transitions.map((t) => [t.read, t.write, t.move]), [
      ['Δ', 'Δ', 'R'],
      ['', '', 'L'],
    ]);
  });

  test('infere a convenção Menezes pelo Δ', () => {
    assertEqual(parseJFF(ANBN_JFF).automaton.tape, 'menezes');
  });

  test('sem Δ infere JFLAP', () => {
    const xml = ANBN_JFF.replace(/Δ/g, 'x');
    assertEqual(parseJFF(xml).automaton.tape, 'jflap');
  });

  test('~ do JFLAP 7 vira "grava o que leu"', () => {
    const xml = ANBN_JFF.replace('<write>Δ</write>', '<write>~</write>');
    assertEqual(parseJFF(xml).automaton.transitions[0].write, 'Δ');
  });

  test('recusa máquina de várias fitas com mensagem clara', () => {
    const xml = ANBN_JFF.replace('<type>turing</type>', '<type>turing</type><tapes>2</tapes>');
    let message = '';
    try {
      parseJFF(xml);
    } catch (e) {
      message = e.message;
    }
    assert(message.includes('fitas'), message);
  });

  test('ida e volta preserva a máquina inteira', () => {
    const original = anbn();
    const volta = parseJFF(serializeJFF(original)).automaton;
    assertEqual(volta.type, 'turing');
    assertEqual(
      volta.transitions.map((t) => [t.from, t.to, t.read, t.write, t.move]),
      original.transitions.map((t) => [t.from, t.to, t.read, t.write, t.move]),
    );
    assertEqual(volta.states.map((s) => [s.name, s.initial, s.final]), original.states.map((s) => [s.name, s.initial, s.final]));
  });

  test('grava branco como <write/> e o movimento nas letras do JFLAP', () => {
    const xml = serializeJFF(anbn());
    assert(xml.includes('<write/>'), 'faltou <write/>');
    assert(xml.includes('<move>L</move>') && xml.includes('<move>R</move>'), 'faltou move');
    assert(!xml.includes('<move>E</move>'), 'E/D são só de exibição');
  });

  test('a máquina lida do .jff se comporta igual', () => {
    const volta = parseJFF(serializeJFF(anbn())).automaton;
    for (const w of ['', 'ab', 'aabb']) assert(acceptsTuring(volta, w), `aceitar "${w}"`);
    for (const w of ['a', 'ba', 'abb']) assert(!acceptsTuring(volta, w), `rejeitar "${w}"`);
  });
});
