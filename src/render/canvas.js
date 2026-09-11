/**
 * Renderização do autômato em SVG.
 *
 * A cada mudança o desenho é refeito por inteiro. Para o tamanho de autômato
 * que aparece em sala de aula (dezenas de estados) isso é instantâneo e evita
 * toda a complexidade de reconciliação incremental.
 */

import { groupTransitions, transitionLabel } from '../core/model.js';
import {
  STATE_RADIUS,
  FINAL_RING_GAP,
  edgeGeometry,
  initialMarkerGeometry,
  obstacleOnEdge,
  selfLoopGeometry,
  sideOf,
} from './geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}, text = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value != null) node.setAttribute(key, String(value));
  }
  if (text != null) node.textContent = text;
  return node;
}

/** Marcadores de seta. Definidos uma vez, referenciados por marker-end. */
function defs() {
  const node = svg('defs');
  for (const [id, className] of [['arrow', 'arrow-head'], ['arrow-sel', 'arrow-head selected']]) {
    const marker = svg('marker', {
      id,
      viewBox: '0 0 10 10',
      refX: 9,
      refY: 5,
      markerWidth: 7,
      markerHeight: 7,
      orient: 'auto',
    });
    marker.appendChild(svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: className }));
    node.appendChild(marker);
  }
  return node;
}

/**
 * @param {SVGSVGElement} root
 * @param {import('../core/model.js').Automaton} automaton
 * @param {{selection: {kind:string,id:any}|null, linkFrom: number|null, pointer: {x:number,y:number}|null}} view
 */
export function render(root, automaton, view) {
  root.replaceChildren();
  root.appendChild(defs());

  const edgeLayer = svg('g', { class: 'layer-edges' });
  const nodeLayer = svg('g', { class: 'layer-nodes' });
  root.appendChild(edgeLayer);
  root.appendChild(nodeLayer);

  const byId = new Map(automaton.states.map((s) => [s.id, s]));
  const groups = groupTransitions(automaton);
  const pairs = new Set(groups.map((g) => `${g.from}->${g.to}`));

  for (const group of groups) {
    const from = byId.get(group.from);
    const to = byId.get(group.to);
    if (!from || !to) continue;

    const selfLoop = group.from === group.to;
    // se existe a aresta oposta, curva as duas para não se sobreporem
    const curved = !selfLoop && pairs.has(`${group.to}->${group.from}`);
    // se a reta atravessaria outro estado, contorna pelo lado oposto a ele
    let options = {};
    if (!selfLoop) {
      const obstacle = obstacleOnEdge(from, to, automaton.states);
      if (obstacle) options = { detour: true, side: -sideOf(obstacle, from, to) };
    }
    const geometry = selfLoop ? selfLoopGeometry(from) : edgeGeometry(from, to, curved, options);

    const selected =
      view.selection?.kind === 'transition' &&
      group.transitions.some((t) => t.id === view.selection.id);
    const hasLambda = group.transitions.some((t) => t.read === '');

    const classes = ['edge'];
    if (selected) classes.push('selected');
    if (view.showLambda && hasLambda) classes.push('lambda');
    const edge = svg('g', { class: classes.join(' ') });
    // traço largo e invisível: alvo de clique confortável sobre a curva
    edge.appendChild(svg('path', { d: geometry.path, class: 'edge-hit' }));
    edge.appendChild(
      svg('path', {
        d: geometry.path,
        class: 'edge-line',
        'marker-end': `url(#${selected ? 'arrow-sel' : 'arrow'})`,
      }),
    );

    // AF: "a, b"; MT: uma tripla por linha, como no slide do curso
    const labels = group.transitions.map((t) => transitionLabel(automaton, t));
    const turing = automaton.type === 'turing';
    const label = svg('text', {
      x: geometry.label.x,
      y: geometry.label.y,
      class: 'edge-label',
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
    }, turing ? null : labels.join(', '));
    if (turing) {
      // centraliza o bloco de linhas verticalmente no ponto do rótulo
      const lineHeight = 14;
      const offset = -((labels.length - 1) * lineHeight) / 2;
      labels.forEach((text, i) => {
        label.appendChild(
          svg('tspan', { x: geometry.label.x, dy: i === 0 ? offset : lineHeight }, text),
        );
      });
    }
    edge.appendChild(label);

    edge.dataset.transitionId = group.transitions[0].id;
    edge.dataset.from = String(group.from);
    edge.dataset.to = String(group.to);
    edgeLayer.appendChild(edge);
  }

  // aresta fantasma enquanto o usuário escolhe o destino
  if (view.linkFrom != null && view.pointer) {
    const from = byId.get(view.linkFrom);
    if (from) {
      edgeLayer.appendChild(
        svg('line', {
          x1: from.x,
          y1: from.y,
          x2: view.pointer.x,
          y2: view.pointer.y,
          class: 'edge-ghost',
        }),
      );
    }
  }

  for (const state of automaton.states) {
    const selected = view.selection?.kind === 'state' && view.selection.id === state.id;
    const pending = view.linkFrom === state.id;
    const classes = ['node'];
    if (selected) classes.push('selected');
    if (pending) classes.push('pending');
    if (view.active?.has(state.id)) classes.push('active');
    if (view.nondet?.has(state.id)) classes.push('nondet');

    const group = svg('g', { class: classes.join(' '), transform: `translate(${state.x} ${state.y})` });

    if (state.initial) {
      const marker = svg('path', {
        d: initialMarkerGeometry({ x: 0, y: 0 }),
        class: 'initial-marker',
        'marker-end': 'url(#arrow)',
      });
      group.appendChild(marker);
    }

    group.appendChild(svg('circle', { r: STATE_RADIUS, class: 'node-circle' }));
    if (state.final) {
      group.appendChild(
        svg('circle', { r: STATE_RADIUS - FINAL_RING_GAP, class: 'node-circle inner' }),
      );
    }
    const label = svg('text', {
      class: 'node-label',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    }, state.name);
    // nomes de conjunto ("q0q1") não cabem no círculo: encolhe a fonte em vez
    // de aumentar o raio, que bagunçaria a geometria das arestas.
    // O tamanho vem por style porque o atalho `font` do CSS venceria o atributo.
    if (state.name.length > 3) {
      label.style.fontSize = `${Math.max(9, 14 - (state.name.length - 3) * 1.5)}px`;
    }
    group.appendChild(label);

    // a saída da máquina de Moore fica logo abaixo do círculo, e o rótulo
    // livre desce mais uma linha para não colidir com ela
    let below = STATE_RADIUS + 16;
    if (state.output) {
      group.appendChild(
        svg('text', {
          class: 'node-output',
          y: below,
          'text-anchor': 'middle',
        }, `/${state.output}`),
      );
      below += 14;
    }
    if (state.label) {
      group.appendChild(
        svg('text', {
          class: 'node-note',
          y: below,
          'text-anchor': 'middle',
        }, state.label),
      );
    }

    group.dataset.stateId = String(state.id);
    nodeLayer.appendChild(group);
  }
}
