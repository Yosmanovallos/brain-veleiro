import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, vi } from "vitest";
import { chromium, type Browser } from "playwright-core";
import type { ToolInvocationRequest } from "../../src/core/agent/types.js";
import { BrowserInspectCapabilityProvider, LIMITS, PlaywrightChromiumFactory, SAFE_MESSAGES } from "../../src/providers/capability/browser/index.js";
import { positives as legacyPos, negatives as legacyNeg } from "./cases.js";
import { forbiddenConfigSurface, forbiddenSurface, futurePhaseSurface, hiddenRetrySurface, inferredScope, originEscapeSurface, closureClaims, productionCode, productionSources } from "./audit.js";
import { baseConfig, failCode, harness, latestContext, latestPage, output, request, restricted, TEST_ORIGIN, TEST_ORIGIN2, BROWSER_INSPECT } from "./helpers.js";
import { MATRIX_URL, ScriptedBrowserFactory, type Settle, type Step } from "./deadlineDoubles.js";
const snap=(links:Array<{text:string;url:string}>=[])=>[{role:"document",children:links.map(x=>({role:"link",name:x.text,url:x.url}))}];
const run=(h:ReturnType<typeof harness>,input:Record<string,unknown>,ms=5000)=>h.provider.invoke(request(input,ms));
const scripted=async(script:Partial<Record<Step,Settle>>,budget=50)=>{const factory=new ScriptedBrowserFactory(script);const provider=new BrowserInspectCapabilityProvider(baseConfig({max_timeout_ms:budget}),{browserFactory:factory});const result=await provider.invoke(request({url:MATRIX_URL},budget));return{factory,result};};
async function smoke(){const require=createRequire(import.meta.url);expect((require("playwright-core/package.json") as {version:string}).version).toBe("1.63.0");expect(existsSync(chromium.executablePath())).toBe(true);const spy=vi.spyOn(chromium,"launch");let raw:Browser|undefined;try{const browser=await new PlaywrightChromiumFactory().launch();raw=await(spy.mock.results[0].value as Promise<Browser>);expect(spy.mock.calls[0][0]).toEqual({headless:true,timeout:0});const context=await browser.newContext({serviceWorkers:"block",acceptDownloads:false});const rawContext=raw.contexts()[0];const requests:string[]=[];await context.route("**/*",async r=>{requests.push(r.request().url());await r.abort("blockedbyclient");});const page=await context.newPage();const rawPage=rawContext.pages()[0];await rawPage.setContent("<title>S14G smoke</title><main><h1>Brain browser smoke</h1></main>");expect(await page.title()).toBe("S14G smoke");expect(JSON.stringify(await page.ariaSnapshotJSON({mode:"default",boxes:false,depth:10,signal:new AbortController().signal,timeout:0}))).toContain("Brain browser smoke");expect(requests).toEqual([]);await page.close();await context.close();await browser.close();expect(rawPage.isClosed()).toBe(true);expect(raw.isConnected()).toBe(false);}finally{spy.mockRestore();if(raw?.isConnected())await raw.close();}}
export const positives:Record<string,()=>Promise<void>>={
"FX-POS-001":legacyPos["LEGACY-POS-001"],
"FX-POS-002":legacyPos["LEGACY-POS-002"],
"FX-POS-003":async()=>{await legacyPos["LEGACY-POS-003"]();const h=harness();h.factory.onNewPage=p=>p.setPage("Default",snap());output(await run(h,{url:TEST_ORIGIN+"/"}));},
"FX-POS-004":async()=>{const h=harness({config:{allowed_navigation_origins:[TEST_ORIGIN,TEST_ORIGIN2]}});h.factory.onNewPage=p=>{p.redirectTo=TEST_ORIGIN2+"/final?x=1#ok";p.setPage("Redirect",snap());};expect(output(await run(h,{url:TEST_ORIGIN+"/"})).final_url).toBe(TEST_ORIGIN2+"/final?x=1#ok");},
"FX-POS-005":legacyPos["LEGACY-POS-005"],
"FX-POS-006":legacyPos["LEGACY-POS-004"],
"FX-POS-007":async()=>{const origins=Array.from({length:LIMITS.requestOriginsMax},(_,i)=>`https://h${i}.example.com`),nav=origins.slice(0,LIMITS.navigationOriginsMax);const h=harness({config:{browser_id:"b".repeat(LIMITS.browserIdChars),allowed_navigation_origins:nav,allowed_request_origins:origins,max_timeout_ms:LIMITS.configTimeoutMs,snapshot_depth:LIMITS.snapshotDepthMax,max_snapshot_bytes:LIMITS.maxSnapshotBytesMax,max_links:LIMITS.maxLinksMax}});h.factory.onNewPage=p=>p.setPage("T".repeat(LIMITS.titleBytes),snap());expect(output(await run(h,{url:nav[0]+"/"},LIMITS.configTimeoutMs)).title).toHaveLength(LIMITS.titleBytes);},
"FX-POS-008":legacyPos["LEGACY-POS-007"],
"FX-POS-009":legacyPos["LEGACY-POS-008"],
"FX-POS-010":smoke};
export const negatives:Record<string,()=>Promise<void>>={
"FX-NEG-001":async()=>{for(const id of["LEGACY-NEG-001","LEGACY-NEG-002","LEGACY-NEG-004","LEGACY-NEG-005","LEGACY-NEG-006","LEGACY-NEG-007","LEGACY-NEG-008"])await legacyNeg[id]();},
"FX-NEG-002":legacyNeg["LEGACY-NEG-003"],
"FX-NEG-003":async()=>{for(const input of[{},{url:TEST_ORIGIN+"/",extra:1},{url:TEST_ORIGIN+"/",wait_until:"networkidle"}]){const h=harness();failCode(await run(h,input),"INVALID_INPUT",false);expect(h.factory.launches).toBe(0);}},
"FX-NEG-004":async()=>{const h=harness();for(const url of["http://qa.example.com/","file:///x","data:text/html,x","javascript:void(0)","blob:https://qa.example.com/x","about:blank","ftp://qa.example.com/","ws://qa.example.com/","wss://qa.example.com/","bad","https://u:p@qa.example.com/","https://evil.invalid/"])expect((await run(h,{url})).status).toBe("FAIL");expect(h.factory.launches).toBe(0);},
"FX-NEG-005":legacyNeg["LEGACY-NEG-014"],
"FX-NEG-006":async()=>{await legacyNeg["LEGACY-NEG-017"]();await legacyNeg["LEGACY-NEG-018"]();},
"FX-NEG-007":async()=>{const h=harness();h.factory.onNewPage=p=>{p.setPage("Block",snap());p.subresources=[{url:"https://evil.invalid/x"}];};output(await run(h,{url:TEST_ORIGIN+"/"}));expect(latestPage(h.factory).subresourceRequests[0].allowed).toBe(false);},
"FX-NEG-008":async()=>{const methods=["POST","PUT","PATCH","DELETE","CONNECT","OPTIONS","TRACE","PROPFIND"],h=harness();h.factory.onNewPage=p=>{p.setPage("Methods",snap());p.subresources=methods.map(method=>({url:TEST_ORIGIN2+"/api",method}));};output(await run(h,{url:TEST_ORIGIN+"/"}));expect(latestPage(h.factory).subresourceRequests.every(x=>!x.allowed)).toBe(true);},
"FX-NEG-009":async()=>{const h=harness();h.factory.onNewPage=p=>{p.setPage("WS",snap());p.wsOnContinue=["wss://qa.example.com/socket"];};output(await run(h,{url:TEST_ORIGIN+"/"}));const ws=latestContext(h.factory).wsConnections[0];expect(ws.closed).toBe(true);expect(ws.messages).toEqual([]);},
"FX-NEG-010":async()=>{const h=harness();h.factory.onNewPage=p=>p.setPage("SW",snap());output(await run(h,{url:TEST_ORIGIN+"/"}));expect(latestContext(h.factory).options.serviceWorkers).toBe("block");},
"FX-NEG-011":async()=>{await legacyNeg["LEGACY-NEG-021"]();const h=harness();h.factory.onNewPage=p=>{p.setPage("Popup",snap());p.pendingPopups=[TEST_ORIGIN+"/hidden"];};expect(await run(h,{url:TEST_ORIGIN+"/"})).not.toHaveProperty("output");expect(h.factory.pageCloseCount).toBe(2);},
"FX-NEG-012":legacyNeg["LEGACY-NEG-020"],
"FX-NEG-013":async()=>{for(const key of["evaluate","javascript","selector","action","playwright_command"]){const h=harness();failCode(await run(h,{url:TEST_ORIGIN+"/",[key]:"x"}),"INVALID_INPUT",false);expect(h.factory.launches).toBe(0);}},
"FX-NEG-014":legacyNeg["LEGACY-NEG-024"],
"FX-NEG-015":async()=>{for(const raw of["net::ERR_CERT_AUTHORITY_INVALID SECRET","net::ERR_NAME_NOT_RESOLVED SECRET","net::ERR_CONNECTION_REFUSED SECRET"]){const h=harness();h.factory.onNewPage=p=>{p.failOnGoto=new Error(raw);};const r=await run(h,{url:TEST_ORIGIN+"/"});expect(r).toMatchObject({status:"FAIL",error:{message:SAFE_MESSAGES.unavailable}});expect(JSON.stringify(r)).not.toContain("SECRET");}},
"FX-NEG-016":async()=>{const{factory,result}=await scripted({launch:{after_ms:120,outcome:"resolve"}},40);failCode(result,"TIMEOUT",true);await new Promise(r=>setTimeout(r,140));expect(factory.log).toContain("close:browser");expect(factory.log).not.toContain("newContext");},
"FX-NEG-017":async()=>{const{result}=await scripted({goto:"never"},40);failCode(result,"TIMEOUT",true);expect(result).not.toHaveProperty("output");},
"FX-NEG-018":async()=>{const{result}=await scripted({snapshot:"never"},40);failCode(result,"TIMEOUT",true);expect(result).not.toHaveProperty("output");},
"FX-NEG-019":async()=>{const{result}=await scripted({snapshot:{after_ms:120,outcome:"resolve"}},40),frozen=structuredClone(result);await new Promise(r=>setTimeout(r,140));expect(result).toEqual(frozen);},
"FX-NEG-020":async()=>{const{result,factory}=await scripted({"close:page":"never","close:context":"never","close:browser":"never"},50);expect(output(result).title).toBe("Deadline matrix");expect(factory.log).toEqual(expect.arrayContaining(["close:page","close:context","close:browser"]));},
"FX-NEG-021":legacyNeg["LEGACY-NEG-023"],
"FX-NEG-022":async()=>{const h=harness();h.factory.onNewPage=p=>{p.failOnGoto=new Error("<html>SECRET authorization console stack /private");};const r=await run(h,{url:TEST_ORIGIN+"/"});expect(r).toMatchObject({status:"FAIL",error:{message:SAFE_MESSAGES.internalError}});expect(JSON.stringify(r)).not.toContain("SECRET");},
"FX-NEG-023":async()=>{const h=harness(),r=await restricted(h.provider,[BROWSER_INSPECT],[]).invoke(request({url:TEST_ORIGIN+"/"}) as ToolInvocationRequest);expect(r.status).toBe("BLOCKED");expect(h.factory.launches).toBe(0);},
"FX-NEG-024":async()=>{const s=productionCode();expect(forbiddenSurface()).toBe(0);expect(forbiddenConfigSurface()).toEqual([]);expect(hiddenRetrySurface(s)+inferredScope(s)+originEscapeSurface(s)+futurePhaseSurface(s)).toBe(0);expect(forbiddenSurface(s+"\npage.evaluate('x'); storageState; connectOverCDP();")).toBeGreaterThan(0);expect(forbiddenConfigSurface(productionSources().replace("max_links: number;","max_links: number;\nproxy: string;"))).toContain("proxy");expect(futurePhaseSurface(s+"\nconst x='browser.navigate';")).toBeGreaterThan(0);expect(closureClaims("\nS14: CLOSED")).toBeGreaterThan(0);}};
export const positiveFixtureIds=Object.keys(positives),negativeFixtureIds=Object.keys(negatives);
