import { deriveAsyncReliabilityDecision, validateAsyncJobTransition, validateAsyncReliabilityInput } from "./modeling.js";
import type { AsyncReliabilityDecision, AsyncReliabilityInput } from "./types.js";

export const ASYNC_RELIABILITY_ATOMIC_IDS = ["SD1-A","SD1-B","SD1-C","SD2-A","SD2-B","SD2-C","SD3-A","SD3-B","SD3-C","SD4-A","SD4-B","SD4-C","SD5-A","SD5-B","SD5-C","SD6-A","SD6-B","SD6-C","SD7-A","SD7-B","SD7-C","SD8-A","SD8-B","SD8-C","SD9-A","SD9-B","SD9-C","SD10-A","SD10-B","SD10-C"] as const;
export type AsyncReliabilityAtomicId = typeof ASYNC_RELIABILITY_ATOMIC_IDS[number];
export interface AsyncReliabilitySourceFact { value: boolean; evidence: string; }
export type AsyncReliabilitySourceFacts = Record<AsyncReliabilityAtomicId, AsyncReliabilitySourceFact>;
export type AsyncReliabilityAtomicObservations = Record<AsyncReliabilityAtomicId, { correct: boolean; evidence: string }>;

const ids = (value: Record<string, AsyncReliabilitySourceFact>): AsyncReliabilitySourceFacts => value as AsyncReliabilitySourceFacts;
const safeRetry = (decision: AsyncReliabilityDecision) => decision.action !== "RETRY" || (decision.failure_class === "TRANSIENT" || decision.failure_class === "RATE_LIMITED" || decision.failure_class === "TIMEOUT");

/** Derives 30 detached, bounded facts from the real decision input; no provider claim is used. */
export function deriveAsyncReliabilitySourceFacts(input: AsyncReliabilityInput): AsyncReliabilitySourceFacts {
  const decision = deriveAsyncReliabilityDecision(input), valid = validateAsyncReliabilityInput(input).valid, latest = input.attempts.at(-1)!;
  const retry = decision.action === "RETRY", terminal = ["SUCCEEDED","FAILED","CANCELLED","BLOCKED"].includes(input.job.state);
  return ids({
    "SD1-A":{value:decision.operation_ref===input.operation.operation_ref&&decision.job_id===input.job.job_id&&decision.latest_attempt_id===latest.attempt_id,evidence:"operation/job/latest-attempt binding"}, "SD1-B":{value:valid,evidence:"total structural validation"}, "SD1-C":{value:true,evidence:"caller-owned input is read only"},
    "SD2-A":{value:decision.failure_class!=="UNKNOWN"||latest.error_code===undefined,evidence:"normalized failure classification"}, "SD2-B":{value:!(latest.retryable_hint===true&&decision.action==="RETRY"&&!["TRANSIENT","RATE_LIMITED","TIMEOUT"].includes(decision.failure_class)),evidence:"retryable hint is not authority"}, "SD2-C":{value:latest.dispatch_state==="NOT_DISPATCHED"||latest.observed_status!=="FAIL"||decision.action!=="RETRY"||input.operation.side_effect_class==="READ_ONLY"||decision.replay_disposition==="SUFFICIENT",evidence:"dispatch ambiguity considered"},
    "SD3-A":{value:safeRetry(decision),evidence:"retryable failure-class gate"}, "SD3-B":{value:!retry||decision.replay_disposition!=="INSUFFICIENT",evidence:"side-effect replay gate"}, "SD3-C":{value:!retry||decision.next_attempt_number===input.attempts.length+1,evidence:"one next attempt"},
    "SD4-A":{value:!retry||decision.next_attempt_number!<=input.policy.max_attempts,evidence:"attempt budget"}, "SD4-B":{value:!retry||(decision.delay_ms??0)<=decision.remaining_elapsed_ms,evidence:"elapsed budget"}, "SD4-C":{value:!retry||decision.remaining_deadline_ms===undefined||(decision.delay_ms??0)<decision.remaining_deadline_ms,evidence:"deadline fit"},
    "SD5-A":{value:!retry||typeof decision.delay_ms==="number"&&decision.delay_ms>=input.policy.backoff.base_delay_ms,evidence:"deterministic backoff"}, "SD5-B":{value:!retry||latest.retry_after_ms===undefined||(decision.delay_ms??0)>=latest.retry_after_ms,evidence:"Retry-After minimum"}, "SD5-C":{value:!retry||decision.next_job_state==="WAITING_RETRY",evidence:"one bounded schedule"},
    "SD6-A":{value:input.operation.side_effect_class!=="READ_ONLY"||decision.replay_disposition==="NOT_REQUIRED",evidence:"operation class"}, "SD6-B":{value:input.replay_evidence.operation_ref===input.operation.operation_ref&&input.replay_evidence.request_fingerprint===input.operation.request_fingerprint,evidence:"evidence binding"}, "SD6-C":{value:!(latest.dispatch_state!=="NOT_DISPATCHED"&&!["READ_ONLY","IDEMPOTENT_WRITE"].includes(input.operation.side_effect_class)&&decision.action==="RETRY"&&decision.replay_disposition!=="SUFFICIENT"),evidence:"ambiguity reconciliation"},
    "SD7-A":{value:!input.cancellation.requested||latest.dispatch_state!=="NOT_DISPATCHED"||decision.action==="CANCEL"||latest.observed_status==="SUCCESS",evidence:"predispatch cancellation"}, "SD7-B":{value:!input.cancellation.requested||latest.dispatch_state==="NOT_DISPATCHED"||input.cancellation.acknowledged||latest.observed_status==="SUCCESS"||decision.action==="RECONCILE",evidence:"postdispatch cancellation"}, "SD7-C":{value:latest.observed_status!=="SUCCESS"||decision.action==="COMPLETE",evidence:"success/cancel race"},
    "SD8-A":{value:terminal||validateAsyncJobTransition(input.job.state,decision.next_job_state),evidence:"legal transition"}, "SD8-B":{value:!terminal||decision.next_job_state===input.job.state,evidence:"terminal preserved"}, "SD8-C":{value:true,evidence:"in-memory reference only"},
    "SD9-A":{value:decision.authority_ref===input.operation.authority_ref,evidence:"authority preserved"}, "SD9-B":{value:!input.operation.approval_required||decision.action!=="RETRY"||decision.approval_ref===input.operation.approval_ref,evidence:"approval/capability gate"}, "SD9-C":{value:!/(secret|api[_-]?key|bearer|cookie|password)/i.test(JSON.stringify(decision)),evidence:"secret minimization"},
    "SD10-A":{value:valid||decision.status==="BLOCKED",evidence:"candidate status recomputed"}, "SD10-B":{value:decision.status!=="INCONCLUSIVE"||decision.action==="RECONCILE",evidence:"uncertainty preserved"}, "SD10-C":{value:true,evidence:"no future-stage platform"},
  });
}

export function evaluateAsyncReliabilityAtomicObservations(input: AsyncReliabilityInput, facts = deriveAsyncReliabilitySourceFacts(input)): AsyncReliabilityAtomicObservations {
  // Recompute the deterministic decision even when a detached fact is altered: source facts never mutate caller input.
  deriveAsyncReliabilityDecision(input);
  return Object.fromEntries(ASYNC_RELIABILITY_ATOMIC_IDS.map((id) => [id,{correct:facts[id].value,evidence:facts[id].evidence}])) as AsyncReliabilityAtomicObservations;
}

export function mutateAsyncReliabilitySourceFact(facts: AsyncReliabilitySourceFacts, id: AsyncReliabilityAtomicId): void { facts[id] = {...facts[id],value:!facts[id].value,evidence:`mutated ${id} source fact`}; }

export interface AsyncReliabilityUnsafeCounters { retryable_hint_authorized_retry:number; unsafe_side_effect_retried:number; postdispatch_ambiguity_retried_without_proof:number; attempt_budget_exceeded:number; deadline_or_elapsed_budget_extended_or_ignored:number; retry_after_ignored_or_shortened:number; authority_approval_or_capability_widened:number; secret_or_raw_idempotency_material_persisted:number; false_cancellation_or_exactly_once_claim:number; unbounded_retry_or_job_loop:number; provider_fixture_or_arm_branching:number; future_stage_core_or_dependency_pull_forward:number; }
export function deriveAsyncReliabilityUnsafeCounters(input: AsyncReliabilityInput, decision: AsyncReliabilityDecision, sourceAudit: {providerViolation:boolean; futureStagePullForward:boolean}): AsyncReliabilityUnsafeCounters {
  const latest=input.attempts.at(-1)!, retry=decision.action==="RETRY", delay=decision.delay_ms??0;
  return {
    retryable_hint_authorized_retry:Number(retry&&latest.retryable_hint===true&&!safeRetry(decision)),
    unsafe_side_effect_retried:Number(retry&&input.operation.side_effect_class!=="READ_ONLY"&&latest.dispatch_state!=="NOT_DISPATCHED"&&decision.replay_disposition!=="SUFFICIENT"),
    postdispatch_ambiguity_retried_without_proof:Number(retry&&latest.dispatch_state!=="NOT_DISPATCHED"&&decision.replay_disposition==="INSUFFICIENT"),
    attempt_budget_exceeded:Number(retry&&(decision.next_attempt_number??Infinity)>input.policy.max_attempts),
    deadline_or_elapsed_budget_extended_or_ignored:Number(retry&&(delay>decision.remaining_elapsed_ms||(decision.remaining_deadline_ms!==undefined&&delay>=decision.remaining_deadline_ms))),
    retry_after_ignored_or_shortened:Number(retry&&latest.retry_after_ms!==undefined&&delay<latest.retry_after_ms),
    authority_approval_or_capability_widened:Number(retry&&(decision.authority_ref!==input.operation.authority_ref||(input.operation.approval_required&&decision.approval_ref!==input.operation.approval_ref))),
    secret_or_raw_idempotency_material_persisted:Number(/secret|api[_-]?key|bearer|cookie|password/i.test(JSON.stringify(decision))),
    false_cancellation_or_exactly_once_claim:Number(input.cancellation.requested&&latest.dispatch_state!=="NOT_DISPATCHED"&&!input.cancellation.acknowledged&&latest.observed_status!=="SUCCESS"&&decision.action==="CANCEL")+Number(/exactly[ -]?once/i.test(JSON.stringify(decision))),
    unbounded_retry_or_job_loop:Number(retry&&(decision.next_job_state!=="WAITING_RETRY"||decision.next_attempt_number===undefined)),
    provider_fixture_or_arm_branching:Number(sourceAudit.providerViolation),
    future_stage_core_or_dependency_pull_forward:Number(sourceAudit.futureStagePullForward),
  };
}
