interface Config {
  ttl: number;
}

export class CacheManager {
  private config: Config = {
    ttl: 1_000,
  };

  private store: { [key: string]: boolean | undefined } = {};

  constructor(config: Config) {
    this.config = config;
  }

  public add(key: string, value: boolean): void {
    this.store[key] = value;
    setTimeout(() => {
      this.clean(key);
    }, this.config.ttl);
  }

  public get(key: string): boolean | undefined {
    return this.store[key];
  }

  private clean(key: string) {
    this.store[key] = undefined;
  }
}
