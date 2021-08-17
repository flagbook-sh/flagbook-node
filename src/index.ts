import { Config, FlagbookClient, Tag } from "./flagbook-client";

global.flagbook = new FlagbookClient({ publicApiKey: undefined });

export class Flagbook {
  public static init(config: Partial<Config>): void {
    global.flagbook = new FlagbookClient(config);
  }

  public static getFlagValue(name: string, tags: Tag[] = []): Promise<boolean> {
    return global.flagbook.getFlagValue(name, tags);
  }
}
