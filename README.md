# AutomataLab

Editor e simulador web de autômatos finitos, com leitura e gravação do formato
`.jff`. Roda inteiro no navegador — sem servidor, sem instalação, sem Java.

**Acesse:** <https://andersonpiresme.github.io/automatalab/>
**Documentação:** <https://andersonpiresme.github.io/automatalab/docs/>

## Contexto

Nasceu como iniciativa na disciplina de Teoria da Computação do mestrado em
Computação Aplicada da Univali, para substituir o JFLAP em sala de aula sem
depender de Java instalado — no espírito do
[Web-GALS](https://lia-univali.github.io/Web-GALS/), que fez o mesmo com o GALS.
Está aberto a contribuições e a adoção pela universidade.

> **Fases 1 a 4** do roadmap: editor, interoperabilidade de arquivos,
> simulação de cadeias e todas as conversões de autômatos finitos. As
> conversões são de resultado direto; o modo interativo do JFLAP (o aluno
> constrói, a ferramenta corrige) ainda não existe.
>
> O escopo é **autômato finito**, **máquina de Moore** e **máquina de Turing de
> uma fita**. Das 11 estruturas do JFLAP, gramática e expressão regular aparecem
> só como formato de entrada e saída — não há editor próprio para elas — e PDA,
> Turing multi-fita, Mealy, L-System e os jogos do lema do bombeamento não
> existem.

## O que já funciona

**Editor**

- Criar, mover, renomear e remover estados; marcar inicial e final
- Transições, inclusive laços, pares em sentidos opostos e transições λ
- Múltiplos símbolos entre o mesmo par de estados desenhados como uma aresta só (`a, b`)
- Tabela de transições sincronizada com o diagrama
- Reposicionamento automático (força dirigida, determinístico)

**Simulação**

- Execução rápida: aceita/rejeita com o caminho percorrido
- Passo a passo **com fecho-λ** e **por estado**, com as configurações ativas
  destacadas no diagrama e a fita mostrando o que já foi lido
- Várias entradas de uma vez, com a tabela de vereditos
- Destaque de transições λ e de estados com não-determinismo

**Máquinas de Moore**

- Abrir, editar e salvar `.jff` do tipo `moore`, com a saída de cada estado
- Execução mostrando a fita de saída — a do estado inicial e uma por transição
- Passo a passo e execução em lote, com a saída acumulada
- Avisa quando a execução trava por falta de transição ou quando há ambiguidade

**Conversões e testes**

- NFA→DFA por construção de subconjuntos; cada estado do DFA é nomeado pelo
  conjunto de origem (`q0q1`)
- Minimização por refinamento de partições (Moore)
- Remoção de estados inalcançáveis e de estados inúteis
- Comparação de equivalência com outro `.jff`, com **contraexemplo** quando as
  linguagens diferem
- AF → expressão regular por eliminação de estados, e ER → AF por Thompson
  (sintaxe `+ | * ( ) λ`, a mesma do JFLAP)
- AF ↔ gramática regular linear à direita, em texto (`S -> aA | b | λ`)
- Desfazer/refazer (Ctrl+Z / Ctrl+Shift+Z)

**Máquinas de Turing**

- Definição do Menezes, a usada na disciplina: fita com marcador `Δ` na
  célula 0, branco `ß`, cabeça começa sobre o `Δ`, movimentos `E`/`D`
- As três condições de parada: estado final aceita; função indefinida rejeita;
  mover à esquerda do `Δ` rejeita
- Transições no formato do curso, `(lido, gravado, movimento)`, e a tabela Π
  com as colunas na mesma ordem do slide
- Passo a passo com a fita desenhada e a cabeça destacada; execução em lote
  com contagem de passos; loop detectado por teto de passos
- Não-determinismo simulado em paralelo, como nos autômatos finitos
- Convenção do JFLAP (fita infinita nos dois lados, sem `Δ`) também
  disponível, inferida ao abrir um `.jff` e alternável em **Exibir**
- Exemplo embutido: a MT para aⁿbⁿ da aula, com o mesmo desenho do slide

**Arquivos**

- Abrir, mesclar e salvar `.jff` — dialetos do **JFLAP 4**, **6.4** e **7**
- Exportar o diagrama em SVG ou PNG; imprimir
- `?open=<url>` carrega um arquivo direto pela URL, para compartilhar exercício por link
- Avisos não bloqueantes: sem estado inicial, sem estado final, transição órfã,
  símbolo fora do alfabeto

## Rodar localmente

O projeto usa ES modules nativos, que o navegador recusa carregar via `file://`.
Qualquer servidor estático resolve:

```bash
python3 tools/serve.py
```

Depois abra <http://127.0.0.1:5173/>.

## Testes

Os testes rodam no próprio navegador, sem Node e sem dependências:

```bash
python3 tools/serve.py
```

Abra <http://127.0.0.1:5173/tests.html>. O título da aba mostra ✓ ou ✗.

## Estrutura

```
src/core/model.js       modelo do autômato (sem DOM, testável isoladamente)
src/core/simulate.js    fecho-λ, passo, execução e diagnósticos
src/core/turing.js      máquina de Turing: fita, passo, condições de parada
src/core/convert.js     subconjuntos, minimização, podas e equivalência
src/core/regex.js       análise de ER, Thompson e eliminação de estados
src/core/grammar.js     gramática regular nos dois sentidos
src/core/operations.js  estado de erro (trap) e união de autômatos
src/io/jff.js           leitura e escrita do formato .jff
src/io/image.js         exportação SVG/PNG autossuficiente
src/render/geometry.js  cálculo das curvas das arestas
src/render/layout.js    reposicionamento por força dirigida
src/render/canvas.js    desenho em SVG
src/ui/app.js           menus, eventos, painéis
tests/                  runner mínimo + suíte
```

`core` e `io` não dependem do DOM (exceto `DOMParser`), o que mantém os
algoritmos das próximas fases testáveis sem interface.

## Roadmap

| Fase | Escopo |
|---|---|
| 1 ✅ | Editor de AFs, tabela de transições, import/export `.jff` |
| 2 ✅ | Simulação: aceita/rejeita, passo a passo, fecho-λ, lote de entradas |
| 3 ✅ | NFA→DFA, minimização, estados inúteis/inalcançáveis, equivalência |
| 4 ✅ | ER ↔ AF, AF ↔ gramática regular |
| 5 | Modo interativo das conversões (o aluno constrói, a ferramenta corrige) |
| — | Outras estruturas: PDA, Turing, Mealy/Moore, gramática como tipo próprio |

## Sobre o formato .jff

`.jff` é o XML usado pelo [JFLAP](https://www.jflap.org). Este projeto lê e
grava esse formato para conviver com material didático já existente, mas é uma
implementação independente, escrita do zero: **não** contém, deriva de, nem é
afiliado ao código do JFLAP, à Duke University ou aos seus autores.

Diferenças de formato tratadas na leitura:

- JFLAP 6.4 e 7 envolvem o autômato em `<automaton>`; o JFLAP 4 não
- `<read/>`, `<read></read>` e a ausência de `<read>` representam λ
- estados sem atributo `name` recebem `q<id>`
- em máquinas de Moore, o `<transout>` das transições é redundante (repete a
  saída do estado de destino) e por isso é reconstruído na gravação, não lido

## Licença

MIT — veja [LICENSE](LICENSE).
