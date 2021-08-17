import { CacheManager } from "./cache-manager";
import { SocketClient } from "./socket-client";
import { TraceReporter } from "./trace-reporter";

export interface Config {
  publicApiKey: string;
  cacheTTL: number;
  cacheEnabled: boolean;
  timeout: number;
}

type TagKey = string;
type TagValue = string | number | undefined | null | boolean;

export type Tag = [TagKey, TagValue];

type QueueItemRequest = ["get_flag_value", string, Tag[]];
type QueueItemResponse = ["ok", boolean] | ["error", string];

type QueueItem = [QueueItemRequest, QueueItemResponse | undefined];

type GetFlagValueResponseMsg = [
  ["get_flag_value", string, Tag[]],
  ["ok", boolean] | ["error", string]
];

export class FlagbookClient {
  private socketClient: SocketClient;
  private queue: QueueItem[] = [];
  private config: Config = {
    publicApiKey: "empty",
    cacheTTL: 10_000,
    cacheEnabled: true,
    timeout: 5_000,
  };
  private cacheManager: CacheManager;
  private traceReporter: TraceReporter;

  constructor(config: Partial<Config>) {
    this.config = {
      ...this.config,
      ...config,
    };

    this.cacheManager = new CacheManager({
      ttl: Number.isInteger(this.config.cacheTTL)
        ? this.config.cacheTTL
        : 1_000,
    });

    if (this.config.publicApiKey) {
      this.socketClient = new SocketClient({
        publicApiKey: this.config.publicApiKey,
        onMessage: this.onMessage,
      });
      this.traceReporter = new TraceReporter(this.socketClient);
      this.traceReporter.run();
    }
  }

  public async getFlagValue(name: string, tags: Tag[] = []): Promise<boolean> {
    if (!this.config.publicApiKey || this.config.publicApiKey === "empty") {
      throw new Error(`Cannot read flag, reason: publicApiKey not provided`);
    }

    this.traceReporter.report(name);

    if (this.config.cacheEnabled) {
      const cachedValue = this.cacheManager.get([name, tags].toString());
      if (cachedValue !== undefined) {
        return cachedValue;
      }
    }

    const request: QueueItemRequest = ["get_flag_value", name, tags];
    this.enqueueRequest(request);
    const resultPromise = this.waitForResponse(request);
    this.socketClient.send(["get_flag_value", name, tags]);
    const result = await resultPromise;

    if (result && result[0] === "ok") {
      if (this.config.cacheEnabled) {
        this.cacheManager.add([name, tags].toString(), result[1]);
      }

      return result[1];
    } else {
      throw new Error(`Cannot read flag, reason: ${result && result[1]}`);
    }
  }

  private enqueueRequest(request: QueueItemRequest) {
    this.queue.push([request, undefined]);
  }

  private async waitForResponse(
    request: QueueItemRequest,
    start: number = new Date().getTime()
  ): Promise<QueueItemResponse | undefined> {
    if (new Date().getTime() - start > this.config.timeout) {
      this.removeRequestFromQueue(request);
    }

    const queueItem = this.findEnqueuedRequest(request);

    if (!queueItem) return ["error", "timeout"];

    const [_, response] = queueItem;

    if (!response) {
      await new Promise((r) => setTimeout(() => r(true), 10));
      return this.waitForResponse(request, start);
    }

    this.removeRequestFromQueue(request);

    return response;
  }

  private onMessage = (msg: GetFlagValueResponseMsg) => {
    if (msg[0][0] === "get_flag_value") {
      const [request, response] = msg as GetFlagValueResponseMsg;
      this.removeRequestFromQueue(request);
      this.addResponseToRequestInQueue(request, response);
    }
  };

  private addResponseToRequestInQueue(
    request: QueueItemRequest,
    response: QueueItemResponse
  ): void {
    this.queue.push([request, response]);
  }

  private removeRequestFromQueue(request: QueueItemRequest): void {
    const index = this.findEnqueuedRequestIndex(request);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  private findEnqueuedRequest(
    request: QueueItemRequest
  ): QueueItem | undefined {
    return this.queue.find(
      (item) => item[0][0] === request[0] && item[0][1] === request[1]
    );
  }

  private findEnqueuedRequestIndex(request: QueueItemRequest): number {
    return this.queue.findIndex(
      (item) => item[0][0] === request[0] && item[0][1] === request[1]
    );
  }
}
