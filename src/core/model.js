/**
 * Modelo de dados do autômato.
 *
 * Independente de DOM e de UI: tudo aqui é dado puro, para poder ser testado
 * isoladamente e reaproveitado pelos algoritmos das fases seguintes
 * (NFA->DFA, minimização, conversões).
 *
 * @typedef {Object} State
 * @property {number}      id       identificador estável, usado nas transições
 * @property {string}      name     rótulo curto exibido no círculo (ex.: "q0")
 * @property {number}      x
 * @property {number}      y
 * @property {boolean}     initial
 * @property {boolean}     final
 * @property {string|null} label    anotação livre do JFLAP (<label>)
 * @property {string|null} output   saída do estado; só usado em máquinas de Moore
 *
 * @typedef {Object} Transition
 * @property {string} id    identificador interno; não é persistido no .jff
 * @property {number} from
 * @property {number} to
 * @property {string} read  símbolo lido; string vazia é λ (AF) ou branco (MT)
 * @property {string} [write]  MT: símbolo gravado; string vazia é branco
 * @property {'L'|'R'|'S'} [move]  MT: movimento, nas letras do JFLAP
 *
 * @typedef {Object} Note
 * @property {string} text
 * @property {number} x
 * @property {number} y
 *
 * @typedef {Object} Automaton
 * @property {'fa'|'moore'|'turing'} type  'moore' emite saída; 'turing' tem fita
 * @property {State[]}     states
 * @property {Transition[]} transitions
 * @property {Note[]}      notes
 * @property {'menezes'|'jflap'} [tape]  MT: convenção da fita (ver tapeConvention)
 */

/** Símbolo usado na interface para representar a transição vazia. */
export const LAMBDA = 'λ';

/** Marcador de início de fita da convenção Menezes. Vive na célula 0. */
export const START_MARKER = 'Δ';

/** Como o branco da fita é exibido em cada convenção. */
export const BLANK_DISPLAY = { menezes: 'ß', jflap: '□' };

/** Movimentos: internamente nas letras do JFLAP; exibidos como o curso escreve. */
export const MOVE_DISPLAY = { L: 'E', R: 'D', S: 'S' };

let transitionCounter = 0;

/**
 * @param {'fa'|'moore'|'turing'} type
 * @returns {Automaton}
 */
export function createAutomaton(type = 'fa') {
  const automaton = { type, states: [], transitions: [], notes: [] };
  if (type === 'turing') automaton.tape = 'menezes';
  return automaton;
}

export function isTuring(automaton) {
  return automaton.type === 'turing';
}

/**
 * Convenção da fita de uma MT.
 *
 * - `menezes` (a do curso): célula 0 tem Δ, cabeça começa sobre ele, fita só
 *   cresce para a direita; mover à esquerda do Δ rejeita.
 * - `jflap`: fita infinita nos dois lados, sem Δ, cabeça começa no primeiro
 *   símbolo da entrada.
 *
 * O .jff não guarda essa escolha, então na leitura ela é inferida: máquina que
 * menciona Δ em alguma transição é Menezes.
 */
export function tapeConvention(automaton) {
  if (automaton.tape) return automaton.tape;
  const usesMarker = automaton.transitions.some(
    (t) => t.read === START_MARKER || t.write === START_MARKER,
  );
  return usesMarker ? 'menezes' : 'jflap';
}

/** Branco como o usuário deve vê-lo neste autômato. */
export function blankDisplay(automaton) {
  return BLANK_DISPLAY[tapeConvention(automaton)];
}

/**
 * Transdutores emitem saída em vez de aceitar ou rejeitar. Muda o painel de
 * simulação e desabilita as conversões, que só fazem sentido para acceptores.
 */
export function isTransducer(automaton) {
  return automaton.type === 'moore';
}

/** Nome do tipo para mensagens ao usuário. */
export function typeName(automaton) {
  if (automaton.type === 'moore') return 'máquina de Moore';
  if (automaton.type === 'turing') return 'máquina de Turing';
  return 'autômato finito';
}

/**
 * Cópia profunda. Usada pelo desfazer e pelas conversões, que não devem
 * alterar o autômato de origem.
 * @returns {Automaton}
 */
export function cloneAutomaton(automaton) {
  const copy = {
    type: automaton.type,
    states: automaton.states.map((s) => ({ ...s })),
    transitions: automaton.transitions.map((t) => ({ ...t })),
    notes: automaton.notes.map((n) => ({ ...n })),
  };
  if (automaton.tape) copy.tape = automaton.tape;
  return copy;
}

/** Próximo id livre de estado. Reaproveita buracos deixados por remoções. */
export function nextStateId(automaton) {
  const used = new Set(automaton.states.map((s) => s.id));
  let id = 0;
  while (used.has(id)) id += 1;
  return id;
}

/** Próximo nome livre no padrão q0, q1, ... */
export function nextStateName(automaton) {
  const used = new Set(automaton.states.map((s) => s.name));
  let n = 0;
  while (used.has(`q${n}`)) n += 1;
  return `q${n}`;
}

/**
 * @param {Automaton} automaton
 * @returns {State} o estado recém-criado
 */
export function addState(automaton, x, y, overrides = {}) {
  const state = {
    id: nextStateId(automaton),
    name: nextStateName(automaton),
    x,
    y,
    initial: automaton.states.length === 0,
    final: false,
    label: null,
    output: null,
    ...overrides,
  };
  automaton.states.push(state);
  return state;
}

/** Remove o estado e todas as transições incidentes. */
export function removeState(automaton, id) {
  automaton.states = automaton.states.filter((s) => s.id !== id);
  automaton.transitions = automaton.transitions.filter(
    (t) => t.from !== id && t.to !== id,
  );
}

export function getState(automaton, id) {
  return automaton.states.find((s) => s.id === id) || null;
}

/**
 * Cria uma transição. Duplicatas exatas são ignoradas — o JFLAP também as
 * trata como uma só. Em MT, `extra` traz `write` e `move`.
 * @param {{write?: string, move?: 'L'|'R'|'S'}} [extra]
 * @returns {Transition|null} null se já existia
 */
export function addTransition(automaton, from, to, read, extra = {}) {
  const symbol = read == null ? '' : String(read);
  const turing = automaton.type === 'turing';
  const write = turing ? (extra.write == null ? '' : String(extra.write)) : undefined;
  const move = turing ? extra.move || 'R' : undefined;

  const duplicate = automaton.transitions.some(
    (t) =>
      t.from === from &&
      t.to === to &&
      t.read === symbol &&
      (!turing || (t.write === write && t.move === move)),
  );
  if (duplicate) return null;

  transitionCounter += 1;
  const transition = { id: `t${transitionCounter}`, from, to, read: symbol };
  if (turing) {
    transition.write = write;
    transition.move = move;
  }
  automaton.transitions.push(transition);
  return transition;
}

/**
 * Texto da transição como aparece na aresta e na tabela.
 * AF: o símbolo (λ para vazio). MT: a tripla do curso, `(lido, gravado, mov)`.
 */
export function transitionLabel(automaton, transition) {
  if (automaton.type !== 'turing') return displaySymbol(transition.read);
  const blank = blankDisplay(automaton);
  const cell = (s) => (s === '' ? blank : s);
  return `(${cell(transition.read)},${cell(transition.write)},${MOVE_DISPLAY[transition.move] ?? transition.move})`;
}

export function removeTransition(automaton, id) {
  automaton.transitions = automaton.transitions.filter((t) => t.id !== id);
}

/** Marca um único estado inicial (o JFLAP admite no máximo um). */
export function setInitial(automaton, id) {
  for (const s of automaton.states) s.initial = s.id === id;
}

export function toggleFinal(automaton, id) {
  const state = getState(automaton, id);
  if (state) state.final = !state.final;
}

export function getInitialState(automaton) {
  return automaton.states.find((s) => s.initial) || null;
}

/** Alfabeto de entrada: símbolos distintos, sem lambda, em ordem alfabética. */
export function alphabet(automaton) {
  const symbols = new Set();
  for (const t of automaton.transitions) if (t.read !== '') symbols.add(t.read);
  return [...symbols].sort();
}

/**
 * Alfabeto da fita de uma MT: tudo que é lido ou gravado, incluindo o branco
 * (string vazia) e o Δ. Ordem da tabela Π do curso: Δ, símbolos de entrada
 * (minúsculas e dígitos), símbolos auxiliares (maiúsculas), branco.
 */
export function tapeAlphabet(automaton) {
  const symbols = new Set();
  for (const t of automaton.transitions) {
    symbols.add(t.read);
    if (t.write != null) symbols.add(t.write);
  }
  // a convenção do Menezes usa maiúsculas para o alfabeto auxiliar V
  const auxiliary = (s) => (s === s.toUpperCase() && s !== s.toLowerCase() ? 1 : 0);
  const rest = [...symbols]
    .filter((s) => s !== '' && s !== START_MARKER)
    .sort((a, b) => auxiliary(a) - auxiliary(b) || a.localeCompare(b));
  const result = [];
  if (symbols.has(START_MARKER)) result.push(START_MARKER);
  result.push(...rest);
  if (symbols.has('')) result.push('');
  return result;
}

/** Todas as transições de `from` para `to`, na ordem de criação. */
export function transitionsBetween(automaton, from, to) {
  return automaton.transitions.filter((t) => t.from === from && t.to === to);
}

/**
 * Agrupa transições por par (origem, destino) para desenhar uma única aresta
 * rotulada "a,b,λ" em vez de arestas sobrepostas.
 * @returns {{from:number, to:number, transitions:Transition[]}[]}
 */
export function groupTransitions(automaton) {
  const groups = new Map();
  for (const t of automaton.transitions) {
    const key = `${t.from}->${t.to}`;
    if (!groups.has(key)) groups.set(key, { from: t.from, to: t.to, transitions: [] });
    groups.get(key).transitions.push(t);
  }
  return [...groups.values()];
}

/** Texto de exibição de um símbolo: string vazia vira λ. */
export function displaySymbol(read) {
  return read === '' ? LAMBDA : read;
}

/** Inverso de displaySymbol: o que o usuário digita vira o símbolo interno. */
export function parseSymbol(input) {
  const trimmed = (input || '').trim();
  if (trimmed === '' || trimmed === LAMBDA || trimmed.toLowerCase() === 'lambda') return '';
  return trimmed;
}

/**
 * Símbolo de fita digitado pelo usuário. Branco: vazio, ß, □, _ ou a palavra
 * "branco". Marcador de início: Δ, ^ ou a palavra "delta". Qualquer outra
 * coisa é o símbolo literal — inclusive a letra b, que não é branco.
 */
export function parseTapeSymbol(input) {
  const trimmed = (input || '').trim();
  const lower = trimmed.toLowerCase();
  if (trimmed === '' || ['ß', '□', '_'].includes(trimmed) || lower === 'branco' || lower === 'blank') {
    return '';
  }
  if (trimmed === '^' || lower === 'delta') return START_MARKER;
  return trimmed;
}

const MOVE_INPUT = { E: 'L', D: 'R', L: 'L', R: 'R', S: 'S', P: 'S' };

/**
 * Lê uma transição de MT digitada como no curso: `lido,gravado,movimento`.
 * Aceita `;` como separador também, movimentos em E/D (curso) ou L/R (JFLAP),
 * e S para ficar parado.
 * @returns {{read:string, write:string, move:'L'|'R'|'S'}}
 * @throws {Error} com mensagem para o usuário
 */
export function parseTuringTuple(input) {
  const cleaned = (input || '').trim().replace(/^\(|\)$/g, '');
  const parts = cleaned.split(/[,;]/).map((p) => p.trim());
  if (parts.length !== 3) {
    throw new Error('Use três partes: lido, gravado, movimento — por exemplo a,A,D');
  }
  const move = MOVE_INPUT[parts[2].toUpperCase()];
  if (!move) {
    throw new Error(`Movimento "${parts[2]}" inválido. Use E ou D (ou L, R, S).`);
  }
  return { read: parseTapeSymbol(parts[0]), write: parseTapeSymbol(parts[1]), move };
}

/**
 * Problemas estruturais que valem avisar ao usuário, sem impedir a edição.
 * @returns {string[]}
 */
export function validate(automaton) {
  const problems = [];
  const initials = automaton.states.filter((s) => s.initial);
  if (automaton.states.length > 0 && initials.length === 0) {
    problems.push('Nenhum estado inicial definido.');
  }
  if (initials.length > 1) {
    problems.push(`${initials.length} estados iniciais — só pode haver um.`);
  }

  if (isTransducer(automaton)) {
    // Moore não tem estado final: o que importa é toda transição ter saída
    const semSaida = automaton.states.filter((s) => !s.output);
    if (semSaida.length > 0) {
      problems.push(
        `${semSaida.length} estado(s) sem saída definida: ${semSaida.map((s) => s.name).join(', ')}.`,
      );
    }
    return problems;
  }

  if (automaton.states.length > 0 && !automaton.states.some((s) => s.final)) {
    problems.push('Nenhum estado final: a linguagem reconhecida é vazia.');
  }

  if (isTuring(automaton)) {
    // Π deve ser função: um único destino para cada (estado, símbolo lido)
    const seen = new Map();
    const conflicts = new Set();
    for (const t of automaton.transitions) {
      const key = `${t.from}|${t.read}`;
      if (seen.has(key)) conflicts.add(t.from);
      seen.set(key, true);
    }
    if (conflicts.size > 0) {
      const names = [...conflicts].map((id) => getState(automaton, id)?.name ?? id);
      problems.push(`Π não é função: ${names.join(', ')} tem mais de uma transição para o mesmo símbolo lido.`);
    }
  }
  return problems;
}
