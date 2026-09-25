---
title: Como foi construído
subtitle: Arquitetura, decisões, testes — e o papel da IA no desenvolvimento
is-arq: true
prev: O formato .jff
prev-href: formato-jff.html
next: Informações
next-href: sobre.html
---

## Sem instalação, nem para desenvolver

A primeira decisão foi não ter etapa de compilação. O código é JavaScript com
módulos ES nativos, que o navegador carrega direto; a interface é HTML e CSS
sem framework; o diagrama é SVG gerado por código. Não há Node, npm,
empacotador nem dependência externa. Um servidor de arquivos estáticos — o do
Python que vem no macOS basta — é tudo que o desenvolvimento exige, e o
GitHub Pages publica os arquivos exatamente como estão no repositório.

Isso foi uma restrição do ambiente que virou princípio: uma ferramenta feita
para dispensar instalação não deveria exigir instalação para ser modificada.
Quem quiser mexer clona o repositório e abre.

## Camadas

Os 4.500 linhas de código dividem-se em quatro camadas, e a dependência só
aponta para baixo:

| Camada | Módulos | Responsabilidade |
|---|---|---|
| **core** | `model`, `simulate`, `turing`, `convert`, `regex`, `grammar`, `operations`, `examples` | o modelo de dados e todos os algoritmos; **não toca no DOM** |
| **io** | `jff`, `image` | leitura e gravação do `.jff`; exportação de imagem |
| **render** | `geometry`, `canvas`, `layout` | cálculo das curvas, desenho em SVG, reposicionamento |
| **ui** | `app` | menus, eventos, painéis, desfazer |

A camada `core` não sabe que existe uma tela. Por isso os algoritmos —
subconjuntos, minimização, Thompson, eliminação de estados, a simulação da MT —
são testáveis sem interface e reaproveitáveis por outro programa.

## Decisões que valem registrar

**Seguir as aulas, não o JFLAP.** Onde a definição do curso difere da do
JFLAP, a ferramenta segue o curso e mantém a do JFLAP como alternativa. O caso
mais visível é a fita da máquina de Turing, com o `Δ` de Menezes.

**Reimplementar em vez de derivar.** A licença do JFLAP permite modificações,
mas impõe condições — não cobrar, entregar o código à mantenedora quando
pedido. Uma reimplementação independente pôde ser publicada sob MIT, sem
amarras, e a Univali pode adotá-la, modificá-la e redistribuí-la sem pedir a
ninguém. O que se reaproveitou do JFLAP foi só o formato de arquivo.

**Conversões de resultado direto.** O JFLAP faz o aluno construir o DFA passo a
passo e corrige; o AutomataLab calcula e mostra. É a maior diferença
pedagógica entre os dois e está registrada como trabalho futuro — os
algoritmos que corrigiriam o aluno já existem, falta a interface guiada.

**Desfazer cobre tudo.** As conversões substituem o autômato inteiro. Sem um
histórico de edição, um clique errado perderia o trabalho; por isso o desfazer
guarda até 60 estados, incluindo o nome do arquivo.

**O evento `close` do diálogo não é confiável.** Descobriu-se que há
navegadores embutidos que não o disparam, o que travava a interface. Os
diálogos passaram a ser resolvidos pelos próprios botões, com o evento apenas
como rede de segurança. É o tipo de detalhe que só aparece testando de verdade.

## Testes

Há **219 testes automatizados**, que rodam no próprio navegador em
[`tests.html`](../tests.html) — sem ferramenta externa, com um runner de 60
linhas. Cobrem o modelo, o formato `.jff` (com fixtures dos três dialetos), a
simulação de autômatos finitos, as conversões, expressões regulares,
gramáticas, Moore e Turing.

Os testes mais fortes são os de **equivalência**: em vez de conferir uma
cadeia, provam que dois autômatos reconhecem a mesma linguagem. É assim que se
verifica que a minimização preserva a linguagem, que ER → autômato → ER volta
ao mesmo lugar, e que o `.jff` gravado e relido se comporta igual ao original.

Para a máquina de Turing, a fixture é a máquina do slide 10, e um dos testes
afirma que `aabb` aceita em exatamente 14 passos com a fita `[Δ] a a b b` no
passo zero — a mesma sequência dos slides.

## O papel da IA

O código, os testes e boa parte do desenho dos algoritmos foram escritos com
uso intensivo de um assistente de IA, sob direção e revisão humanas. O
histórico do repositório registra a coautoria em cada *commit*.

O que foi decisão humana: o problema a resolver, o escopo e a ordem das fases,
a exigência de seguir a convenção das aulas, a validação com os arquivos reais
da disciplina, a escolha de publicar em aberto sob MIT, e a decisão de
reimplementar em vez de derivar do JFLAP. O que foi execução assistida: a
tradução dessas decisões em código e em testes.

Registra-se isso aqui porque é uma forma de autoria diferente da tradicional,
e é melhor que seja conhecida do que descoberta. A ferramenta é avaliável
pelo que faz — os testes, os arquivos das aulas que abre, o exemplo do slide
que reproduz — e não pela forma como foi digitada.

## Trabalho futuro

Em ordem de valor para a disciplina:

1. **Máquinas de Mealy** — pequena: é Moore com a saída na transição.
2. **Modo interativo das conversões** — o aluno constrói, a ferramenta
   corrige. Os algoritmos existem; falta a interface.
3. **Autômatos com pilha.**
4. **Máquinas de Turing com várias fitas.**
5. **Gramática como tipo de documento próprio**, com CYK, LL(1) e LR(1).

O código está em <https://github.com/andersonpiresme/automatalab>, sob MIT.
