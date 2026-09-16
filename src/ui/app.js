/**
 * Controlador da interface: menus, eventos do canvas, painel de simulação e
 * importação/exportação de arquivos.
 */

import {
  MOVE_DISPLAY,
  START_MARKER,
  addState,
  addTransition,
  alphabet,
  blankDisplay,
  cloneAutomaton,
  createAutomaton,
  displaySymbol,
  getState,
  isTransducer,
  isTuring,
  parseSymbol,
  parseTuringTuple,
  tapeAlphabet,
  tapeConvention,
  transitionLabel,
  removeState,
  removeTransition,
  setInitial,
  toggleFinal,
  transitionsBetween,
  typeName,
  validate,
} from '../core/model.js';
import {
  ConversionError,
  areEquivalent,
  minimizeDFA,
  removeUnreachable,
  removeUseless,
  subsetConstruction,
} from '../core/convert.js';
import {
  GrammarError,
  automatonToGrammar,
  formatGrammar,
  grammarTextToAutomaton,
} from '../core/grammar.js';
import { addTrapState, mergeAutomaton } from '../core/operations.js';
import { RegexError, automatonToRegex, regexToAutomaton } from '../core/regex.js';
import { simulateTuring, tapeOutput } from '../core/turing.js';
import { exampleAutomaton, exampleTuring } from '../core/examples.js';
import {
  nondeterministicStates,
  runBatch,
  simulate,
  simulateMoore,
  trace,
  unknownSymbols,
} from '../core/simulate.js';
import { JFFError, parseJFF, serializeJFF } from '../io/jff.js';
import { downloadPNG, downloadSVG } from '../io/image.js';
import { render } from '../render/canvas.js';
import { boundingBox, distance, STATE_RADIUS } from '../render/geometry.js';
import { springLayout } from '../render/layout.js';

const DEFAULT_VIEWBOX = { x: 0, y: 0, width: 1000, height: 640 };

const state = {
  /** @type {import('../core/model.js').Automaton} */
  automaton: createAutomaton(),
  mode: 'select',
  /** @type {{kind:'state'|'transition', id:any}|null} */
  selection: null,
  /** origem pendente ao criar uma transição @type {number|null} */
  linkFrom: null,
  /** @type {{x:number,y:number}|null} */
  pointer: null,
  drag: null,
  /** true enquanto um diálogo modal está aberto: ignora eventos do canvas */
  busy: false,
  fileName: 'automato.jff',
  viewBox: { ...DEFAULT_VIEWBOX },
  /** @type {null | {input:string, closure:boolean, generations:any[][], index:number, accepted:boolean, accepting:any, halted:string, symbols:string[]}} */
  simulation: null,
  highlight: { lambda: false, nondet: false },
};

const el = {
  canvas: document.getElementById('canvas'),
  status: document.getElementById('status'),
  details: document.getElementById('details'),
  table: document.getElementById('transition-table'),
  fileInput: document.getElementById('file-input'),
  mergeInput: document.getElementById('merge-input'),
  compareInput: document.getElementById('compare-input'),
  fileName: document.getElementById('file-name'),
  dialog: document.getElementById('prompt-dialog'),
  dialogLabel: document.getElementById('prompt-label'),
  dialogInput: document.getElementById('prompt-input'),
  dialogHint: document.getElementById('prompt-hint'),
  simInput: document.getElementById('sim-input'),
  simPanel: document.getElementById('sim-panel'),
  textDialog: document.getElementById('text-dialog'),
  textLabel: document.getElementById('text-label'),
  textArea: document.getElementById('text-area'),
  textHint: document.getElementById('text-hint'),
  textCancel: document.getElementById('text-cancel'),
  textOk: document.getElementById('text-ok'),
  batchDialog: document.getElementById('batch-dialog'),
  batchInput: document.getElementById('batch-input'),
  batchResults: document.getElementById('batch-results'),
};

/* ------------------------------------------------------------------ *
 * Diálogo de entrada
 *
 * Substitui window.prompt: este é bloqueado em iframes e em navegadores
 * embutidos, além de ser inutilizável em tela de toque.
 * ------------------------------------------------------------------ */

/**
 * Os diálogos são resolvidos pelos próprios botões, e não pelo evento `close`
 * do <dialog>: há navegadores embutidos que não o disparam, e nesse caso a
 * promessa ficaria pendurada para sempre com a interface travada em `busy`.
 * O `close` continua ligado como rede de segurança para o Esc.
 */
let pendingPrompt = null;

/** @returns {Promise<string|null>} null quando o usuário cancela */
function ask(label, initial = '', hint = '') {
  el.dialogLabel.textContent = label;
  el.dialogInput.value = initial;
  el.dialogHint.textContent = hint;
  el.dialog.showModal();
  el.dialogInput.select();

  state.busy = true;
  return new Promise((resolve) => {
    pendingPrompt = resolve;
  });
}

/** Fecha e resolve. Idempotente: vale o primeiro caminho que chegar. */
function settlePrompt(value) {
  if (!pendingPrompt) return;
  const resolve = pendingPrompt;
  pendingPrompt = null;
  state.busy = false;
  if (el.dialog.open) el.dialog.close();
  resolve(value);
}

el.dialog.querySelector('form').addEventListener('submit', (event) => {
  // o fechamento é nosso; method="dialog" sozinho não resolveria a promessa
  event.preventDefault();
  settlePrompt(el.dialogInput.value);
});
document.getElementById('prompt-cancel').addEventListener('click', () => settlePrompt(null));
el.dialog.addEventListener('cancel', () => settlePrompt(null));
el.dialog.addEventListener('close', () => settlePrompt(null));

/**
 * Diálogo de texto com várias linhas. Serve para os dois sentidos das
 * conversões textuais: entrada (gramática, expressão) e exibição do resultado.
 *
 * @param {{label:string, value?:string, hint?:string, readOnly?:boolean}} options
 * @returns {Promise<string|null>} null quando o usuário cancela ou só fecha
 */
let pendingText = null;

function askText({ label, value = '', hint = '', readOnly = false }) {
  el.textLabel.textContent = label;
  el.textArea.value = value;
  el.textArea.readOnly = readOnly;
  el.textHint.textContent = hint;
  el.textCancel.hidden = readOnly;
  el.textOk.textContent = readOnly ? 'Fechar' : 'OK';
  el.textDialog.showModal();
  if (readOnly) el.textArea.select();
  else el.textArea.focus();

  state.busy = true;
  return new Promise((resolve) => {
    pendingText = { resolve, readOnly };
  });
}

/** Ver a nota em settlePrompt: mesma razão para não usar o evento `close`. */
function settleText(value) {
  if (!pendingText) return;
  const { resolve } = pendingText;
  pendingText = null;
  state.busy = false;
  if (el.textDialog.open) el.textDialog.close();
  resolve(value);
}

el.textCancel.addEventListener('click', () => settleText(null));
el.textOk.addEventListener('click', () => settleText(pendingText?.readOnly ? null : el.textArea.value));
el.textDialog.addEventListener('cancel', () => settleText(null));
el.textDialog.addEventListener('close', () => settleText(null));

/* ------------------------------------------------------------------ *
 * Histórico
 *
 * Pilha de cópias do autômato. As conversões substituem o autômato inteiro,
 * então desfazer deixou de ser conforto e virou rede de segurança.
 * ------------------------------------------------------------------ */

const LIMITE_HISTORICO = 60;
const history = { past: [], future: [] };

/** O nome do arquivo entra no instantâneo: as conversões o alteram junto. */
function currentEntry() {
  return { automaton: cloneAutomaton(state.automaton), fileName: state.fileName };
}

/** Guarda o estado atual antes de uma alteração. Chame ANTES de mudar. */
function snapshot() {
  history.past.push(currentEntry());
  if (history.past.length > LIMITE_HISTORICO) history.past.shift();
  history.future.length = 0;
}

function restore(entry) {
  state.automaton = entry.automaton;
  state.fileName = entry.fileName;
  el.fileName.textContent = entry.fileName;
  state.selection = null;
  state.linkFrom = null;
  state.simulation = null;
  refresh();
}

function undo() {
  if (history.past.length === 0) {
    setStatus('Nada a desfazer.');
    return;
  }
  history.future.push(currentEntry());
  restore(history.past.pop());
  setStatus('Desfeito.');
}

function redo() {
  if (history.future.length === 0) {
    setStatus('Nada a refazer.');
    return;
  }
  history.past.push(currentEntry());
  restore(history.future.pop());
  setStatus('Refeito.');
}

/* ------------------------------------------------------------------ *
 * Coordenadas
 * ------------------------------------------------------------------ */

/** Converte coordenadas de tela para o espaço do SVG (respeita o viewBox). */
function toLocal(event) {
  const ctm = el.canvas.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const point = el.canvas.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const local = point.matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}

function applyViewBox() {
  const { x, y, width, height } = state.viewBox;
  el.canvas.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
}

/** Enquadra todos os estados na área visível. */
function fitToContent() {
  // mede o desenho já renderizado, para laços e rótulos entrarem na conta;
  // a caixa dos círculos é o recurso quando ainda não há nada desenhado
  render(el.canvas, state.automaton, viewOptions());
  let box = null;
  try {
    const drawn = el.canvas.getBBox();
    if (drawn.width > 0 && drawn.height > 0) {
      const margin = 36;
      box = { x: drawn.x - margin, y: drawn.y - margin, width: drawn.width + 2 * margin, height: drawn.height + 2 * margin };
    }
  } catch {
    /* fora do DOM não há como medir */
  }
  if (!box) box = boundingBox(state.automaton.states);
  if (!box) {
    state.viewBox = { ...DEFAULT_VIEWBOX };
  } else {
    // mantém a proporção do viewBox padrão para não distorcer os círculos
    const ratio = DEFAULT_VIEWBOX.width / DEFAULT_VIEWBOX.height;
    let { width, height } = box;
    if (width / height < ratio) width = height * ratio;
    else height = width / ratio;
    state.viewBox = {
      x: box.x + box.width / 2 - width / 2,
      y: box.y + box.height / 2 - height / 2,
      width,
      height,
    };
  }
  applyViewBox();
}

/* ------------------------------------------------------------------ *
 * Feedback
 * ------------------------------------------------------------------ */

function setStatus(message, kind = 'info') {
  el.status.textContent = message;
  el.status.className = `status ${kind}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ------------------------------------------------------------------ *
 * Painel lateral
 * ------------------------------------------------------------------ */

function renderDetails() {
  const problems = validate(state.automaton);
  const parts = [];

  const { states, transitions } = state.automaton;
  const turing = isTuring(state.automaton);
  const symbols = turing
    ? tapeAlphabet(state.automaton).map((s) => (s === '' ? blankDisplay(state.automaton) : s))
    : alphabet(state.automaton);
  const convencao = turing
    ? ` · fita ${tapeConvention(state.automaton) === 'menezes' ? 'Menezes (Δ)' : 'JFLAP'}`
    : '';
  parts.push(
    `<p class="counts">${escapeHTML(typeName(state.automaton))} · ${states.length} estado(s) · ${transitions.length} transição(ões) · ${turing ? 'alfabeto da fita' : 'alfabeto'} {${escapeHTML(symbols.join(', ')) || '∅'}}${convencao}</p>`,
  );

  if (problems.length > 0) {
    parts.push(`<ul class="problems">${problems.map((p) => `<li>${p}</li>`).join('')}</ul>`);
  }

  if (state.selection?.kind === 'state') {
    const selected = getState(state.automaton, state.selection.id);
    if (selected) {
      // numa máquina de Moore não há estado final; o que se edita é a saída
      const especifico = isTransducer(state.automaton)
        ? `<button data-act="output">${selected.output ? 'Alterar' : 'Definir'} saída</button>`
        : `<button data-act="final">${selected.final ? 'Remover' : 'Marcar'} final</button>`;
      parts.push(`
        <h3>Estado ${escapeHTML(selected.name)}${selected.output ? ` <code>/${escapeHTML(selected.output)}</code>` : ''}</h3>
        <div class="actions">
          <button data-act="rename">Renomear</button>
          <button data-act="initial"${selected.initial ? ' disabled' : ''}>Tornar inicial</button>
          ${especifico}
          <button data-act="delete" class="danger">Excluir</button>
        </div>`);
    }
  } else if (state.selection?.kind === 'transition') {
    const selected = state.automaton.transitions.find((t) => t.id === state.selection.id);
    if (selected) {
      const from = getState(state.automaton, selected.from);
      const to = getState(state.automaton, selected.to);
      const siblings = transitionsBetween(state.automaton, selected.from, selected.to);
      parts.push(`
        <h3>${escapeHTML(from.name)} → ${escapeHTML(to.name)}</h3>
        <ul class="symbols">${siblings
          .map(
            (t) =>
              `<li><code>${escapeHTML(transitionLabel(state.automaton, t))}</code><button data-act="del-symbol" data-id="${t.id}" title="Remover">×</button></li>`,
          )
          .join('')}</ul>
        <div class="actions">
          <button data-act="add-symbol">${isTuring(state.automaton) ? 'Adicionar transição' : 'Adicionar símbolo'}</button>
        </div>`);
    }
  } else {
    parts.push('<p class="hint">Selecione um estado ou transição para editar.</p>');
  }

  el.details.innerHTML = parts.join('');
}

/** Tabela Π da MT, no formato do curso: célula = (destino, gravado, movimento). */
function renderTuringTable() {
  const { automaton } = state;
  const blank = blankDisplay(automaton);
  const columns = tapeAlphabet(automaton);
  const cell = (s) => (s === '' ? blank : s);
  const header = columns.map((c) => `<th>${escapeHTML(cell(c))}</th>`).join('');
  const rows = [...automaton.states]
    .sort((a, b) => a.id - b.id)
    .map((s) => {
      const marks = `${s.initial ? '→' : ''}${s.final ? '*' : ''}`;
      const cells = columns
        .map((symbol) => {
          const entries = automaton.transitions
            .filter((t) => t.from === s.id && t.read === symbol)
            .map((t) => `(${nameOf(t.to)}, ${cell(t.write)}, ${MOVE_DISPLAY[t.move] ?? t.move})`);
          return `<td>${entries.length ? escapeHTML(entries.join(' ')) : '—'}</td>`;
        })
        .join('');
      return `<tr><th scope="row">${marks}${escapeHTML(s.name)}</th>${cells}</tr>`;
    })
    .join('');
  el.table.innerHTML = `<table><thead><tr><th>Π</th>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderTable() {
  const { automaton } = state;
  if (automaton.states.length === 0) {
    el.table.innerHTML = '<p class="hint">Sem estados.</p>';
    return;
  }
  if (isTuring(automaton)) {
    renderTuringTable();
    return;
  }
  const symbols = alphabet(automaton);
  const hasLambda = automaton.transitions.some((t) => t.read === '');
  const columns = hasLambda ? [...symbols, ''] : symbols;

  const moore = isTransducer(automaton);
  const header =
    (moore ? '<th>saída</th>' : '') +
    columns.map((c) => `<th>${escapeHTML(displaySymbol(c))}</th>`).join('');
  // a tabela é ordenada por id; a ordem do arquivo é preservada na gravação
  const rows = [...automaton.states]
    .sort((a, b) => a.id - b.id)
    .map((s) => {
      const marks = `${s.initial ? '→' : ''}${s.final ? '*' : ''}`;
      const saida = moore ? `<td class="cell-output">${escapeHTML(s.output ?? '—')}</td>` : '';
      const cells =
        saida +
        columns
          .map((symbol) => {
            const targets = automaton.transitions
              .filter((t) => t.from === s.id && t.read === symbol)
              .map((t) => getState(automaton, t.to)?.name)
              .filter(Boolean);
            return `<td>${targets.length ? escapeHTML(targets.join(', ')) : '—'}</td>`;
          })
          .join('');
      return `<tr><th scope="row">${marks}${escapeHTML(s.name)}</th>${cells}</tr>`;
    })
    .join('');

  el.table.innerHTML = `<table><thead><tr><th></th>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

/* ------------------------------------------------------------------ *
 * Painel de simulação
 * ------------------------------------------------------------------ */

/** Fita com a parte já consumida separada do que falta ler. */
function renderTape(symbols, position) {
  const done = escapeHTML(symbols.slice(0, position).join(''));
  const rest = escapeHTML(symbols.slice(position).join(''));
  return `<code class="tape"><span class="done">${done}</span><span class="caret"></span>${rest || '<span class="eof">⊣</span>'}</code>`;
}

function nameOf(id) {
  return getState(state.automaton, id)?.name ?? `#${id}`;
}

/** Caminho aceito, no formato q0 —a→ q1 —b→ q2. */
function renderPath(path) {
  return path
    .map((config, i) =>
      i === 0
        ? escapeHTML(nameOf(config.state))
        : `<span class="arrow">—${escapeHTML(displaySymbol(config.read))}→</span> ${escapeHTML(nameOf(config.state))}`,
    )
    .join(' ');
}

function renderSimulationPanel() {
  const sim = state.simulation;
  if (!sim) {
    el.simPanel.innerHTML =
      '<p class="hint">Digite uma cadeia e use <b>Testar</b>, ou o menu <b>Entrada</b> para acompanhar passo a passo.</p>';
    return;
  }

  if (sim.kind === 'moore') {
    renderMoorePanel(sim);
    return;
  }
  if (sim.kind === 'turing') {
    renderTuringPanel(sim);
    return;
  }

  const parts = [];
  const modo = sim.closure ? 'com fecho-λ' : 'por estado';

  if (sim.mode === 'fast') {
    parts.push(
      sim.accepted
        ? '<p class="verdict accept">Aceita</p>'
        : `<p class="verdict reject">Rejeita</p>`,
    );
    parts.push(`<p class="counts">entrada <code>${escapeHTML(sim.input) || 'λ'}</code> · ${modo}</p>`);
    if (sim.accepted) {
      parts.push(`<p class="path">${renderPath(trace(sim.accepting))}</p>`);
    } else if (sim.halted === 'limite') {
      parts.push('<p class="problems">A simulação atingiu o limite de passos.</p>');
    }
  } else {
    const configs = sim.generations[sim.index] || [];
    parts.push(`
      <div class="stepper">
        <button type="button" data-step="first" title="Início">⏮</button>
        <button type="button" data-step="prev" title="Passo anterior">◀</button>
        <button type="button" data-step="next" title="Próximo passo">▶</button>
        <button type="button" data-step="last" title="Fim">⏭</button>
        <span class="counts">passo ${sim.index} de ${sim.generations.length - 1} · ${modo}</span>
      </div>`);

    if (configs.length === 0) {
      parts.push('<p class="verdict reject">Sem configurações — a cadeia é rejeitada.</p>');
    } else {
      parts.push(
        `<ul class="configs">${configs
          .map(
            (config) =>
              `<li${isAcceptingConfig(config, sim) ? ' class="accept"' : ''}><span class="cfg-state">${escapeHTML(nameOf(config.state))}</span>${renderTape(sim.symbols, config.position)}</li>`,
          )
          .join('')}</ul>`,
      );
    }

    if (sim.index === sim.generations.length - 1) {
      parts.push(
        sim.accepted
          ? '<p class="verdict accept">Aceita</p>'
          : '<p class="verdict reject">Rejeita</p>',
      );
    }
  }

  el.simPanel.innerHTML = parts.join('');
}

/**
 * Painel da máquina de Moore: em vez de aceita/rejeita, a fita de saída.
 * No modo passo a passo mostra só o que já foi emitido até o passo atual.
 */
function renderMoorePanel(sim) {
  const parts = [];
  const ate = sim.mode === 'step' ? sim.index + 1 : sim.steps.length;
  const emitido = sim.steps.slice(0, ate).map((s) => s.output ?? '?');

  if (sim.halted === 'sem-inicial') {
    parts.push('<p class="verdict reject">Sem estado inicial: nada a executar.</p>');
    el.simPanel.innerHTML = parts.join('');
    return;
  }

  if (sim.mode === 'step') {
    parts.push(`
      <div class="stepper">
        <button type="button" data-step="first" title="Início">⏮</button>
        <button type="button" data-step="prev" title="Passo anterior">◀</button>
        <button type="button" data-step="next" title="Próximo passo">▶</button>
        <button type="button" data-step="last" title="Fim">⏭</button>
        <span class="counts">passo ${sim.index} de ${sim.steps.length - 1}</span>
      </div>`);
    const atual = sim.steps[sim.index];
    parts.push(
      `<ul class="configs"><li><span class="cfg-state">${escapeHTML(nameOf(atual.state))}</span>${renderTape(sim.symbols, atual.position)}</li></ul>`,
    );
  }

  parts.push('<p class="counts">saída emitida</p>');
  parts.push(`<p class="path">${emitido.map((o) => escapeHTML(o)).join(' <span class="arrow">·</span> ') || '—'}</p>`);

  if (ate === sim.steps.length) {
    if (sim.halted === 'sem-transicao') {
      const parou = sim.steps[sim.steps.length - 1];
      parts.push(
        `<p class="verdict reject">Travou em ${escapeHTML(nameOf(parou.state))}: não há transição lendo "${escapeHTML(sim.symbols[parou.position] ?? '')}".</p>`,
      );
    } else {
      parts.push('<p class="verdict accept">Entrada consumida por inteiro.</p>');
    }
  }
  if (sim.ambiguous) {
    parts.push(
      '<p class="problems">Há mais de uma transição possível em algum passo; a execução seguiu a primeira.</p>',
    );
  }

  el.simPanel.innerHTML = parts.join('');
}

/**
 * Uma configuração de MT como fita desenhada: células em linha, a que está sob
 * a cabeça destacada, o estado à esquerda. Brancos à direita são cortados,
 * exceto o que está sob a cabeça.
 */
function renderTuringConfig(config, { accepting = false } = {}) {
  const blank = blankDisplay(state.automaton);
  const cells = config.cells.slice();
  while (cells.length <= config.head) cells.push('');
  let end = cells.length;
  while (end - 1 > config.head && cells[end - 1] === '') end -= 1;
  // uma célula de folga à direita, para a cabeça ter para onde ir
  const shown = cells.slice(0, end + 1);
  const html = shown
    .map((c, i) => {
      const classes = ['cell'];
      if (i === config.head) classes.push('head');
      if (c === '') classes.push('blank');
      if (c === START_MARKER) classes.push('marker');
      return `<span class="${classes.join(' ')}">${escapeHTML(c === '' ? blank : c)}</span>`;
    })
    .join('');
  return `<li class="tm-config${accepting ? ' accept' : ''}"><span class="cfg-state">${escapeHTML(nameOf(config.state))}</span><span class="tm-tape">${html}</span></li>`;
}

function renderTuringPanel(sim) {
  const parts = [];
  const last = sim.generations.length - 1;

  if (sim.halted === 'sem-inicial') {
    el.simPanel.innerHTML = '<p class="verdict reject">Sem estado inicial: nada a executar.</p>';
    return;
  }

  const finais = new Set(state.automaton.states.filter((s) => s.final).map((s) => s.id));

  if (sim.mode === 'step') {
    parts.push(`
      <div class="stepper">
        <button type="button" data-step="first" title="Início">⏮</button>
        <button type="button" data-step="prev" title="Passo anterior">◀</button>
        <button type="button" data-step="next" title="Próximo passo">▶</button>
        <button type="button" data-step="last" title="Fim">⏭</button>
        <span class="counts">passo ${sim.index} de ${last}</span>
      </div>`);
    const configs = sim.generations[sim.index] || [];
    parts.push(
      `<ul class="configs">${configs.map((c) => renderTuringConfig(c, { accepting: finais.has(c.state) })).join('')}</ul>`,
    );
    if (configs.length > 1) {
      parts.push(`<p class="counts">${configs.length} computações em paralelo (Π não é função)</p>`);
    }
  } else {
    // execução rápida: a configuração final, e o caminho se aceitou
    const finalConfig = sim.accepting ?? sim.generations[last]?.[0];
    if (finalConfig) {
      parts.push(`<ul class="configs">${renderTuringConfig(finalConfig, { accepting: sim.accepted })}</ul>`);
    }
    if (sim.accepted) {
      parts.push(`<p class="counts">fita ao parar: <code>${escapeHTML(tapeOutput(sim.accepting) || 'vazia')}</code> · ${sim.steps} passo(s)</p>`);
    }
  }

  if (sim.mode === 'fast' || sim.index === last) {
    if (sim.halted === 'aceitou') {
      parts.push('<p class="verdict accept">Aceita — parou em estado final</p>');
    } else if (sim.halted === 'limite') {
      parts.push(`<p class="verdict reject">Não parou em ${sim.steps} passos — possível loop</p>`);
    } else {
      parts.push(`<p class="verdict reject">Rejeita — ${escapeHTML(sim.reason)}</p>`);
    }
  }

  el.simPanel.innerHTML = parts.join('');
}

function isAcceptingConfig(config, sim) {
  if (config.position !== sim.symbols.length) return false;
  return Boolean(getState(state.automaton, config.state)?.final);
}

/* ------------------------------------------------------------------ *
 * Redesenho
 * ------------------------------------------------------------------ */

function activeStates() {
  const sim = state.simulation;
  if (!sim) return null;
  if (sim.kind === 'moore') {
    return sim.mode === 'step'
      ? new Set([sim.steps[sim.index]?.state])
      : new Set(sim.steps.map((s) => s.state));
  }
  if (sim.mode === 'fast') {
    return sim.accepted ? new Set(trace(sim.accepting).map((c) => c.state)) : null;
  }
  return new Set((sim.generations[sim.index] || []).map((c) => c.state));
}

/** O que o desenho precisa saber além do autômato. */
function viewOptions() {
  return {
    selection: state.selection,
    linkFrom: state.linkFrom,
    pointer: state.pointer,
    active: activeStates(),
    nondet: state.highlight.nondet ? nondeterministicStates(state.automaton) : null,
    showLambda: state.highlight.lambda,
  };
}

function refresh() {
  render(el.canvas, state.automaton, viewOptions());
  renderDetails();
  renderTable();
  renderSimulationPanel();
}

/** Toda edição estrutural invalida a simulação em curso. */
function invalidateSimulation() {
  state.simulation = null;
}

/* ------------------------------------------------------------------ *
 * Interação no canvas
 * ------------------------------------------------------------------ */

/** Estado sob o ponto, se houver. */
function stateAt(point) {
  // percorre de trás para frente: o desenhado por último está por cima
  for (let i = state.automaton.states.length - 1; i >= 0; i -= 1) {
    const s = state.automaton.states[i];
    if (distance(point, s) <= STATE_RADIUS) return s;
  }
  return null;
}

function beginTransition(fromId) {
  state.linkFrom = fromId;
  setStatus('Clique no estado de destino (Esc cancela).');
}

/** Texto de ajuda do diálogo de transição, conforme o tipo de máquina. */
const TRANSITION_PROMPT = {
  turing: {
    label: 'Transição: lido, gravado, movimento',
    hint: 'Como no curso: a,A,D — E/D para o movimento, ß ou vazio para branco, Δ ou ^ para o marcador. Várias: a,A,D; b,B,E',
  },
  default: {
    label: 'Símbolo lido',
    hint: 'Deixe vazio para λ. Separe alternativas por vírgula: a,b',
  },
};

/**
 * Interpreta o texto digitado como uma lista de transições. Tudo é validado
 * antes de qualquer alteração: uma tupla malformada lança sem deixar rastro.
 * @returns {{read:string, extra:object}[]}
 */
function parseTransitionsText(input) {
  if (isTuring(state.automaton)) {
    return input
      .split(';')
      .filter((raw) => raw.trim() !== '')
      .map((raw) => {
        const { read, write, move } = parseTuringTuple(raw);
        return { read, extra: { write, move } };
      });
  }
  const symbols = input.includes(',') ? input.split(',') : [input];
  return symbols.map((raw) => ({ read: parseSymbol(raw), extra: {} }));
}

async function completeTransition(toId) {
  const fromId = state.linkFrom;
  state.linkFrom = null;
  refresh();
  const prompt = TRANSITION_PROMPT[state.automaton.type] ?? TRANSITION_PROMPT.default;
  const input = await ask(prompt.label, '', prompt.hint);
  if (input === null) {
    setStatus('Transição cancelada.');
    refresh();
    return;
  }
  let parsed;
  try {
    parsed = parseTransitionsText(input);
  } catch (error) {
    setStatus(error.message, 'error');
    refresh();
    return;
  }
  snapshot();
  let created = 0;
  for (const { read, extra } of parsed) {
    if (addTransition(state.automaton, fromId, toId, read, extra)) created += 1;
  }
  invalidateSimulation();
  setStatus(created > 0 ? `${created} transição(ões) criada(s).` : 'Transição já existia.');
  refresh();
}

el.canvas.addEventListener('pointerdown', (event) => {
  if (state.busy) return;
  const point = toLocal(event);
  const hit = stateAt(point);

  if (state.mode === 'state') {
    if (!hit) {
      snapshot();
      const created = addState(state.automaton, point.x, point.y);
      state.selection = { kind: 'state', id: created.id };
      invalidateSimulation();
      setStatus(`Estado ${created.name} criado.`);
      refresh();
    }
    return;
  }

  if (state.mode === 'transition') {
    if (!hit) {
      state.linkFrom = null;
      refresh();
      return;
    }
    if (state.linkFrom == null) beginTransition(hit.id);
    else completeTransition(hit.id);
    refresh();
    return;
  }

  if (state.mode === 'erase') {
    if (hit) {
      snapshot();
      removeState(state.automaton, hit.id);
      state.selection = null;
      invalidateSimulation();
      setStatus(`Estado ${hit.name} removido.`);
      refresh();
      return;
    }
    const edge = event.target.closest('.edge');
    if (edge) {
      snapshot();
      const { from, to } = edge.dataset;
      for (const t of transitionsBetween(state.automaton, Number(from), Number(to))) {
        removeTransition(state.automaton, t.id);
      }
      state.selection = null;
      invalidateSimulation();
      setStatus('Transições removidas.');
      refresh();
    }
    return;
  }

  // modo seleção
  if (hit) {
    state.selection = { kind: 'state', id: hit.id };
    state.drag = { id: hit.id, dx: point.x - hit.x, dy: point.y - hit.y, moved: false };
    el.canvas.setPointerCapture(event.pointerId);
    refresh();
    return;
  }
  const edge = event.target.closest('.edge');
  if (edge) {
    state.selection = { kind: 'transition', id: edge.dataset.transitionId };
  } else {
    state.selection = null;
  }
  refresh();
});

el.canvas.addEventListener('pointermove', (event) => {
  if (state.drag) {
    const point = toLocal(event);
    const dragged = getState(state.automaton, state.drag.id);
    if (dragged) {
      // o instantâneo é tirado no primeiro movimento, não no clique: um clique
      // que não arrasta nada não deve entrar no histórico
      if (!state.drag.moved) snapshot();
      dragged.x = point.x - state.drag.dx;
      dragged.y = point.y - state.drag.dy;
      state.drag.moved = true;
      refresh();
    }
    return;
  }
  if (state.linkFrom != null) {
    state.pointer = toLocal(event);
    refresh();
  }
});

function endDrag(event) {
  if (!state.drag) return;
  try {
    el.canvas.releasePointerCapture(event.pointerId);
  } catch {
    /* o ponteiro pode já ter sido liberado */
  }
  state.drag = null;
}

el.canvas.addEventListener('pointerup', endDrag);
el.canvas.addEventListener('pointercancel', endDrag);

el.canvas.addEventListener('dblclick', (event) => {
  if (state.busy) return;
  const hit = stateAt(toLocal(event));
  if (!hit) return;
  renameState(hit.id);
});

document.addEventListener('keydown', (event) => {
  if (state.busy) return;

  // desfazer/refazer valem mesmo com o foco num campo de texto
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }

  if (event.target.matches('input, textarea')) return;
  if (event.key === 'Escape') {
    state.linkFrom = null;
    state.selection = null;
    closeMenus();
    refresh();
    return;
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && state.selection) {
    event.preventDefault();
    deleteSelection();
  }
  if (state.simulation?.mode === 'step') {
    if (event.key === 'ArrowRight') stepTo(state.simulation.index + 1);
    if (event.key === 'ArrowLeft') stepTo(state.simulation.index - 1);
  }
});

function deleteSelection() {
  snapshot();
  if (state.selection?.kind === 'state') {
    removeState(state.automaton, state.selection.id);
    setStatus('Estado removido.');
  } else if (state.selection?.kind === 'transition') {
    removeTransition(state.automaton, state.selection.id);
    setStatus('Transição removida.');
  }
  state.selection = null;
  invalidateSimulation();
  refresh();
}

async function renameState(id) {
  const target = getState(state.automaton, id);
  if (!target) return;
  const name = await ask('Nome do estado', target.name);
  if (name === null) return;
  const trimmed = name.trim();
  if (trimmed === '') {
    setStatus('Nome vazio ignorado.', 'warn');
    return;
  }
  snapshot();
  target.name = trimmed;
  refresh();
}

/* ------------------------------------------------------------------ *
 * Painel lateral: ações
 * ------------------------------------------------------------------ */

el.details.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const action = button.dataset.act;

  if (state.selection?.kind === 'state') {
    const id = state.selection.id;
    if (action === 'rename') renameState(id);
    else if (action === 'initial') {
      snapshot();
      setInitial(state.automaton, id);
      invalidateSimulation();
    } else if (action === 'final') {
      snapshot();
      toggleFinal(state.automaton, id);
      invalidateSimulation();
    } else if (action === 'output') {
      const target = getState(state.automaton, id);
      ask('Saída do estado', target?.output ?? '', 'Deixe vazio para remover a saída.').then(
        (value) => {
          if (value !== null && target) {
            snapshot();
            target.output = value.trim() === '' ? null : value.trim();
            invalidateSimulation();
          }
          refresh();
        },
      );
      return;
    } else if (action === 'delete') deleteSelection();
    refresh();
    return;
  }

  if (state.selection?.kind === 'transition') {
    const selected = state.automaton.transitions.find((t) => t.id === state.selection.id);
    if (!selected) return;
    if (action === 'del-symbol') {
      snapshot();
      removeTransition(state.automaton, button.dataset.id);
      if (button.dataset.id === state.selection.id) state.selection = null;
      invalidateSimulation();
    } else if (action === 'add-symbol') {
      const prompt = TRANSITION_PROMPT[state.automaton.type] ?? TRANSITION_PROMPT.default;
      ask(prompt.label, '', prompt.hint).then((input) => {
        if (input !== null) {
          try {
            const parsed = parseTransitionsText(input);
            snapshot();
            for (const { read, extra } of parsed) {
              addTransition(state.automaton, selected.from, selected.to, read, extra);
            }
            invalidateSimulation();
          } catch (error) {
            setStatus(error.message, 'error');
          }
        }
        refresh();
      });
      return;
    }
    refresh();
  }
});

el.simPanel.addEventListener('click', (event) => {
  const button = event.target.closest('[data-step]');
  if (!button || !state.simulation) return;
  const sim = state.simulation;
  const last = (sim.kind === 'moore' ? sim.steps.length : sim.generations.length) - 1;
  const target = {
    first: 0,
    prev: state.simulation.index - 1,
    next: state.simulation.index + 1,
    last,
  }[button.dataset.step];
  stepTo(target);
});

/* ------------------------------------------------------------------ *
 * Simulação
 * ------------------------------------------------------------------ */

function warnUnknownSymbols(input) {
  const unknown = unknownSymbols(state.automaton, input);
  if (unknown.length > 0) {
    setStatus(`Símbolo(s) fora do alfabeto: ${unknown.join(', ')}.`, 'warn');
    return true;
  }
  return false;
}

function runTuring(mode) {
  const input = el.simInput.value;
  const result = simulateTuring(state.automaton, input);
  state.simulation = { ...result, kind: 'turing', input, index: 0, mode };
  if (!warnUnknownSymbols(input)) {
    if (mode === 'step') {
      setStatus('Passo a passo: use ▶ ou as setas do teclado.');
    } else if (result.halted === 'aceitou') {
      setStatus(`Aceita em ${result.steps} passo(s).`, 'ok');
    } else if (result.halted === 'limite') {
      setStatus('A máquina não parou — possível loop.', 'warn');
    } else {
      setStatus(`Rejeita: ${result.reason}.`, 'warn');
    }
  }
  refresh();
}

function fastRun() {
  const input = el.simInput.value;

  if (isTuring(state.automaton)) {
    runTuring('fast');
    return;
  }

  if (isTransducer(state.automaton)) {
    const result = simulateMoore(state.automaton, input);
    state.simulation = { ...result, kind: 'moore', input, index: 0, mode: 'fast' };
    if (!warnUnknownSymbols(input)) {
      setStatus(
        result.halted === 'sem-transicao'
          ? 'A execução travou antes do fim da entrada.'
          : `Saída: ${result.output.join(' · ') || '—'}`,
        result.halted === 'fim' ? 'ok' : 'warn',
      );
    }
    refresh();
    return;
  }

  const result = simulate(state.automaton, input, { closure: true });
  state.simulation = { ...result, input, closure: true, index: 0, mode: 'fast' };
  if (!warnUnknownSymbols(input)) {
    setStatus(result.accepted ? 'Cadeia aceita.' : 'Cadeia rejeitada.', result.accepted ? 'ok' : 'warn');
  }
  refresh();
}

function startStepping(closure) {
  const input = el.simInput.value;

  if (isTuring(state.automaton)) {
    runTuring('step');
    return;
  }

  if (isTransducer(state.automaton)) {
    const result = simulateMoore(state.automaton, input);
    state.simulation = { ...result, kind: 'moore', input, index: 0, mode: 'step' };
    if (!warnUnknownSymbols(input)) {
      setStatus('Passo a passo: use ▶ ou as setas do teclado.');
    }
    refresh();
    return;
  }

  const result = simulate(state.automaton, input, { closure });
  state.simulation = { ...result, input, closure, index: 0, mode: 'step' };
  if (!warnUnknownSymbols(input)) {
    setStatus(
      `Passo a passo ${closure ? 'com fecho-λ' : 'por estado'}: use ▶ ou as setas do teclado.`,
    );
  }
  refresh();
}

function stepTo(index) {
  const sim = state.simulation;
  if (!sim || sim.mode !== 'step') return;
  const last = (sim.kind === 'moore' ? sim.steps.length : sim.generations.length) - 1;
  sim.index = Math.min(Math.max(index, 0), last);
  refresh();
}

el.simInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') fastRun();
});
document.getElementById('sim-fast').addEventListener('click', fastRun);

/* -------------------- várias entradas -------------------- */

function openBatch() {
  el.batchResults.innerHTML = '';
  state.busy = true;
  el.batchDialog.showModal();
  el.batchInput.focus();
}

function closeBatch() {
  state.busy = false;
  if (el.batchDialog.open) el.batchDialog.close();
}

// o evento `close` é apenas rede de segurança; ver a nota em settlePrompt
el.batchDialog.addEventListener('close', () => {
  state.busy = false;
});
el.batchDialog.addEventListener('cancel', closeBatch);
document.getElementById('batch-close').addEventListener('click', closeBatch);

document.getElementById('batch-run').addEventListener('click', () => {
  const inputs = el.batchInput.value.split('\n');

  if (isTuring(state.automaton)) {
    const rows = inputs
      .map((input) => {
        const r = simulateTuring(state.automaton, input);
        const texto = r.halted === 'aceitou' ? 'aceita' : r.halted === 'limite' ? 'loop?' : 'rejeita';
        const classe = r.halted === 'aceitou' ? 'accept' : 'reject';
        return `<tr><td><code>${escapeHTML(input) || 'λ'}</code></td><td class="${classe}">${texto}</td><td>${r.steps}</td></tr>`;
      })
      .join('');
    const aceitas = inputs.filter((i) => simulateTuring(state.automaton, i).accepted).length;
    el.batchResults.innerHTML = `
      <p class="counts">${aceitas} de ${inputs.length} aceita(s)</p>
      <table class="batch"><thead><tr><th>cadeia</th><th>resultado</th><th>passos</th></tr></thead><tbody>${rows}</tbody></table>`;
    return;
  }

  if (isTransducer(state.automaton)) {
    const rows = inputs
      .map((input) => {
        const r = simulateMoore(state.automaton, input);
        const travou = r.halted !== 'fim';
        return `<tr><td><code>${escapeHTML(input) || 'λ'}</code></td><td class="${travou ? 'reject' : ''}">${escapeHTML(r.output.join(' · ')) || '—'}${travou ? ' (travou)' : ''}</td></tr>`;
      })
      .join('');
    el.batchResults.innerHTML = `
      <p class="counts">${inputs.length} entrada(s)</p>
      <table class="batch"><thead><tr><th>cadeia</th><th>saída</th></tr></thead><tbody>${rows}</tbody></table>`;
    return;
  }

  const results = runBatch(state.automaton, inputs, { closure: true });
  const rows = results
    .map(
      (r) =>
        `<tr><td><code>${escapeHTML(r.input) || 'λ'}</code></td><td class="${r.accepted ? 'accept' : 'reject'}">${r.accepted ? 'aceita' : 'rejeita'}</td></tr>`,
    )
    .join('');
  const aceitas = results.filter((r) => r.accepted).length;
  el.batchResults.innerHTML = `
    <p class="counts">${aceitas} de ${results.length} aceita(s)</p>
    <table class="batch"><thead><tr><th>cadeia</th><th>resultado</th></tr></thead><tbody>${rows}</tbody></table>`;
});

/* ------------------------------------------------------------------ *
 * Menus
 * ------------------------------------------------------------------ */

function closeMenus() {
  for (const menu of document.querySelectorAll('.menu[open]')) menu.open = false;
}

// clique fora fecha o menu aberto
document.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('.menu')) closeMenus();
});

// só um menu aberto por vez
for (const menu of document.querySelectorAll('.menu')) {
  menu.addEventListener('toggle', () => {
    if (!menu.open) return;
    for (const other of document.querySelectorAll('.menu[open]')) {
      if (other !== menu) other.open = false;
    }
  });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-cmd]');
  if (!button) return;
  closeMenus();
  runCommand(button.dataset.cmd);
});

/** Conversões e testes de linguagem pressupõem um acceptor, não um transdutor. */
const SOMENTE_AF = new Set([
  'to-dfa',
  'minimize',
  'remove-unreachable',
  'remove-useless',
  'trap',
  'to-regex',
  'to-grammar',
  'compare',
]);

function runCommand(command) {
  if (SOMENTE_AF.has(command) && state.automaton.type !== 'fa') {
    setStatus(
      `Esta operação vale para autômatos finitos; o documento atual é uma ${typeName(state.automaton)}.`,
      'warn',
    );
    return;
  }

  switch (command) {
    case 'new':
      snapshot();
      loadAutomaton(createAutomaton(), 'automato.jff');
      setStatus('Novo autômato finito.');
      break;
    case 'new-moore':
      snapshot();
      loadAutomaton(createAutomaton('moore'), 'moore.jff');
      setStatus('Nova máquina de Moore. Defina a saída de cada estado no painel de seleção.');
      break;
    case 'new-turing':
      snapshot();
      loadAutomaton(createAutomaton('turing'), 'turing.jff');
      setStatus('Nova máquina de Turing (convenção do curso: Δ na célula 0). Transições no formato a,A,D.');
      break;
    case 'example-turing':
      snapshot();
      loadAutomaton(exampleTuring(), 'exemplo-anbn.jff');
      setStatus('Exemplo do slide: MT para L = aⁿbⁿ. Experimente aabb, ab, aab.', 'ok');
      break;
    case 'tape-convention': {
      if (!isTuring(state.automaton)) {
        setStatus('A convenção da fita só se aplica a máquinas de Turing.', 'warn');
        break;
      }
      snapshot();
      const next = tapeConvention(state.automaton) === 'menezes' ? 'jflap' : 'menezes';
      state.automaton.tape = next;
      invalidateSimulation();
      setStatus(
        next === 'menezes'
          ? 'Fita Menezes: Δ na célula 0, cabeça começa sobre ele, branco ß.'
          : 'Fita JFLAP: infinita nos dois lados, cabeça no primeiro símbolo, branco □.',
        'ok',
      );
      refresh();
      break;
    }
    case 'open':
      el.fileInput.click();
      break;
    case 'merge':
      el.mergeInput.click();
      break;
    case 'save':
      saveFile();
      break;
    case 'export-svg':
      downloadSVG(el.canvas, state.automaton, imageName('svg'));
      setStatus(`Imagem salva como ${imageName('svg')}.`, 'ok');
      break;
    case 'export-png':
      downloadPNG(el.canvas, state.automaton, imageName('png'))
        .then(() => setStatus(`Imagem salva como ${imageName('png')}.`, 'ok'))
        .catch((error) => setStatus(`Falha ao gerar PNG: ${error.message}`, 'error'));
      break;
    case 'print':
      window.print();
      break;
    case 'example':
      snapshot();
      loadAutomaton(exampleAutomaton(), 'exemplo-termina-em-01.jff');
      setStatus('Exemplo: cadeias sobre {0,1} que terminam em "01".', 'ok');
      break;
    case 'fast-run':
      el.simInput.focus();
      if (el.simInput.value !== '') fastRun();
      break;
    case 'step-closure':
      startStepping(true);
      break;
    case 'step-state':
      startStepping(false);
      break;
    case 'multiple-run':
      openBatch();
      break;
    case 'hl-lambda':
      if (isTuring(state.automaton)) {
        setStatus('Máquina de Turing não tem transições λ: a leitura vazia é o branco da fita.', 'warn');
        break;
      }
      state.highlight.lambda = !state.highlight.lambda;
      setStatus(state.highlight.lambda ? 'Transições λ destacadas.' : 'Destaque removido.');
      refresh();
      break;
    case 'hl-nondet': {
      state.highlight.nondet = !state.highlight.nondet;
      const count = nondeterministicStates(state.automaton).size;
      setStatus(
        !state.highlight.nondet
          ? 'Destaque removido.'
          : count === 0
            ? 'Nenhum não-determinismo: o autômato é determinístico.'
            : `${count} estado(s) com não-determinismo.`,
        state.highlight.nondet && count > 0 ? 'warn' : 'info',
      );
      refresh();
      break;
    }
    case 'clear-hl':
      state.highlight = { lambda: false, nondet: false };
      state.simulation = null;
      setStatus('Destaques limpos.');
      refresh();
      break;
    case 'undo':
      undo();
      break;
    case 'redo':
      redo();
      break;
    case 'compare':
      el.compareInput.click();
      break;
    case 'to-dfa': {
      // o nome de cada estado novo é o conjunto de origem; quando não cabe no
      // círculo, o conjunto vai para o rótulo desenhado abaixo dele
      const { automaton } = subsetConstruction(state.automaton);
      if (automaton.states.length === 0) {
        setStatus('Sem estado inicial: não há o que converter.', 'warn');
        break;
      }
      snapshot();
      replaceAutomaton(automaton, 'dfa');
      setStatus(
        `DFA com ${automaton.states.length} estado(s). Cada estado é um conjunto de estados do original.`,
        'ok',
      );
      break;
    }
    case 'minimize':
      try {
        const { automaton, merged } = minimizeDFA(state.automaton);
        snapshot();
        replaceAutomaton(automaton, 'min');
        setStatus(
          merged === 0
            ? 'O autômato já era mínimo.'
            : `Mínimo com ${automaton.states.length} estado(s): ${merged} estado(s) a menos.`,
          'ok',
        );
      } catch (error) {
        setStatus(
          error instanceof ConversionError ? error.message : `Falha ao minimizar: ${error.message}`,
          'error',
        );
      }
      break;
    case 'to-regex': {
      const expressao = automatonToRegex(state.automaton);
      askText({
        label: 'Expressão regular equivalente',
        value: expressao,
        hint: 'Obtida por eliminação de estados. ∅ significa linguagem vazia.',
        readOnly: true,
      });
      setStatus(`Expressão regular com ${expressao.length} caractere(s).`, 'ok');
      break;
    }
    case 'to-grammar': {
      const { productions, start } = automatonToGrammar(state.automaton);
      if (!start) {
        setStatus('Sem estado inicial: não há variável inicial.', 'warn');
        break;
      }
      askText({
        label: 'Gramática regular equivalente',
        value: formatGrammar(productions),
        hint: 'Linear à direita. A variável inicial é S.',
        readOnly: true,
      });
      setStatus(`${productions.length} produção(ões).`, 'ok');
      break;
    }
    case 'from-regex':
      askText({
        label: 'Expressão regular',
        hint: 'Use + ou | para união, * para fecho, ( ) para agrupar e λ para a cadeia vazia.',
      }).then((input) => {
        if (input === null) return;
        try {
          const automaton = regexToAutomaton(input.trim());
          snapshot();
          replaceAutomaton(automaton, 'er');
          setStatus(
            `Autômato de Thompson com ${automaton.states.length} estado(s). Converta para DFA e minimize para enxugar.`,
            'ok',
          );
        } catch (error) {
          setStatus(
            error instanceof RegexError ? error.message : `Falha ao ler a expressão: ${error.message}`,
            'error',
          );
        }
      });
      break;
    case 'from-grammar':
      askText({
        label: 'Gramática regular (linear à direita)',
        value: 'S -> aS | bA\nA -> λ',
        hint: 'Uma variável por linha. Use | para alternativas e λ para a cadeia vazia.',
      }).then((input) => {
        if (input === null) return;
        try {
          const automaton = grammarTextToAutomaton(input);
          snapshot();
          replaceAutomaton(automaton, 'gram');
          setStatus(`Autômato com ${automaton.states.length} estado(s).`, 'ok');
        } catch (error) {
          setStatus(
            error instanceof GrammarError ? error.message : `Falha ao ler a gramática: ${error.message}`,
            'error',
          );
        }
      });
      break;
    case 'remove-unreachable': {
      snapshot();
      const removed = removeUnreachable(state.automaton);
      invalidateSimulation();
      setStatus(
        removed === 0 ? 'Todos os estados são alcançáveis.' : `${removed} estado(s) removido(s).`,
        removed === 0 ? 'info' : 'ok',
      );
      refresh();
      break;
    }
    case 'remove-useless': {
      snapshot();
      const removed = removeUseless(state.automaton);
      invalidateSimulation();
      setStatus(
        removed === 0
          ? 'De todo estado se alcança um estado final.'
          : `${removed} estado(s) removido(s).`,
        removed === 0 ? 'info' : 'ok',
      );
      refresh();
      break;
    }
    case 'trap': {
      snapshot();
      const { state: trap, added } = addTrapState(state.automaton);
      invalidateSimulation();
      setStatus(
        trap
          ? `Estado ${trap.name} adicionado, com ${added} transição(ões).`
          : 'A função de transição já era total: nada a fazer.',
        trap ? 'ok' : 'info',
      );
      refresh();
      break;
    }
    case 'fit':
      fitToContent();
      setStatus('Enquadrado.');
      break;
    case 'layout': {
      snapshot();
      const positions = springLayout(state.automaton, {
        width: DEFAULT_VIEWBOX.width,
        height: DEFAULT_VIEWBOX.height,
      });
      for (const s of state.automaton.states) {
        const position = positions.get(s.id);
        if (position) Object.assign(s, position);
      }
      fitToContent();
      setStatus('Estados reposicionados.');
      refresh();
      break;
    }
    default:
      setStatus(`Comando desconhecido: ${command}`, 'error');
  }
}

function imageName(extension) {
  return `${state.fileName.replace(/\.jff$/i, '')}.${extension}`;
}

/* ------------------------------------------------------------------ *
 * Arquivos
 * ------------------------------------------------------------------ */

function loadAutomaton(automaton, fileName, warnings = []) {
  state.automaton = automaton;
  state.selection = null;
  state.linkFrom = null;
  state.simulation = null;
  state.fileName = fileName;
  el.fileName.textContent = fileName;
  el.simInput.placeholder = isTuring(automaton) ? 'palavra na fita' : 'cadeia de entrada';
  fitToContent();
  refresh();
  if (warnings.length > 0) {
    setStatus(`Aberto com ${warnings.length} aviso(s): ${warnings.join(' ')}`, 'warn');
  } else {
    setStatus(`${fileName} aberto: ${automaton.states.length} estado(s).`, 'ok');
  }
}

/**
 * Troca o autômato pelo resultado de uma conversão. Os estados criados vêm sem
 * posição, então o layout automático é obrigatório aqui.
 * @param {string} suffix marca o nome do arquivo, ex.: "exemplo-dfa.jff"
 */
function replaceAutomaton(automaton, suffix) {
  const positions = springLayout(automaton, {
    width: DEFAULT_VIEWBOX.width,
    height: DEFAULT_VIEWBOX.height,
  });
  for (const s of automaton.states) {
    const position = positions.get(s.id);
    if (position) Object.assign(s, position);
  }
  state.automaton = automaton;
  state.selection = null;
  state.linkFrom = null;
  state.simulation = null;
  const base = state.fileName.replace(/\.jff$/i, '').replace(/-(dfa|min|er|gram)$/i, '');
  state.fileName = `${base}-${suffix}.jff`;
  el.fileName.textContent = state.fileName;
  fitToContent();
  refresh();
}

el.compareInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const { automaton } = parseJFF(await file.text());
    const { equivalent, counterexample } = areEquivalent(state.automaton, automaton);
    if (equivalent) {
      setStatus(`Equivalentes: este autômato e ${file.name} reconhecem a mesma linguagem.`, 'ok');
    } else {
      // deixa o contraexemplo pronto para rodar no painel de simulação
      el.simInput.value = counterexample;
      setStatus(
        `Não equivalentes. Contraexemplo: "${counterexample || 'λ (cadeia vazia)'}" — já preenchido no campo de simulação.`,
        'warn',
      );
    }
  } catch (error) {
    setStatus(error instanceof JFFError ? error.message : `Falha ao ler: ${error.message}`, 'error');
  } finally {
    event.target.value = '';
  }
});

el.fileInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const { automaton, warnings } = parseJFF(await file.text());
    snapshot();
    loadAutomaton(automaton, file.name, warnings);
  } catch (error) {
    setStatus(error instanceof JFFError ? error.message : `Falha ao ler: ${error.message}`, 'error');
  } finally {
    // permite reabrir o mesmo arquivo
    event.target.value = '';
  }
});

el.mergeInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const { automaton } = parseJFF(await file.text());
    if (automaton.type !== state.automaton.type) {
      setStatus(
        `Não dá para mesclar: o arquivo é ${typeName(automaton)} e o documento atual é ${typeName(state.automaton)}.`,
        'error',
      );
      return;
    }
    snapshot();
    const result = mergeAutomaton(state.automaton, automaton);
    invalidateSimulation();
    fitToContent();
    refresh();
    setStatus(
      `${file.name}: ${result.states} estado(s) e ${result.transitions} transição(ões) incorporados.` +
        (result.initialDropped ? ' O estado inicial importado deixou de ser inicial.' : ''),
      'ok',
    );
  } catch (error) {
    setStatus(error instanceof JFFError ? error.message : `Falha ao ler: ${error.message}`, 'error');
  } finally {
    event.target.value = '';
  }
});

function saveFile() {
  const xml = serializeJFF(state.automaton);
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = state.fileName.endsWith('.jff') ? state.fileName : `${state.fileName}.jff`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus(`Salvo como ${link.download}.`, 'ok');
}

/* ------------------------------------------------------------------ *
 * Ferramentas
 * ------------------------------------------------------------------ */

function setMode(mode) {
  state.mode = mode;
  state.linkFrom = null;
  for (const button of document.querySelectorAll('[data-mode]')) {
    button.classList.toggle('active', button.dataset.mode === mode);
  }
  const hints = {
    select: 'Arraste para mover · duplo clique renomeia · Delete remove.',
    state: 'Clique na área em branco para criar um estado.',
    transition: 'Clique na origem e depois no destino.',
    erase: 'Clique em um estado ou transição para remover.',
  };
  setStatus(hints[mode]);
  refresh();
}

for (const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click', () => setMode(button.dataset.mode));
}

/* ------------------------------------------------------------------ *
 * Início
 * ------------------------------------------------------------------ */

applyViewBox();
setMode('select');
loadAutomaton(exampleAutomaton(), 'exemplo-termina-em-01.jff');
setStatus('Pronto. Abra um .jff ou edite o exemplo.', 'ok');

/**
 * ?open=<url> carrega um .jff logo na abertura. Serve para compartilhar um
 * exercício por link, sem precisar mandar o arquivo junto.
 */
const params = new URLSearchParams(location.search);
const openParam = params.get('open');

// ?theme=light|dark força o tema — projetor e impressão pedem o claro
const themeParam = params.get('theme');
if (themeParam === 'light' || themeParam === 'dark') {
  document.documentElement.dataset.theme = themeParam;
}

/**
 * ?input=<cadeia> preenche o campo de simulação; ?run=fast executa,
 * ?run=step abre o passo a passo e ?step=N avança até o passo N. Junto com
 * ?open=, permite compartilhar por link não só a máquina, mas a execução.
 */
function applyRunParams() {
  const input = params.get('input');
  if (input === null) return;
  el.simInput.value = input;
  const run = params.get('run');
  if (run === 'fast') fastRun();
  if (run === 'step') {
    startStepping(true);
    const step = Number.parseInt(params.get('step') ?? '0', 10);
    if (Number.isInteger(step) && step > 0) stepTo(step);
  }
}

if (openParam) {
  fetch(openParam)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then((text) => {
      const { automaton, warnings } = parseJFF(text);
      loadAutomaton(automaton, openParam.split('/').pop(), warnings);
      applyRunParams();
    })
    .catch((error) => setStatus(`Não foi possível abrir ${openParam}: ${error.message}`, 'error'));
} else {
  applyRunParams();
}
