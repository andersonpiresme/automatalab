import { describe, test, assert, assertEqual } from './runner.js';
import { addState, addTransition, createAutomaton, isTransducer, validate } from '../src/core/model.js';
import { parseJFF, serializeJFF } from '../src/io/jff.js';
import { simulateMoore } from '../src/core/simulate.js';

/**
 * Máquina de Moore no formato exato do JFLAP 6.4, incluindo o <transout>
 * redundante que ele grava nas transições.
 */
const RELOGIO = `<?xml version="1.0" encoding="UTF-8" standalone="no"?><!--Created with JFLAP 6.4.--><structure>
	<type>moore</type>
	<automaton>
		<state id="0" name="q0">
			<x>542.0</x>
			<y>263.0</y>
			<initial/>
			<output>hora</output>
		</state>
		<state id="1" name="q1">
			<x>379.0</x>
			<y>161.0</y>
			<output>luz</output>
		</state>
		<state id="2" name="q2">
			<x>795.0</x>
			<y>170.0</y>
			<output>crono</output>
		</state>
		<transition>
			<from>0</from>
			<to>1</to>
			<read>b2</read>
			<transout>luz</transout>
		</transition>
		<transition>
			<from>0</from>
			<to>2</to>
			<read>b1</read>
			<transout>crono</transout>
		</transition>
		<transition>
			<from>1</from>
			<to>0</to>
			<read>b2</read>
			<transout>hora</transout>
		</transition>
		<transition>
			<from>2</from>
			<to>0</to>
			<read>b1</read>
			<transout>hora</transout>
		</transition>
	</automaton>
</structure>`;

function relogio() {
  return parseJFF(RELOGIO).automaton;
}

/** Moore mínima montada à mão, para os testes de execução. */
function chave() {
  const a = createAutomaton('moore');
  const desligado = addState(a, 0, 0, { name: 'off', initial: true, output: 'apagado' });
  const ligado = addState(a, 100, 0, { name: 'on', output: 'aceso' });
  addTransition(a, desligado.id, ligado.id, 'x');
  addTransition(a, ligado.id, desligado.id, 'x');
  return a;
}

describe('moore: leitura do .jff', () => {
  test('reconhece o tipo moore', () => {
    const a = relogio();
    assertEqual(a.type, 'moore');
    assert(isTransducer(a), 'deveria ser transdutor');
  });

  test('lê a saída de cada estado', () => {
    assertEqual(relogio().states.map((s) => s.output), ['hora', 'luz', 'crono']);
  });

  test('lê estados e transições normalmente', () => {
    const a = relogio();
    assertEqual([a.states.length, a.transitions.length], [3, 4]);
    assertEqual(a.states[0].initial, true);
  });

  test('não há estado final numa máquina de Moore', () => {
    assert(!relogio().states.some((s) => s.final), 'nenhum estado deveria ser final');
  });

  test('parseJFF não gera avisos para o formato do JFLAP 6.4', () => {
    assertEqual(parseJFF(RELOGIO).warnings, []);
  });
});

describe('moore: gravação do .jff', () => {
  test('grava o tipo moore', () => {
    assert(serializeJFF(relogio()).includes('<type>moore</type>'), 'faltou <type>moore</type>');
  });

  test('grava a saída dentro do estado', () => {
    assert(serializeJFF(relogio()).includes('<output>hora</output>'), 'faltou <output>');
  });

  test('reconstrói o transout com a saída do estado de destino', () => {
    const xml = serializeJFF(relogio());
    // a transição 0 -> 1 leva ao estado cuja saída é "luz"
    const bloco = xml.split('<transition>')[1];
    assert(bloco.includes('<to>1</to>') && bloco.includes('<transout>luz</transout>'), bloco);
  });

  test('ida e volta preserva tipo, saídas e transições', () => {
    const original = relogio();
    const volta = parseJFF(serializeJFF(original)).automaton;
    assertEqual(volta.type, original.type);
    assertEqual(volta.states, original.states);
    assertEqual(
      volta.transitions.map((t) => [t.from, t.to, t.read]),
      original.transitions.map((t) => [t.from, t.to, t.read]),
    );
  });

  test('autômato finito não ganha output nem transout', () => {
    const a = createAutomaton();
    const q = addState(a, 0, 0, { output: 'ignorado' });
    addTransition(a, q.id, q.id, 'a');
    const xml = serializeJFF(a);
    assert(!xml.includes('<output>'), 'não deveria gravar <output> num fa');
    assert(!xml.includes('<transout>'), 'não deveria gravar <transout> num fa');
  });
});

describe('moore: execução', () => {
  test('emite a saída do estado inicial antes de ler qualquer símbolo', () => {
    assertEqual(simulateMoore(chave(), '').output, ['apagado']);
  });

  test('emite uma saída por transição percorrida', () => {
    assertEqual(simulateMoore(chave(), 'xxx').output, ['apagado', 'aceso', 'apagado', 'aceso']);
  });

  test('a saída tem sempre um item a mais que a entrada', () => {
    for (const input of ['', 'x', 'xx', 'xxxx']) {
      assertEqual(simulateMoore(chave(), input).output.length, input.length + 1);
    }
  });

  test('percorre o relógio de verdade', () => {
    // q0(hora) --b1--> q2(crono) --b1--> q0(hora) --b2--> q1(luz)
    assertEqual(simulateMoore(relogio(), 'b1b1b2'.match(/b\d/g).join('')).output.length, 4);
  });

  test('trava quando não há transição para o símbolo', () => {
    const r = simulateMoore(chave(), 'xy');
    assertEqual(r.halted, 'sem-transicao');
    assertEqual(r.output, ['apagado', 'aceso']);
  });

  test('consumir tudo termina com halted "fim"', () => {
    assertEqual(simulateMoore(chave(), 'xx').halted, 'fim');
  });

  test('sem estado inicial não há execução', () => {
    const a = chave();
    for (const s of a.states) s.initial = false;
    const r = simulateMoore(a, 'x');
    assertEqual(r.halted, 'sem-inicial');
    assertEqual(r.steps, []);
  });

  test('sinaliza ambiguidade sem escolher em silêncio', () => {
    const a = chave();
    const extra = addState(a, 200, 0, { name: 'outro', output: 'outro' });
    addTransition(a, a.states[0].id, extra.id, 'x');
    const r = simulateMoore(a, 'x');
    assert(r.ambiguous, 'deveria sinalizar ambiguidade');
  });

  test('cada passo registra posição e estado', () => {
    const r = simulateMoore(chave(), 'xx');
    assertEqual(r.steps.map((s) => s.position), [0, 1, 2]);
    assertEqual(r.steps.map((s) => s.output), ['apagado', 'aceso', 'apagado']);
  });

  test('rótulo de mais de um caractere é consumido inteiro', () => {
    const a = createAutomaton('moore');
    const p = addState(a, 0, 0, { name: 'p', initial: true, output: '0' });
    const q = addState(a, 100, 0, { name: 'q', output: '1' });
    addTransition(a, p.id, q.id, 'b1');
    const r = simulateMoore(a, 'b1');
    assertEqual(r.output, ['0', '1']);
    assertEqual(r.halted, 'fim');
  });
});

describe('moore: validação', () => {
  test('não reclama de ausência de estado final', () => {
    assert(
      !validate(relogio()).some((p) => p.includes('final')),
      'Moore não deve exigir estado final',
    );
  });

  test('reclama de estado sem saída', () => {
    const a = chave();
    a.states[1].output = null;
    assert(validate(a).some((p) => p.includes('sem saída')), `avisos: ${validate(a)}`);
  });

  test('máquina completa não gera reclamações', () => {
    assertEqual(validate(relogio()), []);
  });
});
