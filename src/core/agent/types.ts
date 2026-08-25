/**
 * Brain Core — Agent Runtime contract.
 *
 * Defined in brain-bootstrap/specs/AGENT_RUNTIME_LOOP_v1.md (ChatGPT-authored,
 * integrated verbatim). This file contains ONLY provider-neutral types.
 *
 * Core code that imports these types must never import a concrete
 * ModelProvider or CapabilityProvider implementation.
 */

// ---------------------------------------------------------------------------
// JSON-schema-like descriptor (S09 does not require a full JSON Schema impl)
// ---------------------------------------------------------------------------

export type JsonSchemaLike = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Section 4 — ModelProvider contract
// ---------------------------------------------------------------------------

export interface ModelProvider {
  decide(request: ModelDecisionRequest): Promise<ModelDecisionResult>;
}

export interface ModelDecisionRequest {
  run_id: string;
  turn: number;

  goal: {
    statement: string;
  };

  context: {
    context_pack_ref?: string;
    summary?: string;
  };

  messages: AgentMessage[];

  capabilities: ToolDescriptor[];

  state: {
    prior_observations: ObservationMessage[];
    working_state?: Record<string, unknown>;
  };

  limits: {
    remaining_turns: number;
    remaining_time_ms: number;
  };
}

export type ModelDecisionResult =
  | {
      status: "SUCCESS";
      decision: ModelDecision;
      usage?: ModelUsage;
    }
  | {
      status: "FAIL";
      error: NormalizedModelError;
      usage?: ModelUsage;
    }
  | {
      status: "BLOCKED";
      reason: string;
      usage?: ModelUsage;
    };

export type ModelDecision =
  | {
      type: "TOOL_CALL";
      rationale: string;
      tool_call: {
        call_id: string;
        capability_id: string;
        input: Record<string, unknown>;
      };
    }
  | {
      type: "FINISH";
      rationale: string;
      output: StructuredAgentOutput;
    };

export interface StructuredAgentOutput {
  summary: string;
  data?: Record<string, unknown>;
  evidence_refs?: string[];
}

export interface ModelUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cost_amount?: number;
  cost_currency?: string;
  provider_metadata?: Record<string, unknown>;
}

export interface NormalizedModelError {
  code:
    | "UNAVAILABLE"
    | "TIMEOUT"
    | "INVALID_REQUEST"
    | "INVALID_RESPONSE"
    | "RATE_LIMITED"
    | "AUTH_REQUIRED"
    | "INTERNAL_ERROR";

  message: string;
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// Section 5-7 — CapabilityProvider contract
// ---------------------------------------------------------------------------

export interface CapabilityListRequest {
  run_id?: string;
}

export interface CapabilityProvider {
  list_capabilities(request?: CapabilityListRequest): Promise<ToolDescriptor[]>;
  invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult>;
}

export interface ToolDescriptor {
  capability_id: string;
  name: string;
  description: string;

  input_schema: JsonSchemaLike;
  output_schema?: JsonSchemaLike;

  side_effects: "NONE" | "LOCAL" | "EXTERNAL";

  timeout_ms?: number;
}

export interface ToolInvocationRequest {
  run_id: string;
  turn: number;
  call_id: string;
  capability_id: string;
  input: Record<string, unknown>;

  timeout_ms: number;
}

export type ToolInvocationResult =
  | {
      status: "SUCCESS";
      call_id: string;
      capability_id: string;
      output: Record<string, unknown>;
      evidence_refs?: string[];
      duration_ms: number;
    }
  | {
      status: "FAIL";
      call_id: string;
      capability_id: string;
      error: NormalizedToolError;
      evidence_refs?: string[];
      duration_ms: number;
    }
  | {
      status: "BLOCKED";
      call_id: string;
      capability_id: string;
      reason: string;
      evidence_refs?: string[];
      duration_ms: number;
    };

export interface NormalizedToolError {
  code:
    | "NOT_FOUND"
    | "INVALID_INPUT"
    | "TIMEOUT"
    | "PERMISSION_DENIED"
    | "UNAVAILABLE"
    | "EXECUTION_FAILED"
    | "INTERNAL_ERROR";

  message: string;
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// Section 10 — Agent message schema
// ---------------------------------------------------------------------------

export type AgentMessage =
  | GoalMessage
  | ContextMessage
  | DecisionMessage
  | ToolCallMessage
  | ObservationMessage
  | StateUpdateMessage
  | FinalMessage;

export interface GoalMessage {
  type: "GOAL";
  goal: string;
}

export interface ContextMessage {
  type: "CONTEXT";
  context_pack_ref?: string;
  summary?: string;
}

export interface DecisionMessage {
  type: "MODEL_DECISION";
  turn: number;
  decision: ModelDecision;
}

export interface ToolCallMessage {
  type: "TOOL_CALL";
  turn: number;
  call_id: string;
  capability_id: string;
  input: Record<string, unknown>;
}

export interface ObservationMessage {
  type: "OBSERVATION";
  turn: number;
  call_id: string;
  capability_id: string;

  outcome: "SUCCESS" | "FAIL" | "BLOCKED";

  output?: Record<string, unknown>;
  error?: NormalizedToolError;
  reason?: string;

  evidence_refs?: string[];
}

export interface StateUpdateMessage {
  type: "STATE_UPDATE";
  turn: number;
  patch: Record<string, unknown>;
  reason: string;
}

export interface FinalMessage {
  type: "FINAL";
  outcome: TerminalOutcome;
  output?: StructuredAgentOutput;
  termination: TerminationExplanation;
}

// ---------------------------------------------------------------------------
// Section 11 — Run state
// ---------------------------------------------------------------------------

export interface AgentRunState {
  run_id: string;

  status: "RUNNING" | "SUCCESS" | "FAIL" | "BLOCKED";

  turn: number;

  started_at: string;
  deadline_at?: string;

  messages: AgentMessage[];

  working_state: Record<string, unknown>;

  usage: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    cost_amount?: number;
    cost_currency?: string;
  };
}

// ---------------------------------------------------------------------------
// Section 12 — Event log
// ---------------------------------------------------------------------------

export type AgentRunEventType =
  | "RUN_STARTED"
  | "CONTEXT_ACCEPTED"
  | "MODEL_REQUESTED"
  | "MODEL_DECIDED"
  | "TOOL_REQUESTED"
  | "TOOL_COMPLETED"
  | "TOOL_FAILED"
  | "STATE_UPDATED"
  | "RUN_SUCCEEDED"
  | "RUN_FAILED"
  | "RUN_BLOCKED"
  | "RUN_TIMED_OUT"
  | "RUN_MAX_TURNS";

export interface AgentRunEvent {
  event_id: string;
  run_id: string;
  sequence: number;
  timestamp: string;

  type: AgentRunEventType;

  turn?: number;

  details: Record<string, unknown>;

  evidence_refs?: string[];
}

// ---------------------------------------------------------------------------
// Section 16-18 — Termination semantics
// ---------------------------------------------------------------------------

export type TerminalOutcome = "SUCCESS" | "FAIL" | "BLOCKED";

export type TerminationReasonCode =
  | "GOAL_COMPLETED"
  | "MODEL_ERROR"
  | "TOOL_ERROR"
  | "INVALID_MODEL_DECISION"
  | "INVALID_STRUCTURED_OUTPUT"
  | "MAX_TURNS_EXCEEDED"
  | "TIMEOUT_EXCEEDED"
  | "REQUIRED_CAPABILITY_MISSING"
  | "MODEL_PROVIDER_UNAVAILABLE"
  | "PERMISSION_REQUIRED"
  | "REQUIRED_CONTEXT_MISSING";

export interface TerminationExplanation {
  outcome: TerminalOutcome;
  reason_code: TerminationReasonCode;
  message: string;
  final_turn: number;
  triggering_event_id: string;
}

// ---------------------------------------------------------------------------
// Section 17 — Limits
// ---------------------------------------------------------------------------

export interface AgentRunLimits {
  max_turns: number;
  timeout_ms: number;
}

// ---------------------------------------------------------------------------
// Section 19 — Final Run result
// ---------------------------------------------------------------------------

export interface AgentRunResult {
  run_id: string;
  outcome: TerminalOutcome;
  output?: StructuredAgentOutput;
  termination: TerminationExplanation;
  events: AgentRunEvent[];
  usage?: ModelUsage;
}
