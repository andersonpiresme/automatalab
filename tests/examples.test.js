import { describe, test, assert, assertEqual } from './runner.js';
import { validate } from '../src/core/model.js';
import {
  exampleAdder,
  exampleAnBnCn,
  exampleAnBnPushdown,
  exampleAutomaton,
  exampleTuring,
} from '../src/core/examples.js';
import { accepts } from '../src/core/simulate.js';
import { acceptsTuring, simulateTuring, tapeOutput } from '../src/core/turing.js';
import { acceptsPushdown } from '../src/core/pushdown.js';
import { parseJFF, serializeJFF } from '../src/io/jff.js';

describe('exemplos: autômato finito e aⁿbⁿ', () => {
  test('o AF que termina em 01', () => {
    const a = exampleAutomaton();
    assert(accepts(a, '1101') && !accepts(a, '10'), 'comportamento inesperado');
    assertEqual(a.states.length, 3);
  });

  test('a MT aⁿbⁿ do slide', () => {
    const m = exampleTuring();
    assert(acceptsTuring(m, 'aabb') && !acceptsTuring(m, 'aab'), 'comportamento inesperado');
    assertEqual(m.states.length, 5);
  });

  test('o PDA aⁿbⁿ embutido', () => {
    const m = exampleAnBnPushdown();
    assertEqual(m.type, 'pda');
    for (const w of ['', 'ab', 'aabb', 'aaabbb']) assert(acceptsPushdown(m, w), `deveria aceitar "${w}"`);
    for (const w of ['a', 'aab', 'abb', 'ba']) assert(!acceptsPushdown(m, w), `não deveria aceitar "${w}"`);
  });
});

describe('exemplo: aⁿbⁿcⁿ', () => {
  test('aceita as cadeias da linguagem, incluindo n = 0', () => {
    const m = exampleAnBnCn();
    for (const w of ['', 'abc', 'aabbcc', 'aaabbbccc', 'aaaabbbbcccc']) {
      assert(acceptsTuring(m, w), `deveria aceitar "${w}"`);
    }
  });

  test('rejeita contagens diferentes', () => {
    const m = exampleAnBnCn();
    for (const w of ['aabbc', 'abbc', 'abcc', 'aabc', 'aabbccc', 'aaabbcc']) {
      assert(!acceptsTuring(m, w), `não deveria aceitar "${w}"`);
    }
  });

  test('rejeita ordem errada e símbolos fora do lugar', () => {
    const m = exampleAnBnCn();
    for (const w of ['acb', 'bac', 'cba', 'abcabc', 'aabbccabc', 'a', 'b', 'c', 'ab', 'bc', 'ac']) {
      assert(!acceptsTuring(m, w), `não deveria aceitar "${w}"`);
    }
  });

  test('é determinística e Π é função', () => {
    const m = exampleAnBnCn();
    assertEqual(validate(m), []);
    assert(simulateTuring(m, 'aabbcc').generations.every((g) => g.length === 1), 'ramificou');
  });

  test('ao aceitar, a fita está toda marcada', () => {
    const r = simulateTuring(exampleAnBnCn(), 'aabbcc');
    assertEqual(tapeOutput(r.accepting), 'AABBCC');
  });

  test('rejeição é por função indefinida, nunca por loop', () => {
    const m = exampleAnBnCn();
    for (const w of ['aabbc', 'acb', 'abcabc']) {
      const r = simulateTuring(m, w);
      assertEqual(r.halted, 'rejeitou', `"${w}" parou por ${r.halted}`);
    }
  });

  test('sobrevive à ida e volta pelo .jff', () => {
    const volta = parseJFF(serializeJFF(exampleAnBnCn())).automaton;
    assert(acceptsTuring(volta, 'aabbcc') && !acceptsTuring(volta, 'aabbc'), 'mudou de comportamento');
  });
});

describe('exemplo: somador unário', () => {
  const soma = (m, n) => {
    const r = simulateTuring(exampleAdder(), `${'1'.repeat(m)}+${'1'.repeat(n)}`);
    return r.accepted ? tapeOutput(r.accepting).length : null;
  };

  test('soma parcelas positivas', () => {
    assertEqual(soma(3, 2), 5);
    assertEqual(soma(1, 1), 2);
    assertEqual(soma(4, 7), 11);
  });

  test('funciona com zero de um lado ou dos dois', () => {
    assertEqual(soma(0, 3), 3);
    assertEqual(soma(3, 0), 3);
    assertEqual(soma(0, 0), 0);
  });

  test('o resultado na fita é só uns', () => {
    const r = simulateTuring(exampleAdder(), '111+11');
    assertEqual(tapeOutput(r.accepting), '11111');
  });

  test('entrada sem + é rejeitada', () => {
    assert(!acceptsTuring(exampleAdder(), '111'), 'não há o que somar');
  });

  test('gasta um passo por célula mais dois', () => {
    // Δ 1 1 1 + 1 1: 7 células para atravessar, 1 ao ler o branco, 1 para apagar
    assertEqual(simulateTuring(exampleAdder(), '111+11').steps, 9);
  });

  test('Π é função', () => {
    assertEqual(validate(exampleAdder()), []);
  });
});
