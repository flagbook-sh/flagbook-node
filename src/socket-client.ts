import WebSocket from "ws";

interface ISocketClientConfig {
  accessToken?: string;
  baseUrl: string;
  pingInterval: number;
  retryInterval: number;
  onMessage?: (message: any) => void;
}

export class SocketClient {
  private config: ISocketClientConfig = {
    baseUrl: `wss://socket.flagbook.sh/ws/`,
    pingInterval: 5000,
    retryInterval: 1000,
  };
  private ws: WebSocket;
  private interval: any;

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
    this.ws.on("open", this.onOpen);
    this.ws.on("message", this.onMsg);
    this.ws.on("error", this.onError);
    this.ws.on("close", this.onClose);
  }

  onOpen = () => {
    this.ws.ping();
    this.interval = setInterval(() => this.ws.ping(), this.config.pingInterval);
  };

  onMsg = (data: string) => {
    const decodedMsg = JSON.parse(data);

    this.config.onMessage ? this.config.onMessage(decodedMsg) : undefined;
  };

  onError = () => {
    console.error(
      `[Flagbook] cannot establish the connection, retrying in ${this.config.retryInterval} ms...`
    );
  };

  onClose = async () => {
    this.interval = null;
    await new Promise((r) =>
      setTimeout(() => r(true), this.config.retryInterval)
    );
    this.connect();
  };

  encodeMsg(msg: any) {
    return JSON.stringify(msg);
  }

  send(msg: any) {
    if (this.ws.readyState !== this.ws.OPEN) {
      return setTimeout(() => this.send(msg), 10);
    }
    const encodedMag = this.encodeMsg(msg);
    this.ws.send(encodedMag);
  }
}
