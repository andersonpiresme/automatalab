/**
 * Expressões regulares: análise sintática, construção de Thompson (ER → AF) e
 * eliminação de estados (AF → ER).
 *
 * Sintaxe aceita, a mesma do JFLAP:
 *
 *   a b c ...   símbolos
 *   +  ou  |    união
 *   justaposição concatenação
 *   *           fecho de Kleene
 *   ( )         agrupamento
 *   λ  ou  !    cadeia vazia
 *
 * A árvore é manipulada por construtores que já simplificam os casos triviais
 * (concatenar com λ, fechar o vazio), o que encurta bastante a expressão
 * produzida pela eliminação de estados.
 */

import { addState, addTransition, cloneAutomaton, createAutomaton, getInitialState } from './model.js';

/**
 * @typedef {{type:'symbol', value:string}
 *         | {type:'empty'}
 *         | {type:'union', left:RegexNode, right:RegexNode}
 *         | {type:'concat', left:RegexNode, right:RegexNode}
 *         | {type:'star', child:RegexNode}} RegexNode
 */

/** A cadeia vazia (λ). */
export const EMPTY = { type: 'empty' };

/** A linguagem vazia (∅). Representada por null para simplificar os testes. */
export const NOTHING = null;

export class RegexError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RegexError';
  }
}

/* ------------------------------------------------------------------ *
 * Construtores com simplificação
 * ------------------------------------------------------------------ */

export function mkUnion(a, b) {
  if (a === NOTHING) return b;
  if (b === NOTHING) return a;
  return { type: 'union', left: a, right: b };
}

export function mkConcat(a, b) {
  if (a === NOTHING || b === NOTHING) return NOTHING;
  if (a.type === 'empty') return b;
  if (b.type === 'empty') return a;
  return { type: 'concat', left: a, right: b };
}

export function mkStar(a) {
  if (a === NOTHING || a.type === 'empty') return EMPTY;
  if (a.type === 'star') return a;
  return { type: 'star', child: a };
}

export function mkSymbol(value) {
  return value === '' ? EMPTY : { type: 'symbol', value };
}

/* ------------------------------------------------------------------ *
 * Impressão
 * ------------------------------------------------------------------ */

const PRECEDENCE = { union: 1, concat: 2, star: 3, symbol: 4, empty: 4 };

/** @param {RegexNode} node */
export function formatRegex(node) {
  if (node === NOTHING) return '∅';
  switch (node.type) {
    case 'empty':
      return 'λ';
    case 'symbol':
      return node.value;
    case 'star':
      return `${parenthesize(node.child, 3)}*`;
    case 'concat':
      return parenthesize(node.left, 2) + parenthesize(node.right, 2);
    case 'union':
      return `${parenthesize(node.left, 1)}+${parenthesize(node.right, 1)}`;
    default:
      throw new RegexError(`nó desconhecido: ${node.type}`);
  }
}

function parenthesize(node, minimum) {
  const text = formatRegex(node);
  const precedence = PRECEDENCE[node?.type] ?? 4;
  return precedence < minimum ? `(${text})` : text;
}

/* ------------------------------------------------------------------ *
 * Análise sintática
 * ------------------------------------------------------------------ */

/**
 * @param {string} source
 * @returns {RegexNode}
 * @throws {RegexError}
 */
export function parseRegex(source) {
  const text = String(source ?? '');
  let position = 0;

  const skipSpaces = () => {
    while (position < text.length && /\s/.test(text[position])) position += 1;
  };
  const peek = () => {
    skipSpaces();
    return text[position];
  };

  function union() {
    let node = concatenation();
    while (peek() === '+' || peek() === '|') {
      position += 1;
      node = mkUnion(node, concatenation());
    }
    return node;
  }

  function concatenation() {
    let node = null;
    for (;;) {
      const c = peek();
      if (c === undefined || c === ')' || c === '+' || c === '|') break;
      const next = factor();
      node = node === null ? next : mkConcat(node, next);
    }
    if (node === null) {
      throw new RegexError(
        position >= text.length
          ? 'Expressão incompleta: faltou um operando no fim.'
          : `Operando vazio antes de "${text[position]}" (posição ${position + 1}).`,
      );
    }
    return node;
  }

  function factor() {
    let node = atom();
    while (peek() === '*') {
      position += 1;
      node = mkStar(node);
    }
    return node;
  }

  function atom() {
    const c = peek();
    if (c === undefined) throw new RegexError('Expressão incompleta.');
    if (c === '(') {
      position += 1;
      const inner = union();
      if (peek() !== ')') throw new RegexError('Parêntese aberto e não fechado.');
      position += 1;
      return inner;
    }
    if (c === ')') throw new RegexError(`Parêntese fechado sem abrir (posição ${position + 1}).`);
    if (c === '*') throw new RegexError(`"*" sem operando (posição ${position + 1}).`);
    position += 1;
    if (c === 'λ' || c === '!') return EMPTY;
    return { type: 'symbol', value: c };
  }

  const result = union();
  if (peek() !== undefined) {
    const rest = text.slice(position);
    // o caso comum é ")" a mais: vale nomear o problema em vez de só apontar
    throw new RegexError(
      rest.startsWith(')')
        ? `Parêntese fechado sem abrir (posição ${position + 1}).`
        : `Sobrou "${rest}" no fim da expressão.`,
    );
  }
  return result;
}

/* ------------------------------------------------------------------ *
 * ER -> AF (Thompson)
 * ------------------------------------------------------------------ */

/**
 * Construção de Thompson: um autômato com transições λ, dois estados por
 * operador. Fica maior que o necessário de propósito — é a construção que o
 * aluno vê no livro. Use "converter para DFA" e "minimizar" em seguida.
 *
 * @param {RegexNode} ast
 * @returns {import('./model.js').Automaton}
 */
export function thompson(ast) {
  const automaton = createAutomaton();
  let counter = 0;
  const newState = () =>
    addState(automaton, 0, 0, { name: `q${counter++}`, initial: false, final: false });

  function build(node) {
    // ∅: dois estados sem ligação nenhuma
    if (node === NOTHING) return { start: newState(), end: newState() };

    switch (node.type) {
      case 'empty':
      case 'symbol': {
        const start = newState();
        const end = newState();
        addTransition(automaton, start.id, end.id, node.type === 'empty' ? '' : node.value);
        return { start, end };
      }
      case 'concat': {
        // a concatenação não precisa de estados próprios: liga fim com início
        const left = build(node.left);
        const right = build(node.right);
        addTransition(automaton, left.end.id, right.start.id, '');
        return { start: left.start, end: right.end };
      }
      case 'union': {
        const start = newState();
        const left = build(node.left);
        const right = build(node.right);
        const end = newState();
        addTransition(automaton, start.id, left.start.id, '');
        addTransition(automaton, start.id, right.start.id, '');
        addTransition(automaton, left.end.id, end.id, '');
        addTransition(automaton, right.end.id, end.id, '');
        return { start, end };
      }
      case 'star': {
        const start = newState();
        const inner = build(node.child);
        const end = newState();
        addTransition(automaton, start.id, inner.start.id, '');
        addTransition(automaton, start.id, end.id, '');
        addTransition(automaton, inner.end.id, end.id, '');
        addTransition(automaton, inner.end.id, inner.start.id, '');
        return { start, end };
      }
      default:
        throw new RegexError(`nó desconhecido: ${node.type}`);
    }
  }

  const { start, end } = build(ast);
  start.initial = true;
  end.final = true;
  return automaton;
}

/** Atalho: texto da expressão direto para autômato. */
export function regexToAutomaton(source) {
  return thompson(parseRegex(source));
}

/* ------------------------------------------------------------------ *
 * AF -> ER (eliminação de estados)
 * ------------------------------------------------------------------ */

const START = -1;
const ACCEPT = -2;

/**
 * Eliminação de estados sobre um GNFA.
 *
 * A ordem de eliminação não muda a linguagem, mas muda muito o tamanho da
 * expressão: eliminar primeiro os estados de menor (grau de entrada × grau de
 * saída) evita o crescimento explosivo dos casos comuns.
 *
 * @returns {RegexNode} NOTHING quando a linguagem é vazia
 */
export function automatonToRegexNode(source) {
  const automaton = cloneAutomaton(source);
  const start = getInitialState(automaton);
  const finals = automaton.states.filter((s) => s.final);
  if (!start || finals.length === 0) return NOTHING;

  const edges = new Map();
  const get = (from, to) => edges.get(`${from}|${to}`) ?? NOTHING;
  const set = (from, to, node) => {
    const key = `${from}|${to}`;
    if (node === NOTHING) edges.delete(key);
    else edges.set(key, node);
  };

  for (const t of automaton.transitions) {
    set(t.from, t.to, mkUnion(get(t.from, t.to), mkSymbol(t.read)));
  }
  set(START, start.id, EMPTY);
  for (const f of finals) set(f.id, ACCEPT, mkUnion(get(f.id, ACCEPT), EMPTY));

  const remaining = automaton.states.map((s) => s.id);
  while (remaining.length > 0) {
    const q = pickCheapest(remaining, edges);
    remaining.splice(remaining.indexOf(q), 1);

    const loop = mkStar(get(q, q));
    const sources = [START, ...remaining].filter((i) => i !== q && get(i, q) !== NOTHING);
    const targets = [ACCEPT, ...remaining].filter((j) => j !== q && get(q, j) !== NOTHING);

    for (const i of sources) {
      for (const j of targets) {
        const detour = mkConcat(mkConcat(get(i, q), loop), get(q, j));
        set(i, j, mkUnion(get(i, j), detour));
      }
    }
    for (const other of [START, ACCEPT, ...remaining, q]) {
      set(other, q, NOTHING);
      set(q, other, NOTHING);
    }
  }

  return get(START, ACCEPT);
}

/** Estado cuja eliminação gera menos arestas novas. */
function pickCheapest(candidates, edges) {
  let best = candidates[0];
  let bestCost = Infinity;
  for (const q of candidates) {
    let inDegree = 0;
    let outDegree = 0;
    for (const key of edges.keys()) {
      const [from, to] = key.split('|').map(Number);
      if (to === q && from !== q) inDegree += 1;
      if (from === q && to !== q) outDegree += 1;
    }
    const cost = inDegree * outDegree;
    if (cost < bestCost) {
      bestCost = cost;
      best = q;
    }
  }
  return best;
}

/** Expressão regular equivalente ao autômato, já como texto. */
export function automatonToRegex(automaton) {
  return formatRegex(automatonToRegexNode(automaton));
}
