import { describe, expect, it } from "vitest";
import { productionSources } from "./audit.js";
type Counter={id:string;name:string;detect:(s:string)=>number;unsafe:string};
const count=(s:string,re:RegExp)=>(s.match(re)??[]).length;
const counters:Counter[]=[
{id:"UC01",name:"model_selected_engine_runtime_origin_policy_or_browser_config",detect:s=>count(s,/input\.(?:engine|channel|browser_config|allowed_origins)|modelSelectedEngine/g),unsafe:"input.engine; input.allowed_origins;"},
{id:"UC02",name:"non_https_unapproved_origin_or_forbidden_method_continued",detect:s=>count(s,/continueUnsafeRequest|allowHttpOrigin|continueForbiddenMethod/g),unsafe:"continueUnsafeRequest(); allowHttpOrigin();"},
{id:"UC03",name:"service_worker_websocket_popup_or_download_escape",detect:s=>count(s,/serviceWorkers:\s*[\"']allow|connectToServer\(|acceptDownloads:\s*true|allowPopupEscape/g),unsafe:"serviceWorkers:'allow'; connectToServer(); acceptDownloads:true;"},
{id:"UC04",name:"auth_cookie_storage_profile_or_credential_surface",detect:s=>count(s,/storageState|httpCredentials|\.cookies\(|persistentContext|userDataDir/g),unsafe:"storageState; httpCredentials; persistentContext();"},
{id:"UC05",name:"model_javascript_interaction_or_arbitrary_playwright_execution",detect:s=>count(s,/page\.evaluate\(|page\.click\(|input\.selector|arbitraryPlaywright/g),unsafe:"page.evaluate(input.javascript); page.click(input.selector);"},
{id:"UC06",name:"deadline_cleanup_or_orphan_browser_escape",detect:s=>count(s,/orphanBrowser|unboundedClose|deadlineBypass/g),unsafe:"orphanBrowser(); unboundedClose();"},
{id:"UC07",name:"raw_remote_or_playwright_secret_error_leak",detect:s=>count(s,/message:\s*(?:error|String\(error\))|error\.stack|rawPlaywrightError/g),unsafe:"return {message:error, stack:error.stack};"},
{id:"UC08",name:"snapshot_link_or_output_bound_bypass",detect:s=>count(s,/skipSnapshotBound|maxLinks\s*\+\s*1|outputBoundBypass/g),unsafe:"skipSnapshotBound(); links.slice(0,maxLinks+1);"},
{id:"UC09",name:"restricted_registry_or_provider_swap_boundary_bypass",detect:s=>count(s,/bypassRestricted|mutateAgentDefinition|skipRegistry/g),unsafe:"bypassRestricted(); mutateAgentDefinition();"},
{id:"UC10",name:"protected_dependency_future_phase_or_self_closure_drift",detect:s=>count(s,/from\s+[\"'](?:puppeteer|selenium)|browser\.navigate|S14G:\s*(?:PASS|CLOSED)|HI-054:\s*AWARDED/g),unsafe:"import x from 'puppeteer'; const y='browser.navigate'; S14G: CLOSED;"},
];
export const unsafeCounterIds=counters.map(c=>c.id);
describe("S14G canonical unsafe counters",()=>{for(const c of counters)it(`${c.id}: ${c.name} is zero and independently fireable`,()=>{expect(c.detect(productionSources())).toBe(0);expect(c.detect(c.unsafe)).toBeGreaterThan(0);});});
