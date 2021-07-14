import { CacheManager } from "./cache-manager";
import { SocketClient } from "./socket-client";

export interface Config {
  accessToken?: string;
  cacheTTL: number;
  cacheEnabled: boolean;
}

type Tags = [];

type QueueItemRequest = ["get_flag_value", string, Tags];
type QueueItemResponse = ["ok", boolean] | ["error", string];

type QueueItem = [QueueItemRequest, QueueItemResponse | undefined];

type GetFlagValueResponseMsg = [
  ["get_flag_value", string, Tags],
  ["ok", boolean] | ["error", string]
];

export class FlagbookClient {
  private socketClient: SocketClient;
  private queue: QueueItem[] = [];
  private config: Config = {
    cacheTTL: 10_000,
    cacheEnabled: true,
  };
  private cacheManager: CacheManager;

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

    if (this.config.accessToken) {
      this.socketClient = new SocketClient({
        accessToken: this.config.accessToken,
        onMessage: this.onMessage,
      });
    }
  }

  public async getFlagValue(name: string): Promise<boolean> {
    if (!this.config.accessToken) {
      throw new Error(`Cannot read flag, reason: access token not provided`);
    }

    if (this.config.cacheEnabled) {
      const cachedValue = this.cacheManager.get([name, []].toString());
      if (cachedValue !== undefined) {
        return cachedValue;
      }
    }

    const request: QueueItemRequest = ["get_flag_value", name, []];
    this.enqueueRequest(request);
    const resultPromise = this.waitForResponse(request);
    this.socketClient.send(["get_flag_value", name, []]);
    const result = await resultPromise;

    if (result && result[0] === "ok") {
      if (this.config.cacheEnabled) {
        this.cacheManager.add([name, []].toString(), result[1]);
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
    request: QueueItemRequest
  ): Promise<QueueItemResponse | undefined> {
    const queueItem = this.findEnqueuedRequest(request);

    if (!queueItem) return;

    const [_, response] = queueItem;

    if (!response) {
      await new Promise((r) => setTimeout(() => r(true), 10));
      return this.waitForResponse(request);
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

  findEnqueuedRequest(request: QueueItemRequest): QueueItem | undefined {
    return this.queue.find(
      (item) => item[0][0] === request[0] && item[0][1] === request[1]
    );
  }

  findEnqueuedRequestIndex(request: QueueItemRequest): number {
    return this.queue.findIndex(
      (item) => item[0][0] === request[0] && item[0][1] === request[1]
    );
  }
}
