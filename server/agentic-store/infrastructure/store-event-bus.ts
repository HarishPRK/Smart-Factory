import { EventEmitter } from "node:events";
import type {
  StoreEventEnvelope,
} from "../../../packages/agentic-store-contracts/src/index.js";

export type StoreEventListener = (event: StoreEventEnvelope<unknown>) => void;

export class StoreEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  publish(event: StoreEventEnvelope<unknown>): void {
    this.emitter.emit(event.storeId, event);
  }

  subscribe(storeId: string, listener: StoreEventListener): () => void {
    this.emitter.on(storeId, listener);
    return () => this.emitter.off(storeId, listener);
  }

  listenerCount(storeId: string): number {
    return this.emitter.listenerCount(storeId);
  }

  clear(): void {
    this.emitter.removeAllListeners();
  }
}
