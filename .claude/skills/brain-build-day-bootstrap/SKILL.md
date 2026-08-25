---
id: brain.build-day.bootstrap
version: 1.2.0
status: draft-ready-for-use
mode: one-time-bootstrap
language: es
outputs_language: en
purpose: Preparar y verificar, paso a paso, el entorno Brain necesario para resolver retos reales de hackathon con IA sin hardcoding, con contexto controlado, agentes configurables, skills reutilizables, evidencia, QA y continuidad entre sesiones.
---

# Brain Build-Day Bootstrap Skill

## 0. Propósito

Esta skill se ejecuta **una sola vez** para preparar el entorno de trabajo de Brain antes del Build Day. No resuelve el reto del hackathon. Su trabajo es dejar listo un sistema capaz de recibir un requerimiento ambiguo de un cliente y convertirlo, con rigor, en una solución construible y verificable.

Resultado esperado al terminar:

```text
RAW CLIENT REQUEST
        ↓
DISCOVERY / REQUIREMENTS
        ↓
KNOWLEDGE GAP ANALYSIS
        ↓
QUALITY CONTRACT
        ↓
RESEARCH WITH EVIDENCE
        ↓
SPEC
        ↓
SYSTEM ARCHITECTURE
        ↓
AGENT DESIGN (si aplica)
        ↓
PLAN
        ↓
TASK / PROMPT COMPILATION
        ↓
BUILD
        ↓
DETERMINISTIC QA
        ↓
INDEPENDENT VERIFICATION
        ↓
DELIVERY
        ↓
HANDOFF / MEMORY / KNOWLEDGE
```

La skill prepara el entorno para que ese flujo pueda ejecutarse con distintos modelos y herramientas sin quedar acoplado a uno de ellos.

---

# 1. Principios no negociables

1. **Un step activo a la vez.** No adelantar trabajo de steps posteriores.
2. **No PASS sin evidencia.** Un claim del agente no cuenta como verificación.
3. **Configuration over hardcoding.** Agentes, modelos, skills, tools y proveedores se resuelven mediante contratos/configuración.
4. **Minimal core, extensible intelligence.** El Core no contiene conocimiento de dominio ni integraciones específicas.
5. **Context is retrieved, not stuffed.** Nunca cargar conversaciones, wiki, repo o skills completas si no son necesarias.
6. **Research is question-driven.** Investigar knowledge gaps que puedan cambiar una decisión.
7. **Evidence before confidence.** Toda afirmación relevante indica fuente, vigencia, confianza y limitación.
8. **Spec before build** para cambios no triviales.
9. **One primary builder.** No permitir varios coding agents modificando el mismo árbol sin coordinación explícita.
10. **Independent verification.** El agente que implementa no se autoaprueba.
11. **Deterministic checks first.** Tests, lint, typecheck, build, security checks y comandos verificables antes de opinión LLM.
12. **Complexity must earn its place.** LangGraph, Knowledge Graph, Code Graph, RAG, multiagente, Redis, Neo4j, Graphiti, etc. entran sólo cuando una necesidad/eval lo justifica.
13. **Preserve source truth.** Raw sources no se sobrescriben silenciosamente.
14. **Secrets never enter prompts, memory, skills, Markdown or git.** Sólo referencias seguras.
15. **Stop rules are mandatory.** Con deadline cercano se reduce alcance antes de comprometer verificabilidad.
16. **Every important decision becomes an ADR or decision artifact.**
17. **Every session closes with verified handoff if work continues later.**
18. **ChatGPT authors Intelligence artifacts.** Skills, rules, policies, prompt/task templates, context contracts, quality contracts, knowledge-base content, agent instructions/rubrics and other knowledge-heavy artifacts are authored or semantically revised in ChatGPT first; coding agents only gather evidence, integrate, execute and verify them.

---

# 2. Arquitectura objetivo

La skill debe conducir al siguiente modelo desacoplado:

```text
                         USER / SPEC
                              │
                              ▼
                    ┌──────────────────┐
                    │    BRAIN CORE    │
                    │ Agent Runtime    │
                    │ Workflow Runtime │
                    │ Policy/Lifecycle │
                    │ Evidence/Run     │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
          CONTEXT PORT   CAPABILITY PORT  EXECUTION PORT
              │              │              │
       adapters/providers  adapters      adapters
              │              │              │
       Hermes/Wiki/Repo   Skills/Tools   Shell/Docker
       Notion/Sessions    MCP/Connectors Browser/Git
```

### 2.1 Core

El Core sólo conoce interfaces y lifecycle. No debe importar directamente Hermes, Notion, GitHub, PostgreSQL, Playwright, LangGraph ni un proveedor LLM específico.

### 2.2 Intelligence

Vive fuera del Core:

- agent definitions;
- skills;
- research protocols;
- architecture knowledge;
- quality contracts;
- evals;
- workflow definitions;
- task/prompt compilation;
- knowledge artifacts.

### 2.3 Providers/Adapters

Implementaciones reemplazables:

- ModelProvider;
- ContextProvider;
- MemoryProvider;
- KnowledgeProvider;
- CapabilityProvider;
- ExecutionProvider;
- SessionStore;
- WorkflowRuntime.

---

# 3. Herramientas disponibles

Esta skill debe funcionar con cualquier combinación de:

- Claude Code;
- Codex;
- ChatGPT;
- Gemini;
- Antigravity;
- otros coding agents compatibles.

No hardcodear cuál es el principal.

Al iniciar, elegir:

```yaml
primary_builder: <one>
independent_verifier: <one different when possible>
researcher: <one or same as verifier>
backup_builder: <one>
```

Regla: **sólo `primary_builder` puede modificar el árbol principal durante un step de implementación**, salvo que se utilicen worktrees/branches aislados con merge explícito.

## 3.1 ChatGPT Authoring Gate — obligatorio

ChatGPT es el **autor canónico de los artifacts de Intelligence y conocimiento** de esta bootstrap. Claude Code, Codex, Gemini, Antigravity u otro coding agent **no deben inventar ni cerrar por sí solos el contenido semántico** de estos artifacts.

### Artifacts que SIEMPRE requieren autoría/revisión semántica en ChatGPT

- `SKILL.md` y conocimiento auxiliar de una skill;
- rules, policies, guardrails y criterios de decisión;
- prompts maestros, task/prompt compiler templates e instrucciones de agentes;
- contratos `SPEC`, `QUALITY`, `CONTEXT`, `HANDOFF`, `AGENT`, `WORKFLOW`, `EVIDENCE` y equivalentes;
- bases de conocimiento, wiki pages curadas, architecture patterns, research protocols y ADRs conceptuales;
- rubrics, evaluation criteria y definitions of done;
- documentación normativa que determine cómo debe razonar o trabajar Brain.

### Artifacts que el coding agent sí puede producir directamente

- código fuente y adapters;
- tests, scripts y fixtures ejecutables;
- wiring/configuración mecánica basada en contratos ya aprobados;
- comandos, reportes de ejecución, inventarios y evidencia factual del repo;
- cambios puramente mecánicos de ruta, nombre, formato o line endings que no alteren significado.

### Protocolo obligatorio de handoff a ChatGPT

Cuando un step requiera crear o cambiar semánticamente un artifact del primer grupo:

1. **INSPECT.** El coding agent inspecciona repo, documentos canónicos y estado real.
2. **EVIDENCE PACK.** Genera un paquete pequeño con sólo hechos verificados, restricciones, paths relevantes, objetivo del step, outputs requeridos y dudas abiertas. No redacta la solución intelectual final.
3. **STOP.** Devuelve estado `CHATGPT_AUTHORING_REQUIRED` y se detiene. No avanza el step.
4. **READY-TO-PASTE REQUEST.** Entrega al usuario un prompt autocontenido para enviar a ChatGPT dentro del proyecto Brain. Debe pedir exactamente el artifact requerido y preservar vocabulario/contratos vigentes.
5. **CHATGPT AUTHORING.** ChatGPT investiga/razona cuando corresponda y produce la versión completa del artifact. Si necesita evidencia del repo que no está en el paquete, debe pedirla o indicar el gap; no inventarla.
6. **INTEGRATE.** El usuario/coding agent coloca el artifact aprobado en el path exacto del repo.
7. **VERIFY.** El coding agent ejecuta validaciones, ejemplos, tests/evals y comprueba integración.
8. **SEMANTIC FAILURE → CHATGPT.** Si la verificación descubre un problema conceptual, de reglas, conocimiento o instrucciones, se genera un feedback/evidence pack y se vuelve a ChatGPT. El coding agent no reescribe silenciosamente ese contenido.
9. **PASS.** Sólo después de integración + verificación puede cerrarse el step.

### Formato mínimo del `READY-TO-PASTE REQUEST`

```text
CHATGPT AUTHORING REQUEST
Step: <Sxx>
Artifact: <path exacto>
Purpose: <resultado requerido>

Verified facts:
- ...

Canonical sources to preserve:
- ...

Constraints / non-goals:
- ...

Required structure/schema:
- ...

Open questions / knowledge gaps:
- ...

Acceptance criteria:
- ...

Instruction:
Create the complete artifact for Brain. Distinguish verified facts, decisions, hypotheses and proposals. Do not invent repository state. Return only content suitable for integration plus any explicit unresolved gaps.
```

### Regla de autoridad

ChatGPT tiene prioridad para **autoría de Intelligence**, pero no puede contradecir hechos verificables del repo. En conflicto:

```text
runtime/repository evidence > approved SPEC/current state > approved ADR/contracts > ChatGPT proposal > historical chat inference
```

Este gate es especialmente obligatorio en `S01–S06`, `S08`, `S10`, `S12`, todos los `S13x`, `S16`, `S17`, `S19` y `S21`, y en cualquier step futuro que cree reglas, conocimiento, prompts, contratos o skills.

---

# 4. Estado persistente de la bootstrap

Crear y mantener:

```text
brain-bootstrap/
├── STATE.yaml
├── CURRENT.md
├── evidence/
├── decisions/
├── handoffs/
├── specs/
├── reports/
└── artifacts/
```

`STATE.yaml` mínimo:

```yaml
bootstrap_version: 1.1.0
current_step: S00
status: NOT_STARTED | IN_PROGRESS | CHATGPT_AUTHORING_REQUIRED | PASS | FAIL | BLOCKED
primary_builder: null
independent_verifier: null
started_at: null
last_verified_at: null
steps:
  S00: NOT_STARTED
  S01: NOT_STARTED
```

Nunca marcar un step `PASS` únicamente porque un agente diga que lo terminó.

---

# 5. Contrato obligatorio de cada Step

Cada step debe tener:

```yaml
id:
objective:
why_now:
inputs:
actions:
artifacts:
verification:
acceptance:
fail_conditions:
rollback:
handoff:
```

Y debe cerrar con:

```text
STEP_STATUS
ID: Sxx
STATUS: CHATGPT_AUTHORING_REQUIRED | PASS | FAIL | BLOCKED
ARTIFACTS:
EVIDENCE:
COMMANDS_EXECUTED:
OPEN_ISSUES:
NEXT_ALLOWED_STEP:
```

### Regla de interacción

Después de un `PASS`, **detenerse** y mostrar:

> Step Sxx aprobado con evidencia. El siguiente step permitido es Syy.

No ejecutar Syy hasta recibir instrucción explícita de continuar.

Si `FAIL`:

- permanecer en el mismo step;
- reproducir el fallo;
- encontrar causa raíz;
- aplicar corrección mínima;
- agregar regression check si aplica;
- volver a verificar.

Si `BLOCKED`:

- explicar exactamente qué falta;
- distinguir entre dependencia externa, dato desconocido, permiso, cuota o error;
- ofrecer el camino mínimo para desbloquear.

---

# 6. Quality Architecture transversal

Antes de ejecutar trabajo no trivial, crear un `QualityContract`.

```yaml
depth: FAST | STANDARD | DEEP
risk: LOW | MEDIUM | HIGH
ambiguity: LOW | MEDIUM | HIGH
novelty: LOW | MEDIUM | HIGH
irreversibility: LOW | MEDIUM | HIGH

evidence:
  required: true
  primary_sources_preferred: true
  cross_validation: false

research:
  knowledge_gaps_required: true
  alternatives_required: false
  contradictory_evidence_required: false

implementation:
  tests_required: true
  deterministic_checks_required: true
  tradeoffs_required: false

uncertainty:
  explicit: true
```

### Depth policy

**FAST**: cambios triviales, bajo riesgo, contexto local suficiente.

**STANDARD**: features, integraciones, auth, DB, API, agente simple.

**DEEP**: arquitectura nueva, agentes autónomos, seguridad, dinero, datos sensibles, infraestructura, decisiones difíciles de revertir, dominios desconocidos.

El nivel se decide por riesgo/ambigüedad/novedad/irreversibilidad, no por gusto del agente.

---

# 7. Resource Budget transversal

Toda ejecución importante debe considerar:

```yaml
budget:
  deadline:
  time_remaining:
  research_minutes:
  implementation_minutes:
  verification_minutes:
  context_tokens:
  retry_limit:
  emergency_reserve:
```

En Build Day:

- proteger una reserva final de depuración/demo;
- reducir scope antes que eliminar QA;
- no lanzar investigación redundante en varios modelos;
- no enviar el mismo contexto gigante a varios agentes;
- usar Context Pack pequeños y artifacts intermedios.

---

# 8. Step Definitions


## 3.2 External Handoff Prompt Standard — obligatorio

Cada vez que esta skill indique al usuario continuar trabajo en **ChatGPT, Claude Code, Codex, Gemini, Antigravity o cualquier otra plataforma**, debe entregar un **prompt completo, autocontenido y listo para copiar/pegar**. Nunca puede limitarse a frases como `abre ChatGPT`, `pídele a Codex que...`, `continúa en Claude` o equivalentes.

El objetivo es que una conversación nueva pueda arrancar con el contexto suficiente **sin depender del historial privado de la plataforma anterior** y sin obligar al usuario a reconstruir manualmente qué debe pedir.

### El prompt de transferencia DEBE incluir, cuando aplique

```text
PLATFORM HANDOFF PROMPT

Target platform:
<ChatGPT | Claude Code | Codex | Gemini | Antigravity | other>

Brain project / repository:
<nombre, path local y/o repo cuando esté verificado>

Current bootstrap step:
<Sxx + nombre>

Role for this platform:
<author | researcher | builder | verifier | integrator | reviewer>

Why this platform is being used:
<razón concreta y alcance>

Objective:
<resultado exacto que debe producir>

Background / relevant context:
<resumen suficiente para comprender el problema desde una conversación nueva>

Verified current state:
- hechos comprobados
- branch / HEAD / paths cuando sean relevantes
- checks ya ejecutados
- artifacts existentes

Canonical sources / contracts that must be preserved:
- ...

Inputs available:
- paths
- snippets
- evidence packs
- specs
- ADRs
- links o fuentes cuando existan

Constraints:
- ...

Explicit non-goals:
- ...

Unknowns / unresolved gaps:
- ...

Required work, step by step:
1. ...
2. ...
3. ...

Required deliverables:
- ...

Required output format:
<estructura exacta que debe devolver>

Verification / acceptance criteria:
- ...

Evidence required:
- comandos/resultados/citas/paths/etc. según el rol

Authority rules:
- no inventar estado del repo
- distinguir VERIFIED / ASSUMED / PROPOSED / BLOCKED
- no modificar contratos canónicos sin autorización
- si falta evidencia crítica, declararla explícitamente

Stop condition:
<condición exacta en la que debe detenerse y devolver control al usuario>

Next handoff expected:
<qué plataforma/rol recibe el resultado después, si ya se conoce>
```

### Reglas adicionales

1. **Self-contained.** El prompt debe ser entendible aun si la plataforma destino no conoce ninguna conversación anterior.
2. **No context dumping.** Debe incluir contexto suficiente pero no pegar historiales completos; usar evidence packs, specs y artifacts canónicos.
3. **Exact paths.** Cuando el trabajo dependa de archivos, incluir paths exactos verificados.
4. **Exact responsibility.** Debe quedar claro qué puede y qué no puede decidir esa plataforma.
5. **No silent continuation.** Si el siguiente paso requiere volver a ChatGPT u otra plataforma, el agente debe entregar el próximo prompt completo antes de detenerse.
6. **Artifact-first.** Preferir referenciar artifacts versionados (`SPEC`, `CURRENT`, `ADR`, `SKILL`, evidence report) frente a narrar conversaciones.
7. **Fresh start safe.** El prompt debe funcionar como primer mensaje de una conversación nueva.
8. **Semantic authoring rule remains.** Si el destino es ChatGPT para Intelligence authoring, además debe cumplir `3.1 ChatGPT Authoring Gate`.

Esta regla aplica a **todos los steps**, no sólo a los de autoría de skills.

## S00 — Preflight y alcance

### Objetivo
Confirmar qué existe realmente antes de diseñar o modificar.

### Acciones

1. Identificar repo/directorio de Brain.
2. Capturar `git status`, branch, HEAD y árbol relevante.
3. Identificar archivos canónicos de conocimiento existentes.
4. Identificar herramientas instaladas y autenticación disponible.
5. Seleccionar `primary_builder`, `independent_verifier`, `researcher`, `backup_builder`.
6. Crear `brain-bootstrap/STATE.yaml`.
7. Registrar restricciones reales de tiempo, SO y entorno.

### Artefactos

- `reports/S00-preflight.md`
- `STATE.yaml`

### Verificación

- repo/localidad existente;
- estado git capturado;
- ninguna modificación funcional realizada;
- herramientas realmente detectadas, no asumidas.

### PASS
Existe una fotografía reproducible del entorno y están definidos los roles de herramientas.

---

## S01 — Vocabulario y límites canónicos Brain v0.2

### Objetivo
Congelar definiciones para evitar mezclar Agent, Skill, Tool, MCP, Memory, Knowledge, Thread, Run y Workflow.

### Debe definir

- Rule;
- Skill;
- Tool;
- Connector;
- MCP;
- Guardrail;
- Memory;
- Knowledge;
- Context Pack;
- Agent;
- Thread;
- Run;
- Workflow;
- Execution Graph;
- Eval;
- Evidence;
- Quality Contract;
- Handoff.

### Artefacto
`specs/BRAIN_VOCABULARY_v0.2.md`

### Verificación
Crear 10 ejemplos ambiguos y comprobar que cada elemento puede clasificarse sin duplicidad conceptual.

### PASS
No existen términos críticos con responsabilidades superpuestas sin una decisión explícita.

---

## S02 — Core vs Intelligence vs Providers

### Objetivo
Definir el desacoplamiento central.

### Artefactos

- `specs/BRAIN_CORE_BOUNDARIES.md`
- `decisions/ADR-core-boundaries.md`

### Debe incluir

**Core**:
- runtime;
- lifecycle;
- policies;
- registries/interfaces;
- evidence/run handling.

**Intelligence**:
- skills;
- agent definitions;
- workflows;
- quality contracts;
- task compiler;
- evals;
- knowledge assets.

**Providers**:
- models;
- memory;
- knowledge;
- execution;
- connectors/MCP;
- workflow implementation.

### Verificación
Probar conceptualmente que Hermes, Notion, GitHub, LangGraph y proveedor LLM pueden sustituirse sin cambiar el contrato del Core.

### PASS
Ninguna integración concreta es necesaria para compilar mentalmente/estructuralmente el Core.

---

## S03 — Spec-Driven Development Contract

### Objetivo
Definir cómo un requerimiento ambiguo se convierte en trabajo verificable.

### Pipeline canónico

```text
RAW REQUEST
→ DISCOVERY
→ KNOWLEDGE GAPS
→ QUALITY CONTRACT
→ RESEARCH
→ SPEC
→ HUMAN APPROVAL
→ ARCHITECTURE
→ AGENT DESIGN IF NEEDED
→ PLAN
→ TASK COMPILATION
→ BUILD
→ QA
→ VERIFY
→ DELIVER
```

### Artefactos

- `specs/SPEC_CONTRACT.md`
- `templates/SPEC.template.md`
- `templates/DISCOVERY.template.md`
- `templates/ASSUMPTIONS.template.md`

### Verificación
Aplicarlo a tres requerimientos radicalmente distintos y comprobar que no presupone un dominio específico.

### PASS
Los tres casos producen requirements, unknowns y acceptance criteria claros sin diseñar prematuramente.

---

## S04 — Quality Architecture v1

### Objetivo
Evitar investigación, arquitectura y código superficiales.

### Debe definir

- Knowledge Gap Analysis;
- Depth Selection;
- Research Protocol;
- Evidence Contract;
- Challenger protocol;
- Definition of Done;
- deterministic QA before LLM review;
- uncertainty representation.

### Artefactos

- `specs/QUALITY_ARCHITECTURE_v1.md`
- `templates/QUALITY_CONTRACT.yaml`
- `templates/EVIDENCE_RECORD.yaml`

### Test real
Tomar una pregunta arquitectónica desconocida y comparar una respuesta libre contra una respuesta ejecutada con Quality Contract.

### PASS
La salida con Quality Contract contiene fuentes/razones/alternativas/limitaciones verificables y supera claramente a la salida libre.

---

## S05 — Context Architecture v1

### Objetivo
Definir qué contexto existe, autoridad, recuperación y presupuesto.

### Capas

1. identity;
2. user context;
3. durable memory;
4. project instructions;
5. compiled knowledge;
6. historical sessions;
7. current verified state;
8. working context;
9. child-agent packet.

### Authority order mínimo

1. runtime/repository reality;
2. explicit current spec;
3. verified current/handoff;
4. ADRs;
5. project instructions;
6. compiled knowledge;
7. durable memory;
8. historical sessions;
9. inference.

### Artefactos

- `specs/CONTEXT_ARCHITECTURE_v1.md`
- `specs/CONTEXT_PACKET.schema.yaml`
- `decisions/ADR-context-authority.md`

### Verificación
Simular información contradictoria entre memoria, handoff y repo y comprobar que gana la fuente de mayor autoridad.

### PASS
El sistema puede construir un Context Packet pequeño sin copiar todo el historial.

---

## S06 — Session Continuity & Handoff

### Objetivo
Poder cerrar una sesión larga y continuar en otra sin perder estado ni arrastrar todo el contexto.

### Crear

- `brain/context/CURRENT.md`
- `brain/context/handoffs/`
- `templates/HANDOFF.template.md`
- `templates/SESSION_BOOT.template.md`
- `templates/SESSION_CLOSE.template.md`

### Handoff obligatorio

- objective;
- branch/HEAD/status;
- verified completed work;
- commands/evidence;
- decisions;
- open issues;
- changed files;
- next exact action;
- do-not-do;
- assumptions needing revalidation.

### Verification

1. cerrar una sesión de prueba;
2. iniciar una sesión nueva con sólo project context + handoff;
3. verificar repo real;
4. continuar correctamente una tarea sin usar transcript completo.

### PASS
La segunda sesión puede continuar correctamente y detectar un handoff deliberadamente obsoleto.

---

## S07 — Hermes Adapter

### Objetivo
Integrar Hermes como proveedor de memoria/sesiones sin acoplar Brain a Hermes.

### Contrato esperado

```text
MemoryProvider
  retrieve()
  remember_candidate()
  commit_verified_memory()
  search_history()
```

### Reglas

- memoria durable pequeña;
- histórico recuperable bajo demanda;
- no guardar temporalidades irrelevantes;
- memoria permanente requiere criterio/verificación;
- provider sustituible.

### Artefactos

- `specs/MEMORY_PROVIDER.md`
- adapter/config de Hermes;
- tests de contract.

### Verificación

- guardar un hecho durable;
- abrir nueva sesión;
- recuperarlo;
- buscar un dato histórico que no esté en hot memory;
- probar que un dato temporal no se promueve automáticamente.

### PASS
Hermes funciona detrás del contrato y Brain puede operar aunque el adapter sea deshabilitado.

---

## S08 — Knowledge Layer: Wiki + Notion

### Objetivo
Separar conocimiento compilado, conocimiento humano y memoria.

### Diseño

- Markdown/Git como representación canónica portable;
- Brain Wiki para conocimiento compilado;
- Notion como human knowledge surface/adaptador, no dependencia del Core;
- raw sources separadas e inmutables;
- procedencia y vigencia.

### Crear inicialmente

```text
knowledge/
├── index.md
├── sources/
├── concepts/
├── decisions/
├── architecture-patterns/
├── agent-patterns/
└── failure-modes/
```

### Verificación
Ingerir una fuente pequeña, producir knowledge artifact citado, recuperarlo para una consulta y demostrar que la fuente original no cambió.

### PASS
Knowledge puede consultarse sin cargar la base completa y Notion puede desconectarse sin romper Brain.

---

## S09 — Agent Runtime Fundamentals

### Objetivo
Construir y comprender un agent loop mínimo antes de frameworks avanzados.

### Loop

```text
Goal
→ Context
→ Model decision
→ Tool call or finish
→ Observation
→ State update
→ Repeat / Stop
```

### Debe soportar

- model adapter;
- structured messages;
- tool schema;
- max turns;
- timeout;
- success/fail/blocked;
- event log;
- token/cost hooks cuando estén disponibles.

### No incluir aún

- multiagente;
- LangGraph;
- Knowledge Graph;
- skill factory;
- self-improvement.

### Verificación
Crear un agente mínimo que resuelva una tarea usando al menos una tool real y produzca salida estructurada.

### PASS
Se puede explicar y observar cada iteración del loop, incluido por qué terminó.

---

## S10 — AgentDefinition v1

### Objetivo
Evitar clases hardcodeadas por rol.

### Contrato mínimo

```yaml
id:
role:
objective:
model_policy:
context_policy:
state_schema:
tools: []
skills: []
capabilities: []
memory_policy:
permissions:
delegation:
limits:
termination:
output_schema:
rubric:
evals: []
```

### Verificación
Definir `researcher`, `builder` y `verifier` usando el mismo runtime sin crear runtimes separados.

### PASS
Los tres roles cambian por configuración y políticas, no por lógica especial duplicada.

---

## S11 — Primer agente real: Researcher

### Objetivo
Resolver el problema de investigación superficial con un agente observable.

### Debe usar

- Knowledge Gap Analysis;
- Research Skill;
- Quality Contract;
- authoritative/primary sources preferidas;
- cross-check cuando sea STANDARD/DEEP;
- claims con fuente/fecha/confianza/limitaciones;
- stop rule por value of information.

### Salida

```yaml
question:
subquestions: []
findings:
  - claim:
    evidence: []
    confidence:
    limitations:
contradictions: []
unknowns: []
decision_relevant_summary:
```

### Verificación
Usar un problema real desconocido. Un verifier independiente debe poder rastrear cada claim importante.

### PASS
No existen claims críticos sin evidencia o señal explícita de inferencia/incertidumbre.

---

## S12 — Skill Registry y Skill Contract v1

### Objetivo
Cargar procedimientos bajo demanda, sin prompt gigante.

### Contrato

```yaml
id:
version:
description:
applies_when:
inputs:
outputs:
requires:
rules:
procedure:
verification:
permissions:
evals:
```

### Discovery
El runtime ve metadata/descripción; carga contenido completo sólo cuando la skill es seleccionada.

### PASS
Un agente puede descubrir y cargar una skill relevante sin inyectar todo el catálogo en contexto.

---

# 9. Skills a construir una por una

Cada substep siguiente se considera un step independiente. No crear todas de golpe.

## S13A — requirements-discovery
Convierte request ambiguo en goals, users, unknowns, assumptions, constraints y acceptance criteria.

## S13B — knowledge-gap-analysis
Separa known / told / proven / assumed / needs-research / unknowable.

## S13C — deep-research
Descompone preguntas, busca evidencia de calidad, contrasta, identifica contradicciones y sintetiza con límites.

## S13D — software-architecture
Compara alternativas, trade-offs, failure modes, coste, operación, seguridad y produce ADR.

## S13E — agent-engineering
Decide si hace falta agente; diseña goal/state/tools/permissions/memory/termination/evals.

## S13F — implementation-planning
Convierte SPEC/architecture en P0/P1/P2 y tareas pequeñas verificables.

## S13G — task-prompt-compiler
Genera Execution Package, no simplemente un “prompt bonito”.

Entrada:
- task;
- spec;
- agent definition;
- context packet;
- selected skills;
- capabilities;
- constraints;
- acceptance;
- evidence required.

Salida:
- objective;
- instructions;
- context;
- tools;
- limits;
- output schema;
- acceptance;
- evidence.

## S13H — repository-git-workflow
Preflight, branch/worktree, diff, commits, PR/handoff y no destructive operations.

## S13I — backend-api-engineering
Routes, validation, services, errors, auth boundaries, schemas, observability.

## S13J — postgres-data-modeling
Schema, PK/FK, indexes, constraints, migrations, transactions, query checks.

## S13K — frontend-product-surface
User flows y estados loading/empty/error/retry/approval/rejection; accesibilidad básica.

## S13L — guardrails-security
AuthN/AuthZ, tenants, secrets, tool permissions, prompt injection, destructive-action policy.

## S13M — qa-debugging
Reproduce → evidence → root cause → minimal fix → regression → relevant suite.

## S13N — agent-evals
Golden cases, tool selection, schema compliance, task success, safety, latency/cost.

## S13O — async-reliability
Timeouts, retries, backoff, idempotency, async jobs, failure states.

## S13P — observability-ai-systems
Run IDs, traces, prompts/versions, model, tools, tokens, cost, latency, errors.

## S13Q — delivery-documentation-demo
README, architecture summary, setup, demo, limitations, next steps.

## S13R — deployment
Docker first, environment/secrets, health checks, deploy verification; provider-specific adapters later.

### Acceptance de cada S13x

Para cada skill:

1. el coding agent inspecciona el repo y genera `CHATGPT_AUTHORING_REQUEST`;
2. detenerse en `CHATGPT_AUTHORING_REQUIRED`;
3. ChatGPT crea el `SKILL.md` completo y cualquier knowledge/rules/prompt content asociado;
4. integrar el artifact aprobado sin alterar silenciosamente su semántica;
5. crear ejemplos reales;
6. crear al menos un caso negativo;
7. crear eval o verification fixture;
8. ejecutar con un agente real;
9. verificar que mejora frente a ejecución sin skill;
10. si el fallo es semántico, volver a ChatGPT con evidencia; si es mecánico/técnico, corregir y reejecutar;
11. registrar resultado y evidencia.

No avanzar al siguiente `S13x` si no cumple.

---

## S14 — Capability Registry, Tools y MCP

### Objetivo
Que los agentes pidan capacidades, no integraciones hardcodeadas.

Ejemplo:

```text
repository.read
    → local git OR GitHub adapter/MCP

documentation.search
    → Context7 OR web/docs adapter

browser.inspect
    → Playwright CLI OR Playwright MCP
```

### Construcción incremental

1. filesystem;
2. shell;
3. git;
4. documentation/search;
5. GitHub;
6. browser;
7. PostgreSQL inspect;
8. otros sólo si aparece necesidad.

### PASS
Cambiar la implementación de una capacidad no requiere cambiar la AgentDefinition.

---

## S15 — Verifier Agent

### Objetivo
Crear verificación independiente.

### Política

- read repo/diff;
- run tests/checks;
- read spec/acceptance;
- no modificar implementación;
- no aceptar claims sin evidencia;
- salida `PASS | FAIL | BLOCKED`.

### Output

```yaml
status:
requirements:
  - id:
    status:
    evidence:
findings: []
required_fixes: []
uncertainty: []
```

### Test obligatorio
Inyectar deliberadamente una implementación que “parece correcta” pero viola un acceptance criterion.

### PASS
Verifier detecta el fallo y aporta evidencia reproducible.

---

## S16 — Architecture Challenger

### Objetivo
Evitar que la primera arquitectura razonable se convierta en verdad por inercia.

### Input

- requirement/spec;
- proposed architecture;
- evidence;
- constraints.

### Goal
Buscar failure modes, assumptions débiles, alternativas mejores, riesgos de operación/seguridad/coste.

### PASS
En al menos un caso de prueba encuentra un riesgo real no identificado inicialmente, sin inventar evidencia.

---

## S17 — Workflow Runtime v1

### Objetivo
Ejecutar workflows sin casarse inicialmente con LangGraph.

### Workflows mínimos

**Feature/SDD**

```text
Discovery → Spec → Architecture → Plan → Build → QA → Verify → Deliver
```

**Bug**

```text
Reproduce → Diagnose → Fix → Regression → Verify
```

**Research**

```text
Gap Analysis → Research → Challenge/Cross-check → Synthesis
```

### Estado
Cada nodo: input/output/status/evidence/retry count/budget.

### PASS
Workflow puede detenerse, fallar, reintentar el nodo responsable y continuar sin reiniciar todo.

---

## S18 — Delegation y Multi-agent mínimo

### Objetivo
Sólo después de single-agent + verifier estables.

### Reglas

- contexto hijo aislado;
- Context Packet explícito;
- max depth inicial 2;
- resultados vuelven como artifact estructurado;
- padre/verifier puede comprobar evidencia;
- concurrency sólo para tareas realmente independientes.

### PASS
Orchestrator simple puede delegar a un specialist y verificar su artifact sin compartir transcript completo.

---

## S19 — Orchestrator

### Objetivo
Coordinar quién hace qué, con qué contexto, permisos, presupuesto y siguiente transición.

### No debe

- hacer todo el trabajo él mismo;
- cargar todo el conocimiento;
- saltarse Quality Contract;
- autoaprobar;
- crear agentes infinitamente;
- delegar sin budget.

### Debe decidir

- workflow apropiado;
- depth/quality;
- required capabilities;
- agent/specialist;
- Context Packet;
- budget;
- approval points;
- stop/escalation.

### PASS
Resolver dos tipos de requerimiento muy distintos usando workflows/agentes diferentes sin cambiar código del orchestrator.

---

## S20 — Observability, Evals y Resource Manager

### Objetivo
Saber qué ocurrió y cuándo el sistema está mejorando/empeorando.

### Registrar por run

- task/spec;
- agent/skill versions;
- model/provider;
- context sources/tokens;
- tool calls;
- latency;
- retries;
- test/eval results;
- artifacts;
- cost/tokens cuando disponibles;
- final status.

### Resource Manager

Policy basada en:

- time remaining;
- risk;
- ambiguity;
- token/quota pressure;
- retry count;
- value of information.

### PASS
Un run fallido puede reconstruirse sin depender de la memoria humana del chat.

---

## S21 — Build-Day Operating Model

### Objetivo
Preparar el flujo de 8:00 a 17:00 sin construir Brain durante la competencia.

### Timebox recomendado

```text
08:00–08:35  Understand / Discovery
08:35–09:15  Decision-relevant Research
09:15–09:30  Spec / Architecture / P0-P1-P2
09:30–12:00  Vertical Slice
12:00–13:00  Agent reliability / guardrails / evals
13:00–14:30  Complete P0/P1
14:30–15:30  QA / E2E / security
15:30         Feature freeze
15:30–16:15  Fix / polish / README / demo
16:15–17:00  Reserve / final verification
```

### Stop rules

- 15:30: no nueva arquitectura;
- deadline < 2h: reducir scope antes que QA;
- deadline < 1h: sólo fixes/documentación/demo;
- deadline < 30m: no nuevos cambios salvo bloqueante del demo;
- cuota baja: comprimir contexto, eliminar investigación redundante, usar fallback model;
- tecnología desconocida: research timebox; si no cambia decisión crítica, usar opción conocida.

### PASS
Runbook puede seguirse sin decisiones improvisadas sobre proceso.

---

## S22 — Simulacro E2E desconocido

### Objetivo
Probar el sistema contra un problema de cliente no utilizado para diseñarlo.

### Restricción
El requerimiento debe ser deliberadamente ambiguo y de dominio diferente a los ejemplos de construcción.

### Ejecución

```text
raw request
→ discovery
→ gaps
→ quality
→ research
→ spec
→ architecture
→ agent decision
→ plan
→ task compile
→ build vertical slice
→ QA
→ verifier
→ demo/handoff
```

### Métricas

- tiempo a primera vertical slice;
- número de supuestos no declarados;
- claims críticos sin fuente;
- context tokens por fase;
- retries;
- tests/evals;
- acceptance pass rate;
- demo readiness;
- dependencia de intervención manual.

### PASS
El sistema produce una solución funcional verificable y puede explicar decisiones, evidencias, límites y próximos pasos.

---

## S23 — Freeze / Release `brain-build-day-v1`

### Objetivo
Congelar una versión estable antes del evento.

### Acciones

1. ejecutar suites relevantes;
2. ejecutar smoke test de herramientas/MCP;
3. verificar auth/config sin exponer secretos;
4. revisar skills/agents/workflows versionados;
5. crear release manifest;
6. generar `BUILD_DAY_READY.md`;
7. generar handoff final;
8. no introducir features grandes después del freeze.

### `BUILD_DAY_READY.md` debe decir

- herramientas comprobadas;
- primary/backup model strategy;
- workflows disponibles;
- agents disponibles;
- skills disponibles;
- MCP/capabilities disponibles;
- comandos de arranque;
- fallbacks;
- limitaciones conocidas;
- checklist de inicio del sábado.

### PASS FINAL
Un entorno limpio/nueva sesión puede arrancar usando únicamente la documentación y ejecutar el simulacro básico sin conocimiento oculto de sesiones anteriores.

---

# 10. Protocolo de verificación de cada implementación

Cuando el usuario indique que un step fue realizado por Claude Code, Codex, Gemini o Antigravity, **no aceptar el resumen como prueba**.

Solicitar/obtener y verificar según corresponda:

```text
git status --porcelain=v1
git log --oneline -N
git diff / git show
relevant files
build command
typecheck/lint
tests
E2E/smoke
runtime output
```

Luego emitir:

```text
VERIFICATION RESULT
Step:
Status: PASS | FAIL | BLOCKED
Evidence reviewed:
Failures:
Required corrections:
Next allowed step:
```

Si la verificación se realiza en otro modelo, entregar sólo el Context Packet necesario y pedir verificación independiente, no una continuación ciega del builder.

---

# 11. Session Close obligatorio

Si una sesión termina antes de finalizar la bootstrap:

1. verificar repo real;
2. actualizar `STATE.yaml`;
3. actualizar `CURRENT.md`;
4. crear handoff versionado;
5. registrar comandos/evidencia;
6. indicar exactamente el step activo;
7. escribir el prompt mínimo de arranque de la próxima sesión.

Prompt de nueva sesión debe exigir:

```text
Read project context + CURRENT/HANDOFF.
Verify git HEAD/status and critical assumptions yourself.
Do not trust stale claims.
Resume only the active step.
Do not start later steps.
```

Nunca copiar toda la conversación anterior salvo necesidad justificada.

---

# 12. Qué queda explícitamente fuera de esta bootstrap inicial

No implementar por defecto:

- full Knowledge Graph;
- full Code Graph propio;
- Neo4j/Graphiti;
- LangGraph como dependencia obligatoria;
- Skill Factory autónoma;
- self-modifying agents;
- multi-provider deployment factory completa;
- decenas de MCPs;
- microservices/distributed workers sin necesidad;
- RAG/vector DB si retrieval simple resuelve;
- multiagente antes de single-agent + verifier estable.

Estas capacidades pueden incorporarse mediante ADR + eval que demuestre la necesidad.

---

# 13. Criterio de éxito de la skill

Esta skill termina sólo cuando existe evidencia de que Brain puede:

1. recibir un requerimiento ambiguo de cliente;
2. identificar unknowns y knowledge gaps;
3. determinar el nivel correcto de profundidad;
4. investigar con evidencia suficiente;
5. producir SPEC verificable;
6. seleccionar arquitectura con trade-offs fundamentados;
7. decidir si realmente necesita agentes;
8. definir un agente por configuración;
9. compilar un Context/Execution Package pequeño;
10. implementar una vertical slice;
11. usar tools/capabilities sin hardcoding de proveedor;
12. ejecutar QA determinístico;
13. recibir verificación independiente;
14. conservar continuidad entre sesiones;
15. recuperar memoria/knowledge bajo demanda;
16. cambiar de modelo sin perder el estado del proyecto;
17. observar tiempo/tokens/retries/evidencia;
18. ejecutar un simulacro completo dentro del presupuesto del Build Day.

Si alguno de estos puntos depende de conocimiento oculto, transcript previo o intervención improvisada no documentada, la bootstrap todavía no está terminada.

---

# 14. Primera acción al activar esta skill

**Ejecutar únicamente `S00 — Preflight y alcance`.**

No diseñar arquitectura, agentes, skills, MCPs ni contexto todavía.

Al terminar S00, mostrar evidencia y detenerse.

A partir de `S01`, antes de crear cualquier artifact de Intelligence/knowledge, aplicar obligatoriamente `3.1 ChatGPT Authoring Gate`.

