/**
 * Leitura e escrita do formato .jff (o XML usado pelo JFLAP).
 *
 * O objetivo é interoperabilidade: arquivos salvos aqui devem abrir no JFLAP e
 * vice-versa. A gramática do formato para autômatos finitos é:
 *
 *   <structure>
 *     <type>fa</type>
 *     <automaton>
 *       <state id="0" name="q0"><x>..</x><y>..</y><initial/><final/></state>
 *       <transition><from>0</from><to>1</to><read>a</read></transition>
 *       <note><text>..</text><x>..</x><y>..</y></note>
 *     </automaton>
 *   </structure>
 *
 * <read/> vazio (ou ausente) representa lambda.
 */

import { addTransition, createAutomaton, START_MARKER } from '../core/model.js';

/** Tipos de <structure> que o JFLAP produz, para mensagens de erro úteis. */
const TYPE_NAMES = {
  fa: 'autômato finito',
  pda: 'autômato com pilha',
  turing: 'máquina de Turing',
  mealy: 'máquina de Mealy',
  moore: 'máquina de Moore',
  grammar: 'gramática',
  re: 'expressão regular',
  lsystem: 'L-System',
  'pumping-lemma': 'lema do bombeamento',
};

export class JFFError extends Error {
  constructor(message) {
    super(message);
    this.name = 'JFFError';
  }
}

function childrenByTag(element, tag) {
  return Array.from(element.children).filter((c) => c.nodeName === tag);
}

/** Texto do primeiro filho direto com esse nome, ou null se não existir. */
function textOf(element, tag) {
  const child = childrenByTag(element, tag)[0];
  return child ? child.textContent : null;
}

function hasChild(element, tag) {
  return childrenByTag(element, tag).length > 0;
}

function toNumber(value, fallback) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {string} text conteúdo do arquivo .jff
 * @returns {{automaton: import('../core/model.js').Automaton, warnings: string[]}}
 * @throws {JFFError} quando o arquivo não é um .jff de autômato finito
 */
export function parseJFF(text) {
  const warnings = [];
  const doc = new DOMParser().parseFromString(text, 'application/xml');

  // navegadores sinalizam XML inválido inserindo um elemento <parsererror>,
  // ora como raiz, ora dentro dela
  const parseError =
    doc.getElementsByTagName('parsererror')[0] ||
    (doc.documentElement && doc.documentElement.nodeName === 'parsererror'
      ? doc.documentElement
      : null);
  if (parseError) {
    throw new JFFError(`XML inválido: ${parseError.textContent.trim().split('\n')[0]}`);
  }

  const structure = doc.documentElement;
  if (!structure || structure.nodeName !== 'structure') {
    throw new JFFError('Elemento raiz <structure> não encontrado — o arquivo não parece ser um .jff.');
  }

  const type = (textOf(structure, 'type') || '').trim();
  if (type !== 'fa' && type !== 'moore' && type !== 'turing' && type !== 'pda') {
    const friendly = TYPE_NAMES[type] || `"${type}"`;
    throw new JFFError(
      `Este arquivo contém ${friendly}. Esta versão lê autômatos finitos (fa), autômatos com pilha (pda), máquinas de Moore (moore) e máquinas de Turing de uma fita (turing).`,
    );
  }

  // JFLAP 7 grava <tapes>N</tapes> para máquinas de várias fitas
  const tapes = Number.parseInt(textOf(structure, 'tapes') ?? '1', 10);
  if (type === 'turing' && tapes > 1) {
    throw new JFFError(`Máquina de Turing com ${tapes} fitas: esta versão lê apenas uma fita.`);
  }

  // O JFLAP 7 envolve o autômato em <automaton>; o JFLAP 4 põe <state> e
  // <transition> direto sob <structure>. Os dois layouts são aceitos.
  const automatonEl = childrenByTag(structure, 'automaton')[0] || structure;

  const automaton = createAutomaton(type);
  const knownIds = new Set();

  const blocks = childrenByTag(automatonEl, 'block');
  if (blocks.length > 0) {
    warnings.push(`${blocks.length} building block(s) ignorado(s) — recurso ainda não suportado.`);
  }

  for (const stateEl of childrenByTag(automatonEl, 'state')) {
    const rawId = stateEl.getAttribute('id');
    const id = Number.parseInt(rawId, 10);
    if (!Number.isInteger(id)) {
      warnings.push(`Estado com id inválido ("${rawId}") ignorado.`);
      continue;
    }
    if (knownIds.has(id)) {
      warnings.push(`Estado com id duplicado (${id}) ignorado.`);
      continue;
    }
    knownIds.add(id);
    automaton.states.push({
      id,
      name: stateEl.getAttribute('name') || `q${id}`,
      x: toNumber(textOf(stateEl, 'x'), 0),
      y: toNumber(textOf(stateEl, 'y'), 0),
      initial: hasChild(stateEl, 'initial'),
      final: hasChild(stateEl, 'final'),
      label: textOf(stateEl, 'label'),
      output: textOf(stateEl, 'output'),
    });
  }

  const initials = automaton.states.filter((s) => s.initial);
  if (initials.length > 1) {
    warnings.push(
      `${initials.length} estados iniciais no arquivo; mantido apenas "${initials[0].name}".`,
    );
    for (const s of initials.slice(1)) s.initial = false;
  }

  for (const transitionEl of childrenByTag(automatonEl, 'transition')) {
    const from = Number.parseInt(textOf(transitionEl, 'from'), 10);
    const to = Number.parseInt(textOf(transitionEl, 'to'), 10);
    if (!knownIds.has(from) || !knownIds.has(to)) {
      warnings.push(`Transição ${from} → ${to} descartada: estado inexistente.`);
      continue;
    }
    // <read/> ausente ou vazio é lambda (AF) ou branco (MT).
    // <transout> do Moore é redundante — repete a saída do estado de destino —
    // e por isso não é guardado: a gravação o reconstrói a partir do estado.
    const read = textOf(transitionEl, 'read') || '';
    if (type === 'turing') {
      let write = textOf(transitionEl, 'write') ?? '';
      // "~" do JFLAP 7 significa "grava o que leu"
      if (write === '~') write = read;
      const move = (textOf(transitionEl, 'move') || 'R').trim().toUpperCase();
      if (!['L', 'R', 'S'].includes(move)) {
        warnings.push(`Transição ${from} → ${to} com movimento "${move}" desconhecido; usado R.`);
      }
      addTransition(automaton, from, to, read, {
        write,
        move: ['L', 'R', 'S'].includes(move) ? move : 'R',
      });
    } else if (type === 'pda') {
      // <pop>/<push> ausentes ou vazios são λ (não desempilha / não empilha)
      addTransition(automaton, from, to, read, {
        pop: textOf(transitionEl, 'pop') || '',
        push: textOf(transitionEl, 'push') || '',
      });
    } else {
      addTransition(automaton, from, to, read);
    }
  }

  if (type === 'turing') {
    // o .jff não diz a convenção da fita; quem usa Δ é do curso (Menezes)
    const usesMarker = automaton.transitions.some(
      (t) => t.read === START_MARKER || t.write === START_MARKER,
    );
    automaton.tape = usesMarker ? 'menezes' : 'jflap';
  }

  if (type === 'pda') {
    // o .jff não guarda o modo de aceitação; sem estado final, só faz sentido
    // aceitar por pilha vazia
    automaton.accept = automaton.states.some((s) => s.final) ? 'final' : 'empty';
  }

  for (const noteEl of childrenByTag(automatonEl, 'note')) {
    automaton.notes.push({
      text: textOf(noteEl, 'text') || '',
      x: toNumber(textOf(noteEl, 'x'), 0),
      y: toNumber(textOf(noteEl, 'y'), 0),
    });
  }

  return { automaton, warnings };
}

function escapeXML(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** O JFLAP escreve coordenadas como float; manter o formato evita ruído no diff. */
function formatCoordinate(n) {
  return Number.isInteger(n) ? `${n}.0` : String(Math.round(n * 100) / 100);
}

/**
 * @param {import('../core/model.js').Automaton} automaton
 * @returns {string} XML pronto para gravar em disco
 */
export function serializeJFF(automaton) {
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  lines.push('<!--Created with AutomataLab (formato .jff, compatível com JFLAP).-->');
  const moore = automaton.type === 'moore';
  const turing = automaton.type === 'turing';
  const pda = automaton.type === 'pda';
  const outputOf = new Map(automaton.states.map((s) => [s.id, s.output]));

  lines.push('<structure>');
  lines.push(`\t<type>${automaton.type}</type>`);
  lines.push('\t<automaton>');

  lines.push('\t\t<!--The list of states.-->');
  for (const s of automaton.states) {
    lines.push(`\t\t<state id="${s.id}" name="${escapeXML(s.name)}">`);
    lines.push(`\t\t\t<x>${formatCoordinate(s.x)}</x>`);
    lines.push(`\t\t\t<y>${formatCoordinate(s.y)}</y>`);
    if (s.label != null) lines.push(`\t\t\t<label>${escapeXML(s.label)}</label>`);
    if (s.initial) lines.push('\t\t\t<initial/>');
    if (s.final) lines.push('\t\t\t<final/>');
    if (moore && s.output != null) lines.push(`\t\t\t<output>${escapeXML(s.output)}</output>`);
    lines.push('\t\t</state>');
  }

  lines.push('\t\t<!--The list of transitions.-->');
  for (const t of automaton.transitions) {
    lines.push('\t\t<transition>');
    lines.push(`\t\t\t<from>${t.from}</from>`);
    lines.push(`\t\t\t<to>${t.to}</to>`);
    lines.push(t.read === '' ? '\t\t\t<read/>' : `\t\t\t<read>${escapeXML(t.read)}</read>`);
    if (turing) {
      lines.push(t.write === '' ? '\t\t\t<write/>' : `\t\t\t<write>${escapeXML(t.write)}</write>`);
      lines.push(`\t\t\t<move>${t.move}</move>`);
    }
    if (pda) {
      lines.push(t.pop === '' ? '\t\t\t<pop/>' : `\t\t\t<pop>${escapeXML(t.pop)}</pop>`);
      lines.push(t.push === '' ? '\t\t\t<push/>' : `\t\t\t<push>${escapeXML(t.push)}</push>`);
    }
    // o JFLAP grava a saída do destino também na transição; reproduzimos para
    // que o arquivo continue abrindo lá sem diferença
    if (moore && outputOf.get(t.to) != null) {
      lines.push(`\t\t\t<transout>${escapeXML(outputOf.get(t.to))}</transout>`);
    }
    lines.push('\t\t</transition>');
  }

  for (const note of automaton.notes) {
    lines.push('\t\t<note>');
    lines.push(`\t\t\t<text>${escapeXML(note.text)}</text>`);
    lines.push(`\t\t\t<x>${formatCoordinate(note.x)}</x>`);
    lines.push(`\t\t\t<y>${formatCoordinate(note.y)}</y>`);
    lines.push('\t\t</note>');
  }

  lines.push('\t</automaton>');
  lines.push('</structure>');
  return `${lines.join('\n')}\n`;
}
