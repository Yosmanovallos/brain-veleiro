/**
 * S14G — Playwright-managed Chromium factory.
 *
 * Launches a fresh headless Chromium for every invocation, creates one
 * non-persistent context with `serviceWorkers: 'block'`, and exposes the
 * provider's narrow `BrowserHandle` seam.
 */

import { chromium } from "playwright-core";
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Dialog,
  Download,
  Frame,
  Page,
  Request as PlaywrightRequest,
  Route as PlaywrightRoute,
  WebSocketRoute as PlaywrightWebSocketRoute,
} from "playwright-core";
import type {
  AriaSnapshotOptions,
  BrowserContextHandle,
  BrowserContextOptions as S14GContextOptions,
  BrowserFactory,
  BrowserHandle,
  DialogHandle,
  DownloadHandle,
  GotoOptions,
  PageHandle,
  Route,
  RouteFrame,
  RouteHandler,
  RouteRequest,
  WebSocketRoute,
  WebSocketRouteHandler,
} from "./types.js";

export class PlaywrightChromiumFactory implements BrowserFactory {
  async launch(): Promise<BrowserHandle> {
    const browser = await chromium.launch({ headless: true, timeout: 0 });
    return new PlaywrightBrowserHandle(browser);
  }
}

class PlaywrightBrowserHandle implements BrowserHandle {
  constructor(private readonly browser: Browser) {}

  async newContext(options: S14GContextOptions): Promise<BrowserContextHandle> {
    const ctxOptions: BrowserContextOptions = {
      serviceWorkers: options.serviceWorkers,
      acceptDownloads: options.acceptDownloads,
    };
    const context = await this.browser.newContext(ctxOptions);
    return new PlaywrightBrowserContextHandle(context);
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}

/**
 * Exported only so tests can drive the real adapter against a structural
 * BrowserContext double; it is not part of the provider's public index.
 */
export class PlaywrightBrowserContextHandle implements BrowserContextHandle {
  constructor(private readonly context: BrowserContext) {}

  async newPage(): Promise<PageHandle> {
    const page = await this.context.newPage();
    return new PlaywrightPageHandle(page);
  }

  // Both route callbacks RETURN the provider handler's Promise so Playwright
  // tracks its completion and observes a rejection instead of orphaning it.
  async route(pattern: string | RegExp, handler: RouteHandler): Promise<void> {
    await this.context.route(pattern, (pwRoute: PlaywrightRoute) => {
      const request = pwRoute.request();
      return handler(new PlaywrightRouteAdapter(pwRoute, request));
    });
  }

  async routeWebSocket(pattern: string | RegExp, handler: WebSocketRouteHandler): Promise<void> {
    await this.context.routeWebSocket(pattern, (ws: PlaywrightWebSocketRoute) => {
      return handler(new PlaywrightWebSocketRouteAdapter(ws));
    });
  }

  onPage(handler: (page: PageHandle) => void): void {
    this.context.on("page", (page: Page) => {
      handler(new PlaywrightPageHandle(page));
    });
  }

  async close(): Promise<void> {
    await this.context.close();
  }
}

class PlaywrightPageHandle implements PageHandle {
  constructor(private readonly page: Page) {}

  async goto(url: string, options: GotoOptions): Promise<void> {
    await this.page.goto(url, options);
  }

  url(): string {
    return this.page.url();
  }

  title(): Promise<string> {
    return this.page.title();
  }

  async ariaSnapshotJSON(options: AriaSnapshotOptions): Promise<unknown> {
    return this.page.ariaSnapshotJSON(options);
  }

  onDialog(handler: (dialog: DialogHandle) => void): void {
    this.page.on("dialog", (dialog: Dialog) => {
      handler(new PlaywrightDialogHandle(dialog));
    });
  }

  onDownload(handler: (download: DownloadHandle) => void): void {
    this.page.on("download", (download: Download) => {
      handler(new PlaywrightDownloadHandle(download));
    });
  }

  async close(): Promise<void> {
    await this.page.close();
  }
}

class PlaywrightRouteAdapter implements Route {
  constructor(
    private readonly route: PlaywrightRoute,
    private readonly req: PlaywrightRequest,
  ) {}

  request(): RouteRequest {
    return new PlaywrightRouteRequest(this.req);
  }

  async abort(errorCode?: string): Promise<void> {
    await this.route.abort(errorCode);
  }

  async continue(): Promise<void> {
    await this.route.continue();
  }
}

class PlaywrightRouteRequest implements RouteRequest {
  constructor(private readonly request: PlaywrightRequest) {}

  method(): string {
    return this.request.method();
  }

  url(): string {
    return this.request.url();
  }

  isNavigationRequest(): boolean {
    return this.request.isNavigationRequest();
  }

  frame(): RouteFrame | null {
    const frame = this.request.frame();
    if (!frame) return null;
    return new PlaywrightRouteFrame(frame);
  }
}

class PlaywrightRouteFrame implements RouteFrame {
  constructor(private readonly frame: Frame) {}

  parentFrame(): RouteFrame | null {
    const parent = this.frame.parentFrame();
    if (!parent) return null;
    return new PlaywrightRouteFrame(parent);
  }
}

class PlaywrightWebSocketRouteAdapter implements WebSocketRoute {
  constructor(private readonly ws: PlaywrightWebSocketRoute) {}

  url(): string {
    return this.ws.url();
  }

  onMessage(handler: (message: string | Uint8Array) => unknown): void {
    this.ws.onMessage((message: string | Buffer) => {
      const copy: string | Uint8Array = Buffer.isBuffer(message) ? new Uint8Array(message) : message;
      handler(copy);
    });
  }

  async close(options?: { code?: number; reason?: string }): Promise<void> {
    await this.ws.close(options);
  }
}

class PlaywrightDialogHandle implements DialogHandle {
  constructor(private readonly dialog: Dialog) {}

  async dismiss(): Promise<void> {
    await this.dialog.dismiss();
  }
}

class PlaywrightDownloadHandle implements DownloadHandle {
  constructor(private readonly download: Download) {}

  async cancel(): Promise<void> {
    await this.download.cancel();
  }
}
