---
title: O formato .jff
subtitle: Como o AutomataLab conversa com o JFLAP
is-jff: true
prev: Máquinas de Turing
prev-href: turing.html
next: Como foi construído
next-href: arquitetura.html
---

## O que é

`.jff` é o formato de arquivo do JFLAP: XML puro, legível em qualquer editor de
texto. Um autômato finito é assim:

```xml
<structure>
  <type>fa</type>
  <automaton>
    <state id="0" name="q0">
      <x>110.0</x>
      <y>150.0</y>
      <initial/>
    </state>
    <state id="1" name="q1">
      <x>310.0</x>
      <y>150.0</y>
      <final/>
    </state>
    <transition>
      <from>0</from>
      <to>1</to>
      <read>a</read>
    </transition>
  </automaton>
</structure>
```

Não é um formato padronizado — não há especificação publicada nem órgão que a
mantenha — mas também não é protegido: formato de arquivo é especificação
funcional, e implementar um leitor é interoperabilidade legítima. O AutomataLab
reconstruiu o formato a partir de arquivos reais.

## Dialetos

O JFLAP mudou o formato entre versões, sem documentar. Os três dialetos que
apareceram nos arquivos das aulas são aceitos na leitura:

| Versão | Diferença |
|---|---|
| JFLAP 4.0 | `<state>` e `<transition>` ficam direto sob `<structure>`, sem `<automaton>`; estados sem atributo `name`; λ como `<read></read>` |
| JFLAP 6.4 | tem `<automaton>`; máquinas de Moore com `<output>` no estado e `<transout>` na transição |
| JFLAP 7.0 | tem `<automaton>`; MT com `<write>` e `<move>`; `~` em `<write>` significa "grava o que leu"; `<tapes>` para várias fitas; `<block>` para *building blocks* |

Na gravação, o AutomataLab escreve sempre o dialeto do JFLAP 7, que as versões
mais novas abrem.

## O que é lido

| `<type>` | Suporte |
|---|---|
| `fa` | completo |
| `moore` | completo |
| `turing` | uma fita; a convenção (Menezes ou JFLAP) é inferida pela presença de `Δ` |
| `mealy` | recusado com mensagem |
| `pda`, `grammar`, `re`, `lsystem`, `pumping-lemma` | recusados com mensagem que diz o que o arquivo contém |

Tolerâncias na leitura, todas com aviso na linha de status:

- estado sem `name` recebe `q<id>`;
- mais de um estado marcado como inicial: só o primeiro é mantido;
- transição que aponta para estado inexistente é descartada;
- `<block>` é ignorado;
- MT com movimento fora de L/R/S usa R.

## Ida e volta

Abrir um arquivo e salvá-lo de novo preserva estados, nomes, coordenadas,
marcações e transições — testado com os 13 arquivos das aulas. O que **não** é
preservado:

- comentários e formatação do XML original;
- o `<transout>` de Moore, que é reconstruído a partir do estado de destino;
- *building blocks*.

## Compartilhar por link

A URL da ferramenta aceita `?open=<endereço-do-arquivo>`. Um `.jff` publicado
em qualquer lugar acessível ao navegador abre direto:

```
https://andersonpiresme.github.io/automatalab/?open=https://exemplo.edu/aula9/anbn.jff
```

O servidor que hospeda o arquivo precisa permitir a leitura entre origens
(CORS); o GitHub Pages permite.

Três parâmetros a mais deixam o link abrir já com uma execução:

| Parâmetro | Efeito |
|---|---|
| `input=aabb` | preenche o campo de simulação |
| `run=fast` | executa a cadeia |
| `run=step&step=6` | abre o passo a passo e avança até o passo 6 |
| `theme=light` ou `dark` | força o tema — útil em projetor |

Assim um professor pode mandar, num único link, a máquina, a entrada e o
passo exato a observar.
