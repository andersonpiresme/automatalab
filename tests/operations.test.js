import { describe, test, assert, assertEqual } from './runner.js';
import { addState, addTransition, alphabet, createAutomaton } from '../src/core/model.js';
import { addTrapState, mergeAutomaton } from '../src/core/operations.js';
import { accepts } from '../src/core/simulate.js';
import { springLayout } from '../src/render/layout.js';

/** AF incompleto: q0 lê 'a' para q1, e nada mais. */
function incompleto() {
  const a = createAutomaton();
  const q0 = addState(a, 0, 0, { name: 'q0', initial: true });
  const q1 = addState(a, 100, 0, { name: 'q1', final: true });
  addTransition(a, q0.id, q1.id, 'a');
  addTransition(a, q1.id, q0.id, 'b');
  return a;
}

describe('operations: estado de erro', () => {
  test('completa todos os pares (estado, símbolo) que faltavam', () => {
    const a = incompleto();
    const { state, added } = addTrapState(a);
    assert(state, 'deveria ter criado o estado de erro');
    for (const s of a.states) {
      for (const symbol of alphabet(a)) {
        const exists = a.transitions.some((t) => t.from === s.id && t.read === symbol);
        assert(exists, `faltou transição de ${s.name} lendo ${symbol}`);
      }
    }
    assert(added > 0, 'deveria ter criado transições');
  });

  test('não altera a linguagem reconhecida', () => {
    const original = incompleto();
    const completo = incompleto();
    addTrapState(completo);
    for (const input of ['', 'a', 'b', 'ab', 'aba', 'abab', 'ba']) {
      assertEqual(accepts(completo, input), accepts(original, input), `divergiu em "${input}"`);
    }
  });

  test('o estado de erro não é final e é um sumidouro', () => {
    const a = incompleto();
    const { state } = addTrapState(a);
    assert(!state.final, 'o estado de erro não pode ser final');
    const saidas = a.transitions.filter((t) => t.from === state.id);
    assert(saidas.every((t) => t.to === state.id), 'do estado de erro não se sai');
    assertEqual(saidas.length, alphabet(a).length);
  });

  test('autômato já completo não ganha estado de erro', () => {
    const a = incompleto();
    addTrapState(a);
    const antes = a.states.length;
    const { state, added } = addTrapState(a);
    assertEqual([state, added, a.states.length], [null, 0, antes]);
  });

  test('sem alfabeto não há o que completar', () => {
    const a = createAutomaton();
    addState(a, 0, 0);
    assertEqual(addTrapState(a).added, 0);
  });
});

describe('operations: mesclar autômatos', () => {
  test('traz estados e transições sem colidir ids', () => {
    const alvo = incompleto();
    const outro = incompleto();
    const resultado = mergeAutomaton(alvo, outro);
    assertEqual(resultado.states, 2);
    assertEqual(resultado.transitions, 2);
    assertEqual(alvo.states.length, 4);
    assertEqual(new Set(alvo.states.map((s) => s.id)).size, 4);
  });

  test('mantém um único estado inicial', () => {
    const alvo = incompleto();
    const resultado = mergeAutomaton(alvo, incompleto());
    assertEqual(alvo.states.filter((s) => s.initial).length, 1);
    assert(resultado.initialDropped, 'deveria avisar que descartou o inicial importado');
  });

  test('nomes repetidos são desambiguados', () => {
    const alvo = incompleto();
    mergeAutomaton(alvo, incompleto());
    assertEqual(new Set(alvo.states.map((s) => s.name)).size, 4);
  });

  test('as transições importadas apontam para os novos ids', () => {
    const alvo = incompleto();
    mergeAutomaton(alvo, incompleto());
    const ids = new Set(alvo.states.map((s) => s.id));
    assert(
      alvo.transitions.every((t) => ids.has(t.from) && ids.has(t.to)),
      'há transição apontando para id inexistente',
    );
  });

  test('mesclar em autômato vazio preserva o inicial importado', () => {
    const alvo = createAutomaton();
    mergeAutomaton(alvo, incompleto());
    assertEqual(alvo.states.filter((s) => s.initial).length, 1);
  });
});

describe('layout automático', () => {
  test('devolve uma posição por estado', () => {
    const a = incompleto();
    assertEqual(springLayout(a).size, a.states.length);
  });

  test('é determinístico', () => {
    const a = incompleto();
    assertEqual([...springLayout(a)], [...springLayout(a)]);
  });

  test('separa estados que estavam exatamente sobrepostos', () => {
    const a = createAutomaton();
    const q0 = addState(a, 50, 50);
    const q1 = addState(a, 50, 50);
    const q2 = addState(a, 50, 50);
    addTransition(a, q0.id, q1.id, 'a');
    const posicoes = springLayout(a);
    const pares = [[q0, q1], [q0, q2], [q1, q2]];
    for (const [x, y] of pares) {
      const p = posicoes.get(x.id);
      const q = posicoes.get(y.id);
      assert(Math.hypot(p.x - q.x, p.y - q.y) > 40, `${x.name} e ${y.name} ficaram colados`);
    }
  });

  test('não produz NaN', () => {
    const posicoes = springLayout(incompleto());
    for (const { x, y } of posicoes.values()) {
      assert(Number.isFinite(x) && Number.isFinite(y), `posição inválida: ${x},${y}`);
    }
  });

  test('mantém tudo dentro da moldura', () => {
    const a = incompleto();
    const posicoes = springLayout(a, { width: 800, height: 500, padding: 60 });
    for (const { x, y } of posicoes.values()) {
      assert(x >= 60 && x <= 740 && y >= 60 && y <= 440, `fora da moldura: ${x},${y}`);
    }
  });

  test('autômato vazio devolve mapa vazio', () => {
    assertEqual(springLayout(createAutomaton()).size, 0);
  });
});
