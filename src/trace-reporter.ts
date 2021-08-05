import { SocketClient } from "./socket-client";

export class TraceReporter {
  private disposed = false;
  private counters: { [key: string]: number } = {};
  private nextReportTime: number;
  private socketClient: SocketClient;

  public constructor(socketClient: SocketClient) {
    this.socketClient = socketClient;
  }

  public run(): void {
    this.generateNextReportTime();
    (async () => {
      let shouldRun = true;

      while (shouldRun) {
        await new Promise((r) => setTimeout(() => r(true), 1000));

        if (this.disposed) {
          shouldRun = false;
          return;
        }

        if (this.nextReportTime <= new Date().getTime()) {
          this.sendTraces(this.nextReportTime, this.counters);
          this.resetCounters();
          this.generateNextReportTime();
        }
      }
    })();
  }

  public dispose(): void {
    this.disposed = true;
  }

  public report(flagName: string): void {
    this.counters[flagName] = (this.counters[flagName] || 0) + 1;
  }

  private async sendTraces(
    timestamp: number,
    counters: { [key: string]: number }
  ): Promise<void> {
    for (const flagName in counters) {
      this.socketClient.send([
        "report_trace",
        flagName,
        timestamp,
        counters[flagName],
      ]);
    }
  }

  private resetCounters() {
    this.counters = {};
  }

  private generateNextReportTime() {
    const currentTimestamp = new Date().getTime();
    this.nextReportTime =
      currentTimestamp + 10_000 - (currentTimestamp % 10_000);
  }
}
