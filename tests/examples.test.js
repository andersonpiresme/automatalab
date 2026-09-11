import { describe, test, assert, assertEqual } from './runner.js';
import { exampleAutomaton, exampleTuring } from '../src/core/examples.js';
import { accepts } from '../src/core/simulate.js';
import { acceptsTuring } from '../src/core/turing.js';

describe('exemplos embutidos', () => {
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
});
