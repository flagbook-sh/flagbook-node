import { Config, FlagbookClient } from "./flagbook-client";

global.flagbook = new FlagbookClient({ accessToken: undefined });

export class Flagbook {
  public static init(config: Config): void {
    global.flagbook = new FlagbookClient(config);
  }

  public static getFlagValue(name: string): Promise<boolean> {
    return global.flagbook.getFlagValue(name);
  }
}
