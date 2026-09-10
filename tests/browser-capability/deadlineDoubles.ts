import type {
  BrowserContextHandle,
  BrowserContextOptions,
  BrowserFactory,
  BrowserHandle,
  GotoOptions,
  PageHandle,
} from "../../src/providers/capability/browser/index.js";

type AriaSnapshotOptions = Parameters<PageHandle["ariaSnapshotJSON"]>[0];

/**
 * SR-G-004 — deterministic scripted browser doubles for the deadline/cleanup
 * matrix. Every operation settles according to a per-step script, measured from
 * the moment the provider calls it:
 *
 * - `"ok"`: resolves immediately;
 * - `"never"`: never settles and ignores every AbortSignal (a hung engine call);
 * - `{ after_ms, outcome }`: ignores abort, then resolves/rejects after `after_ms`
 *   (used both for slow-but-in-budget steps and for late completion past the deadline).
 *
 * The log records each call and each delayed settlement in order, so tests can
 * assert cleanup order and that late work never resurrects further steps.
 */

export type Settle = "ok" | "never" | { after_ms: number; outcome: "resolve" | "reject" };

export type Step =
  | "launch"
  | "newContext"
  | "newPage"
  | "route"
  | "routeWebSocket"
  | "goto"
  | "title"
  | "snapshot"
  | "close:page"
  | "close:context"
  | "close:browser";

export const MATRIX_URL = "https://qa.example.com/";
export const MATRIX_TITLE = "Deadline matrix";
export const MATRIX_SNAPSHOT = [
  { role: "main", children: [{ role: "heading", name: "Deadline matrix", level: 1 }, { role: "link", name: "Home", url: "/" }] },
];

export class ScriptedBrowserFactory implements BrowserFactory {
  readonly log: string[] = [];
  /** Every AbortSignal the provider handed to a signal-aware operation. */
  readonly signals: AbortSignal[] = [];

  constructor(private readonly script: Partial<Record<Step, Settle>> = {}) {}

  run<T>(step: Step, value: () => T): Promise<T> {
    this.log.push(step);
    const settle = this.script[step] ?? "ok";
    if (settle === "ok") return Promise.resolve(value());
    if (settle === "never") return new Promise<T>(() => undefined);
    return new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        if (settle.outcome === "resolve") {
          this.log.push(`${step}:settled`);
          resolve(value());
        } else {
          this.log.push(`${step}:rejected`);
          reject(new Error(`scripted ${step} failure`));
        }
      }, settle.after_ms);
    });
  }

  launch(): Promise<BrowserHandle> {
    return this.run("launch", () => new ScriptedBrowser(this));
  }
}

class ScriptedBrowser implements BrowserHandle {
  constructor(private readonly factory: ScriptedBrowserFactory) {}

  newContext(_options: BrowserContextOptions): Promise<BrowserContextHandle> {
    return this.factory.run("newContext", () => new ScriptedContext(this.factory));
  }

  close(): Promise<void> {
    return this.factory.run("close:browser", () => undefined);
  }
}

class ScriptedContext implements BrowserContextHandle {
  constructor(private readonly factory: ScriptedBrowserFactory) {}

  newPage(): Promise<PageHandle> {
    return this.factory.run("newPage", () => new ScriptedPage(this.factory));
  }

  route(): Promise<void> {
    return this.factory.run("route", () => undefined);
  }

  routeWebSocket(): Promise<void> {
    return this.factory.run("routeWebSocket", () => undefined);
  }

  onPage(): void {}

  close(): Promise<void> {
    return this.factory.run("close:context", () => undefined);
  }
}

class ScriptedPage implements PageHandle {
  private current = "about:blank";

  constructor(private readonly factory: ScriptedBrowserFactory) {}

  goto(url: string, options: GotoOptions): Promise<void> {
    this.factory.signals.push(options.signal);
    return this.factory.run("goto", () => {
      this.current = url;
    });
  }

  url(): string {
    return this.current;
  }

  title(): Promise<string> {
    return this.factory.run("title", () => MATRIX_TITLE);
  }

  ariaSnapshotJSON(options: AriaSnapshotOptions): Promise<unknown> {
    this.factory.signals.push(options.signal);
    return this.factory.run("snapshot", () => structuredClone(MATRIX_SNAPSHOT));
  }

  onDialog(): void {}

  onDownload(): void {}

  close(): Promise<void> {
    return this.factory.run("close:page", () => undefined);
  }
}
