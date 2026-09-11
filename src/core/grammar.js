/**
 * Gramáticas regulares: conversão nos dois sentidos com autômatos finitos.
 *
 * As gramáticas produzidas são lineares à direita — a forma que o JFLAP usa em
 * "Convert to Grammar". Cada estado vira uma variável, cada transição vira uma
 * produção `A → aB`, e todo estado final ganha `A → λ`.
 *
 * Formato textual aceito na leitura:
 *
 *   S -> aA | bB | λ
 *   A -> aS
 *
 * Também valem `→` e `::=` como seta, e `!` como cadeia vazia.
 */

import { addState, addTransition, createAutomaton, getInitialState } from './model.js';

/** @typedef {{left: string, right: string}} Production */

/** Letras usadas para nomear variáveis, sem o S, que fica para a inicial. */
const LETTERS = 'ABCDEFGHIJKLMNOPQRTUVWXYZ';

export class GrammarError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GrammarError';
  }
}

/* ------------------------------------------------------------------ *
 * AF -> gramática
 * ------------------------------------------------------------------ */

/** Uma variável por estado; o estado inicial vira S. */
function variableNames(automaton) {
  const start = getInitialState(automaton);
  const names = new Map();
  if (start) names.set(start.id, 'S');
  let index = 0;
  for (const s of automaton.states) {
    if (names.has(s.id)) continue;
    names.set(s.id, index < LETTERS.length ? LETTERS[index] : `V${index}`);
    index += 1;
  }
  return names;
}

/**
 * @returns {{productions: Production[], start: string|null, names: Map<number,string>}}
 */
export function automatonToGrammar(automaton) {
  const names = variableNames(automaton);
  const start = getInitialState(automaton);
  const productions = [];

  // ordem: a variável inicial primeiro, depois na ordem dos estados
  const ordered = start ? [start, ...automaton.states.filter((s) => s !== start)] : automaton.states;

  for (const state of ordered) {
    const left = names.get(state.id);
    for (const t of automaton.transitions) {
      if (t.from !== state.id) continue;
      // transição λ vira produção unitária A → B
      productions.push({ left, right: `${t.read}${names.get(t.to)}` });
    }
    if (state.final) productions.push({ left, right: 'λ' });
  }

  return { productions, start: start ? 'S' : null, names };
}

/** Agrupa por variável: `S -> aA | b | λ`. */
export function formatGrammar(productions) {
  const groups = new Map();
  for (const { left, right } of productions) {
    if (!groups.has(left)) groups.set(left, []);
    groups.get(left).push(right === '' ? 'λ' : right);
  }
  return [...groups.entries()].map(([left, rights]) => `${left} -> ${rights.join(' | ')}`).join('\n');
}

/* ------------------------------------------------------------------ *
 * Gramática -> AF
 * ------------------------------------------------------------------ */

/**
 * @param {string} text
 * @returns {Production[]}
 * @throws {GrammarError}
 */
export function parseGrammar(text) {
  const productions = [];
  const lines = String(text ?? '').split('\n');

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;

    const match = line.match(/^(.+?)\s*(?:->|→|::=)\s*(.*)$/);
    if (!match) {
      throw new GrammarError(`Linha ${index + 1}: falta a seta (use "->"). Recebido: "${line}"`);
    }
    const left = match[1].trim();
    if (!/^[A-Z][0-9]*$/.test(left)) {
      throw new GrammarError(
        `Linha ${index + 1}: "${left}" não é uma variável. Use uma letra maiúscula, opcionalmente com dígitos.`,
      );
    }
    const rights = match[2].split('|').map((r) => r.trim());
    for (const right of rights) {
      if (right === '') {
        throw new GrammarError(`Linha ${index + 1}: lado direito vazio. Use λ para a cadeia vazia.`);
      }
      productions.push({ left, right: right === 'λ' || right === '!' ? 'λ' : right });
    }
  });

  if (productions.length === 0) throw new GrammarError('Nenhuma produção encontrada.');
  return productions;
}

/** Separa o lado direito em terminais e a variável final, se houver. */
function splitRight(right, variables) {
  if (right === 'λ') return { terminals: '', variable: null };
  // variáveis mais longas primeiro, para "V10" vencer "V1"
  for (const variable of variables) {
    if (right === variable) return { terminals: '', variable };
    if (right.endsWith(variable)) {
      return { terminals: right.slice(0, right.length - variable.length), variable };
    }
  }
  return { terminals: right, variable: null };
}

/**
 * Constrói o autômato de uma gramática linear à direita.
 *
 * Produções que terminam em terminal (`A → ab`) levam a um estado final único,
 * criado só quando necessário.
 *
 * @param {Production[]} productions
 * @returns {import('./model.js').Automaton}
 * @throws {GrammarError} se alguma produção não for linear à direita
 */
export function grammarToAutomaton(productions) {
  const variables = [...new Set(productions.map((p) => p.left))];
  const byLength = [...variables].sort((a, b) => b.length - a.length || a.localeCompare(b));
  const startVariable = variables.includes('S') ? 'S' : variables[0];

  const automaton = createAutomaton();
  const stateOf = new Map();
  const ordered = [startVariable, ...variables.filter((v) => v !== startVariable)];
  for (const variable of ordered) {
    stateOf.set(
      variable,
      addState(automaton, 0, 0, {
        name: variable,
        initial: variable === startVariable,
        final: false,
      }),
    );
  }

  let accepting = null;
  const acceptingState = () => {
    if (!accepting) {
      accepting = addState(automaton, 0, 0, { name: 'F', initial: false, final: true });
    }
    return accepting;
  };

  for (const { left, right } of productions) {
    const from = stateOf.get(left);
    const { terminals, variable } = splitRight(right, byLength);

    if (variable) {
      // o terminal pode ter mais de um símbolo: a transição lê a cadeia inteira
      addTransition(automaton, from.id, stateOf.get(variable).id, terminals);
    } else if (terminals === '') {
      from.final = true;
    } else {
      addTransition(automaton, from.id, acceptingState().id, terminals);
    }
  }

  return automaton;
}

/** Atalho: texto da gramática direto para autômato. */
export function grammarTextToAutomaton(text) {
  return grammarToAutomaton(parseGrammar(text));
}
