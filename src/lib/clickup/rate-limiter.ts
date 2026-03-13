export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;

  constructor(maxTokens = 90, refillIntervalMs = 60000) {
    this.tokens = maxTokens;
    this.maxTokens = maxTokens;
    this.refillRate = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(
      (elapsed / 60000) * this.refillRate
    );
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    const waitTime = Math.ceil(
      ((1 - this.tokens) / this.refillRate) * 60000
    );
    await new Promise((resolve) => setTimeout(resolve, Math.max(waitTime, 1000)));
    this.refill();
    this.tokens--;
  }

  remaining(): number {
    this.refill();
    return this.tokens;
  }
}
