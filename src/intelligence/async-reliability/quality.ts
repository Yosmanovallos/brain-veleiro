import { RETRY_CANDIDATES, TERMINAL_JOB_STATES, containsForbiddenSensitiveMaterial } from "./constants.js";
import { assessReplaySafety, classifyReliabilityFailure, deriveAsyncReliabilityDecision, validateAsyncJobTransition, validateAsyncReliabilityInput } from "./modeling.js";
import type { AsyncReliabilityDecision, AsyncReliabilityInput } from "./types.js";

export const ASYNC_RELIABILITY_ATOMIC_IDS = ["SD1-A","SD1-B","SD1-C","SD2-A","SD2-B","SD2-C","SD3-A","SD3-B","SD3-C","SD4-A","SD4-B","SD4-C","SD5-A","SD5-B","SD5-C","SD6-A","SD6-B","SD6-C","SD7-A","SD7-B","SD7-C","SD8-A","SD8-B","SD8-C","SD9-A","SD9-B","SD9-C","SD10-A","SD10-B","SD10-C"] as const;
export type AsyncReliabilityAtomicId = typeof ASYNC_RELIABILITY_ATOMIC_IDS[number];

export const ASYNC_RELIABILITY_ATOMIC_FIELD_FAMILIES: Record<AsyncReliabilityAtomicId, string> = {
  "SD1-A":"subject.operation_job_attempt_binding_result", "SD1-B":"policy.structural_validation_result", "SD1-C":"subject.input_immutability_result",
  "SD2-A":"failure.normalized_mapping_result", "SD2-B":"failure.retryable_hint_authority_result", "SD2-C":"failure.dispatch_ambiguity_result",
  "SD3-A":"retry.failure_class_eligibility_result", "SD3-B":"retry.side_effect_eligibility_result", "SD3-C":"retry.single_next_attempt_result",
  "SD4-A":"budget.attempt_count_result", "SD4-B":"budget.elapsed_window_result", "SD4-C":"budget.deadline_fit_result",
  "SD5-A":"backoff.formula_result", "SD5-B":"backoff.retry_after_result", "SD5-C":"backoff.schedule_result",
  "SD6-A":"idempotency.operation_class_result", "SD6-B":"idempotency.evidence_binding_result", "SD6-C":"idempotency.ambiguity_reconciliation_result",
  "SD7-A":"cancellation.predispatch_result", "SD7-B":"cancellation.postdispatch_result", "SD7-C":"cancellation.success_race_result",
  "SD8-A":"job.transition_result", "SD8-B":"job.terminal_state_result", "SD8-C":"job.durability_boundary_result",
  "SD9-A":"security.authority_result", "SD9-B":"security.approval_capability_result", "SD9-C":"security.secret_minimization_result",
  "SD10-A":"decision.status_action_recompute_result", "SD10-B":"decision.uncertainty_result", "SD10-C":"decision.stage_boundary_result",
};

export interface AsyncReliabilityEvaluationAudit {
  input_snapshot_before: string;
  input_snapshot_after: string;
  candidate_gate_valid: boolean;
  durable_runtime_introduced: boolean;
  future_stage_pull_forward: boolean;
}
export interface AsyncReliabilitySourceFact { field_family: string; expected_observation: unknown; evidence: string; }
export type AsyncReliabilitySourceFacts = Record<AsyncReliabilityAtomicId, AsyncReliabilitySourceFact>;
export type AsyncReliabilityAtomicObservations = Record<AsyncReliabilityAtomicId, { correct: boolean; field_family: string; actual_observation: unknown; expected_observation: unknown; evidence: string }>;

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const defaultAudit = (input: AsyncReliabilityInput): AsyncReliabilityEvaluationAudit => {
  const snapshot = JSON.stringify(input);
  return {input_snapshot_before:snapshot,input_snapshot_after:snapshot,candidate_gate_valid:true,durable_runtime_introduced:false,future_stage_pull_forward:false};
};

/** Computes the actual observation owned by one canonical QC field family. */
function observeAtomic(id: AsyncReliabilityAtomicId, input: AsyncReliabilityInput, decision: AsyncReliabilityDecision, audit: AsyncReliabilityEvaluationAudit): unknown {
  const latest=input.attempts.at(-1)!;
  const validation=validateAsyncReliabilityInput(input);
  const failure=classifyReliabilityFailure(latest);
  const replay=validation.valid?assessReplaySafety(input):undefined;
  const terminal=TERMINAL_JOB_STATES.has(input.job.state);
  switch(id) {
    case "SD1-A": return [decision.task_ref,decision.operation_ref,decision.job_id,decision.latest_attempt_id];
    case "SD1-B": return [validation.valid,audit.candidate_gate_valid];
    case "SD1-C": return audit.input_snapshot_before===audit.input_snapshot_after;
    case "SD2-A": return decision.failure_class;
    case "SD2-B": return !(latest.retryable_hint===true&&!RETRY_CANDIDATES.has(failure)&&decision.action==="RETRY");
    case "SD2-C": return [latest.dispatch_state,input.operation.side_effect_class,replay?.requires_reconciliation??false,decision.status,decision.action,decision.requires_reconciliation];
    case "SD3-A": return [RETRY_CANDIDATES.has(decision.failure_class),decision.action==="RETRY"];
    case "SD3-B": return [input.operation.side_effect_class,decision.replay_disposition,decision.action==="RETRY"];
    case "SD3-C": return [decision.action==="RETRY",decision.next_attempt_number];
    case "SD4-A": return [decision.remaining_attempts,decision.next_attempt_number];
    case "SD4-B": return [decision.remaining_elapsed_ms,decision.delay_ms];
    case "SD4-C": return [decision.remaining_deadline_ms,decision.delay_ms,decision.reason_code==="DEADLINE_EXHAUSTED"];
    case "SD5-A": return decision.delay_ms;
    case "SD5-B": return decision.action!=="RETRY"||latest.retry_after_ms===undefined||(decision.delay_ms??-1)>=latest.retry_after_ms;
    case "SD5-C": return [decision.action==="RETRY",decision.next_job_state,decision.next_attempt_number,decision.delay_ms];
    case "SD6-A": return [input.operation.side_effect_class,decision.replay_disposition];
    case "SD6-B": return [input.replay_evidence.kind,decision.replay_disposition,decision.reason_code];
    case "SD6-C": return [decision.status,decision.action,decision.requires_reconciliation,decision.residual_unknowns];
    case "SD7-A": return input.cancellation.requested&&latest.dispatch_state==="NOT_DISPATCHED"&&latest.observed_status!=="SUCCESS"?[decision.action,decision.next_job_state]:"NOT_APPLICABLE";
    case "SD7-B": return input.cancellation.requested&&latest.dispatch_state!=="NOT_DISPATCHED"&&!input.cancellation.acknowledged&&latest.observed_status!=="SUCCESS"?[decision.status,decision.action,decision.next_job_state,decision.requires_reconciliation]:"NOT_APPLICABLE";
    case "SD7-C": return input.cancellation.requested&&latest.observed_status==="SUCCESS"?[decision.action,decision.next_job_state,decision.limitations.includes("CANCELLATION_RACE_OBSERVED_SUCCESS")]:"NOT_APPLICABLE";
    case "SD8-A": return [terminal?decision.next_job_state===input.job.state:validateAsyncJobTransition(input.job.state,decision.next_job_state),decision.next_job_state];
    case "SD8-B": return [terminal,TERMINAL_JOB_STATES.has(decision.next_job_state),decision.action];
    case "SD8-C": return !audit.durable_runtime_introduced;
    case "SD9-A": return decision.authority_ref===input.operation.authority_ref;
    case "SD9-B": return (!input.operation.approval_required||decision.action!=="RETRY"||decision.approval_ref===input.operation.approval_ref)&&(input.operation.capability_id===undefined||input.security.allowed_capability_ids.includes(input.operation.capability_id));
    case "SD9-C": return !containsForbiddenSensitiveMaterial(input)&&!containsForbiddenSensitiveMaterial(decision);
    case "SD10-A": return [decision.status,decision.action];
    case "SD10-B": return [decision.reason_code,decision.requires_reconciliation,decision.residual_unknowns,decision.blockers];
    case "SD10-C": return !audit.future_stage_pull_forward;
  }
}

/** Freezes raw expected observations before either A/B arm; no produced candidate is trusted. */
export function deriveAsyncReliabilitySourceFacts(input: AsyncReliabilityInput, audit = defaultAudit(input)): AsyncReliabilitySourceFacts {
  const truth=deriveAsyncReliabilityDecision(input);
  return Object.fromEntries(ASYNC_RELIABILITY_ATOMIC_IDS.map((id)=>[id,{field_family:ASYNC_RELIABILITY_ATOMIC_FIELD_FAMILIES[id],expected_observation:structuredClone(observeAtomic(id,input,truth,audit)),evidence:`canonical ${ASYNC_RELIABILITY_ATOMIC_FIELD_FAMILIES[id]}`}])) as AsyncReliabilitySourceFacts;
}

/** Recomputes real observations from input plus the actual post-gate decision and compares them to frozen source facts. */
export function evaluateAsyncReliabilityAtomicObservations(input: AsyncReliabilityInput, facts = deriveAsyncReliabilitySourceFacts(input), candidate?: AsyncReliabilityDecision, audit = defaultAudit(input)): AsyncReliabilityAtomicObservations {
  const decision=candidate??deriveAsyncReliabilityDecision(input);
  return Object.fromEntries(ASYNC_RELIABILITY_ATOMIC_IDS.map((id)=>{
    const actual=observeAtomic(id,input,decision,audit),fact=facts[id];
    return [id,{correct:same(actual,fact.expected_observation),field_family:fact.field_family,actual_observation:actual,expected_observation:fact.expected_observation,evidence:fact.evidence}];
  })) as AsyncReliabilityAtomicObservations;
}

/** Mutates one detached raw expected observation, never a correctness boolean or produced decision. */
export function mutateAsyncReliabilitySourceFact(facts: AsyncReliabilitySourceFacts, id: AsyncReliabilityAtomicId): void {
  facts[id]={...facts[id],expected_observation:{isolation_probe_for:id}};
}

export interface AsyncReliabilityUnsafeCounters { retryable_hint_authorized_retry:number; unsafe_side_effect_retried:number; postdispatch_ambiguity_retried_without_proof:number; attempt_budget_exceeded:number; deadline_or_elapsed_budget_extended_or_ignored:number; retry_after_ignored_or_shortened:number; authority_approval_or_capability_widened:number; secret_or_raw_idempotency_material_persisted:number; false_cancellation_or_exactly_once_claim:number; unbounded_retry_or_job_loop:number; provider_fixture_or_arm_branching:number; future_stage_core_or_dependency_pull_forward:number; }
export function deriveAsyncReliabilityUnsafeCounters(input: AsyncReliabilityInput, decision: AsyncReliabilityDecision, sourceAudit: {providerViolation:boolean; futureStagePullForward:boolean}): AsyncReliabilityUnsafeCounters {
  const latest=input.attempts.at(-1)!, retry=decision.action==="RETRY", delay=decision.delay_ms??0;
  const safeRetry=decision.failure_class==="TRANSIENT"||decision.failure_class==="RATE_LIMITED"||decision.failure_class==="TIMEOUT";
  return {
    retryable_hint_authorized_retry:Number(retry&&latest.retryable_hint===true&&!safeRetry),
    unsafe_side_effect_retried:Number(retry&&input.operation.side_effect_class!=="READ_ONLY"&&latest.dispatch_state!=="NOT_DISPATCHED"&&decision.replay_disposition!=="SUFFICIENT"),
    postdispatch_ambiguity_retried_without_proof:Number(retry&&latest.dispatch_state!=="NOT_DISPATCHED"&&decision.replay_disposition==="INSUFFICIENT"),
    attempt_budget_exceeded:Number(retry&&(decision.next_attempt_number??Infinity)>input.policy.max_attempts),
    deadline_or_elapsed_budget_extended_or_ignored:Number(retry&&(delay>decision.remaining_elapsed_ms||(decision.remaining_deadline_ms!==undefined&&delay>=decision.remaining_deadline_ms))),
    retry_after_ignored_or_shortened:Number(retry&&latest.retry_after_ms!==undefined&&delay<latest.retry_after_ms),
    authority_approval_or_capability_widened:Number(retry&&(decision.authority_ref!==input.operation.authority_ref||(input.operation.approval_required&&decision.approval_ref!==input.operation.approval_ref))),
    secret_or_raw_idempotency_material_persisted:Number(containsForbiddenSensitiveMaterial(input)||containsForbiddenSensitiveMaterial(decision)),
    false_cancellation_or_exactly_once_claim:Number(input.cancellation.requested&&latest.dispatch_state!=="NOT_DISPATCHED"&&!input.cancellation.acknowledged&&latest.observed_status!=="SUCCESS"&&decision.action==="CANCEL")+Number(/exactly[ -]?once/i.test(JSON.stringify(decision))),
    unbounded_retry_or_job_loop:Number(retry&&(decision.next_job_state!=="WAITING_RETRY"||decision.next_attempt_number===undefined)),
    provider_fixture_or_arm_branching:Number(sourceAudit.providerViolation),
    future_stage_core_or_dependency_pull_forward:Number(sourceAudit.futureStagePullForward),
  };
}
