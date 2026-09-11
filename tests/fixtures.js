/** Arquivos .jff de referência, no formato exato que o JFLAP 7 grava. */

/** DFA sobre {0,1} que aceita cadeias terminadas em "01". */
export const DFA_TERMINA_01 = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!--Created with JFLAP 7.0.-->
<structure>
	<type>fa</type>
	<automaton>
		<!--The list of states.-->
		<state id="0" name="q0">
			<x>110.0</x>
			<y>150.0</y>
			<initial/>
		</state>
		<state id="1" name="q1">
			<x>310.0</x>
			<y>150.0</y>
		</state>
		<state id="2" name="q2">
			<x>510.0</x>
			<y>150.0</y>
			<final/>
		</state>
		<!--The list of transitions.-->
		<transition>
			<from>0</from>
			<to>0</to>
			<read>1</read>
		</transition>
		<transition>
			<from>0</from>
			<to>1</to>
			<read>0</read>
		</transition>
		<transition>
			<from>1</from>
			<to>1</to>
			<read>0</read>
		</transition>
		<transition>
			<from>1</from>
			<to>2</to>
			<read>1</read>
		</transition>
		<transition>
			<from>2</from>
			<to>0</to>
			<read>1</read>
		</transition>
		<transition>
			<from>2</from>
			<to>1</to>
			<read>0</read>
		</transition>
	</automaton>
</structure>`;

/** NFA com transição lambda (<read/> vazio) e um <label> de estado. */
export const NFA_COM_LAMBDA = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!--Created with JFLAP 7.0.-->
<structure>
	<type>fa</type>
	<automaton>
		<state id="0" name="q0">
			<x>100.0</x>
			<y>100.0</y>
			<label>início</label>
			<initial/>
		</state>
		<state id="1" name="q1">
			<x>250.5</x>
			<y>100.0</y>
			<final/>
		</state>
		<transition>
			<from>0</from>
			<to>1</to>
			<read/>
		</transition>
		<transition>
			<from>0</from>
			<to>0</to>
			<read>a</read>
		</transition>
	</automaton>
</structure>`;

/**
 * Formato do JFLAP 4: sem o invólucro <automaton>, sem atributo name nos
 * estados e com <read></read> (em vez de <read/>) para lambda.
 */
export const JFLAP4_SEM_AUTOMATON = `<?xml version="1.0"?>
<!-- Created with JFLAP 4.0b12. -->
<structure>
	<type>fa</type>
	<!--The list of states.-->
	<state id="3">
		<x>275.0</x>
		<y>92.0</y>
		<final />
	</state>
	<state id="0">
		<x>62.0</x>
		<y>114.0</y>
		<initial />
	</state>
	<!--The list of transitions.-->
	<transition>
		<from>0</from>
		<to>3</to>
		<read></read>
	</transition>
</structure>`;

/** Arquivo com referências quebradas e dois estados iniciais. */
export const FA_INCONSISTENTE = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<structure>
	<type>fa</type>
	<automaton>
		<state id="0" name="q0"><x>0.0</x><y>0.0</y><initial/></state>
		<state id="1" name="q1"><x>50.0</x><y>0.0</y><initial/><final/></state>
		<transition><from>0</from><to>1</to><read>a</read></transition>
		<transition><from>0</from><to>9</to><read>b</read></transition>
	</automaton>
</structure>`;

/** Gramática: tipo válido de .jff, mas fora do escopo desta versão. */
export const GRAMATICA = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<structure>
	<type>grammar</type>
	<production><left>S</left><right>aSb</right></production>
</structure>`;
