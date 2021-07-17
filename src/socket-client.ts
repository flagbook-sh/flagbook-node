import WebSocket from "ws";

interface ISocketClientConfig {
  accessToken?: string;
  baseUrl: string;
  retryInterval: number;
  onMessage?: (message: any) => void;
}

export class SocketClient {
  private config: ISocketClientConfig = {
    baseUrl: `wss://socket.flagbook.sh/ws/`,
    retryInterval: 1000,
  };
  private ws: WebSocket;

  constructor({
    accessToken,
    onMessage,
  }: {
    accessToken: string;
    onMessage: (message: any) => void;
  }) {
    this.config.accessToken = accessToken;
    this.config.onMessage = onMessage;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.config.baseUrl + this.config.accessToken);
    this.ws.on("message", this.onMsg);
    this.ws.on("error", this.onError);
    this.ws.on("close", this.onClose);
  }

  onMsg = (data: string) => {
    const decodedMsg = JSON.parse(data);

    this.config.onMessage ? this.config.onMessage(decodedMsg) : undefined;
  };

  onError = (): void => {
    console.error(
      `[Flagbook] cannot establish the connection, retrying in ${this.config.retryInterval} ms...`
    );
  };

  onClose = async (): Promise<void> => {
    await new Promise((r) =>
      setTimeout(() => r(true), this.config.retryInterval)
    );
    this.connect();
  };

  encodeMsg(msg: any): string {
    return JSON.stringify(msg);
  }

  send(msg: any): void {
    if (this.ws.readyState !== this.ws.OPEN) {
      setTimeout(() => this.send(msg), 10);
      return;
    }
    const encodedMag = this.encodeMsg(msg);
    this.ws.send(encodedMag);
  }
}
