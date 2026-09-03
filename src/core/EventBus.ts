type ListenerMap = Map<string, Set<(payload: unknown) => void>>;

export default class EventBus {
  private listeners: ListenerMap = new Map();

  subscribe<T = unknown>(event: string, fn: (payload: T) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const wrapped = fn as (payload: unknown) => void;
    set.add(wrapped);
    return () => {
      set.delete(wrapped);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  emit<T = unknown>(event: string, payload?: T): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      fn(payload);
    }
  }

  once<T = unknown>(event: string, fn: (payload: T) => void): void {
    const unsub = this.subscribe<T>(event, (payload) => {
      fn(payload);
      unsub();
    });
  }

  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
