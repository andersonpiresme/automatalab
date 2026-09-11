/**
 * Runner de testes mínimo, executado no próprio browser (tests.html).
 *
 * Não há dependência de Node ou de qualquer ferramenta externa: os módulos
 * testados são os mesmos que a aplicação carrega.
 */

const suites = [];
let current = null;

export function describe(name, fn) {
  current = { name, tests: [] };
  suites.push(current);
  fn();
  current = null;
}

export function test(name, fn) {
  if (!current) throw new Error('test() precisa estar dentro de describe()');
  current.tests.push({ name, fn });
}

export function assert(condition, message = 'condição falsa') {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${message}\n    esperado: ${b}\n    recebido: ${a}`);
  }
}

export function assertThrows(fn, message = 'esperava uma exceção') {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(message);
}

export function run(container) {
  let passed = 0;
  let failed = 0;
  const output = [];

  for (const suite of suites) {
    output.push(`<h2>${escape(suite.name)}</h2><ul>`);
    for (const { name, fn } of suite.tests) {
      try {
        fn();
        passed += 1;
        output.push(`<li class="pass">✓ ${escape(name)}</li>`);
      } catch (error) {
        failed += 1;
        output.push(`<li class="fail">✗ ${escape(name)}<pre>${escape(error.message)}</pre></li>`);
      }
    }
    output.push('</ul>');
  }

  const summary = `<p class="summary ${failed ? 'fail' : 'pass'}">${passed} passou · ${failed} falhou</p>`;
  container.innerHTML = summary + output.join('');
  document.title = `${failed ? '✗' : '✓'} testes — AutomataLab`;
  return { passed, failed };
}

function escape(value) {
  return String(value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
