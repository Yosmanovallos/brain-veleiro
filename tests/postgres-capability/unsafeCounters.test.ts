import { describe,expect,it } from "vitest";
import { counters,productionSources } from "./audit.js";
describe("S14H canonical unsafe counters",()=>{for(const c of counters)it(`${c.id}: ${c.name} is zero on legitimate production and independently fireable`,()=>{expect(c.detect(productionSources())).toBe(0);expect(c.detect(c.unsafe)).toBeGreaterThan(0);});});
