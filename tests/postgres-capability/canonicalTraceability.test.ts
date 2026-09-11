import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { describe,expect,it } from "vitest";
import { counters } from "./audit.js";
import { hardInvariantIds,negativeFixtureIds,positiveFixtureIds,unsafeCounterIds } from "./canonicalCases.js";
const contract=load(readFileSync("brain-bootstrap/quality-contracts/S14H_POSTGRES_INSPECT_CAPABILITY_DEEP.yaml","utf8")) as any;
describe("S14H canonical traceability oracle",()=>{
 it("proves exact canonical ID-set equality",()=>{const executable=["positiveFixtures.test.ts","negativeFixtures.test.ts","hardInvariants.test.ts","audit.ts"].map(f=>readFileSync(`tests/postgres-capability/${f}`,"utf8")).join("\n");const found=(re:RegExp)=>[...new Set(executable.match(re)??[])].sort();expect(found(/FX-POS-\d{3}/g)).toEqual([...positiveFixtureIds].sort());expect(found(/FX-NEG-\d{3}/g)).toEqual([...negativeFixtureIds].sort());expect(found(/S14H-HI-\d{3}/g)).toEqual([...hardInvariantIds].sort());expect(found(/UC\d{2}/g)).toEqual([...unsafeCounterIds].sort());expect(positiveFixtureIds).toEqual(contract.positive_fixtures.map((x:any)=>x.id));expect(negativeFixtureIds).toEqual(contract.negative_fixtures.map((x:any)=>x.id));expect(hardInvariantIds).toEqual(contract.hard_invariants.map((x:any)=>x.id));expect(unsafeCounterIds).toEqual(contract.unsafe_counters.map((x:any)=>x.id));expect(counters.map(c=>c.id)).toEqual(unsafeCounterIds);});
});
