import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import { positiveFixtureIds, negativeFixtureIds } from "./canonicalCases.js";
type Item={id:string};
type Contract={positive_fixtures:Item[];negative_fixtures:Item[];hard_invariants:Item[];unsafe_counters:Item[]};
const contract=load(readFileSync("brain-bootstrap/quality-contracts/S14G_BROWSER_CAPABILITY_DEEP.yaml","utf8")) as Contract;
const ids=(items:Item[])=>items.map(x=>x.id);
const exact=(actual:string[],expected:string[])=>{expect(actual).toHaveLength(new Set(actual).size);expect([...actual].sort()).toEqual([...expected].sort());};
const sourceIds=(path:string,re:RegExp)=>[...readFileSync(path,"utf8").matchAll(re)].map(m=>m[1]);
describe("S14G canonical traceability inventory",()=>{
it("canonical inventory has exact POS, NEG, HI and UC set equality with Part A",()=>{
exact(positiveFixtureIds,ids(contract.positive_fixtures));
exact(negativeFixtureIds,ids(contract.negative_fixtures));
exact(sourceIds("tests/browser-capability/hardInvariants.test.ts",/\["(S14G-HI-\d{3})"/g),ids(contract.hard_invariants));
exact(sourceIds("tests/browser-capability/unsafeCounters.test.ts",/id:"(UC\d{2})"/g),ids(contract.unsafe_counters));
expect([positiveFixtureIds.length,negativeFixtureIds.length,contract.hard_invariants.length,contract.unsafe_counters.length]).toEqual([10,24,30,10]);
});
it("canonical executable registrars derive test names from exact mapping IDs",()=>{
expect(readFileSync("tests/browser-capability/browserCapability.test.ts","utf8")).toContain("it(id, fn)");
expect(readFileSync("tests/browser-capability/hardInvariants.test.ts","utf8")).toContain("for(const[id,name,check]of checks)");
expect(readFileSync("tests/browser-capability/unsafeCounters.test.ts","utf8")).toContain("for(const c of counters)");
});
});
