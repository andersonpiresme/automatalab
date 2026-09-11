/**
 * Exportação do diagrama como imagem.
 *
 * O SVG da página é estilizado pela folha de estilos externa, que não
 * acompanha o arquivo exportado. Por isso a cópia exportada leva um <style>
 * embutido, sempre na paleta clara: imagem de autômato costuma acabar em
 * relatório impresso ou colada em documento de fundo branco.
 */

import { boundingBox } from '../render/geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const EXPORT_STYLE = `
.node-circle { fill: #ffffff; stroke: #111111; stroke-width: 2; }
.node-circle.inner { fill: none; }
.node-label { fill: #111111; font: 600 14px system-ui, sans-serif; }
.node-note { fill: #555555; font: 11px system-ui, sans-serif; }
.initial-marker { fill: none; stroke: #111111; stroke-width: 2; }
.edge-line { fill: none; stroke: #333333; stroke-width: 2; }
.edge-hit { display: none; }
.edge-ghost { display: none; }
.edge-label { fill: #111111; font: 13px ui-monospace, Menlo, monospace;
              paint-order: stroke; stroke: #ffffff; stroke-width: 4px;
              stroke-linejoin: round; }
.arrow-head { fill: #333333; }
`;

/**
 * Cópia autossuficiente do diagrama, recortada no conteúdo.
 * @param {SVGSVGElement} source
 * @param {import('../core/model.js').Automaton} automaton
 * @returns {{markup: string, width: number, height: number}}
 */
export function toStandaloneSVG(source, automaton) {
  const box = boundingBox(automaton.states, 60) || { x: 0, y: 0, width: 400, height: 240 };
  const clone = source.cloneNode(true);

  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
  clone.setAttribute('width', String(Math.round(box.width)));
  clone.setAttribute('height', String(Math.round(box.height)));

  // destaques de simulação não pertencem à imagem exportada
  for (const node of clone.querySelectorAll('.selected, .pending, .active, .visited')) {
    node.classList.remove('selected', 'pending', 'active', 'visited');
  }

  const style = document.createElementNS(SVG_NS, 'style');
  style.textContent = EXPORT_STYLE;
  clone.insertBefore(style, clone.firstChild);

  // fundo branco explícito: PNG sem fundo fica ilegível em tema escuro
  const background = document.createElementNS(SVG_NS, 'rect');
  background.setAttribute('x', String(box.x));
  background.setAttribute('y', String(box.y));
  background.setAttribute('width', String(box.width));
  background.setAttribute('height', String(box.height));
  background.setAttribute('fill', '#ffffff');
  clone.insertBefore(background, style.nextSibling);

  return {
    markup: new XMLSerializer().serializeToString(clone),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadSVG(source, automaton, filename) {
  const { markup } = toStandaloneSVG(source, automaton);
  download(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

/**
 * @param {number} scale 2 gera imagem nítida em tela retina e na impressão
 * @returns {Promise<void>}
 */
export function downloadPNG(source, automaton, filename, scale = 2) {
  const { markup, width, height } = toStandaloneSVG(source, automaton);
  const svgBlob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('o navegador não conseguiu gerar o PNG'));
          return;
        }
        download(blob, filename);
        resolve();
      }, 'image/png');
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('falha ao rasterizar o SVG'));
    };
    image.src = url;
  });
}
