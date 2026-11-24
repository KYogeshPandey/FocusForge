import '@testing-library/jest-dom';

// Polyfill/stub BroadcastChannel in jsdom test environment to prevent Node.js internal EventTarget conflicts
if (typeof window !== 'undefined') {
  class MockBroadcastChannel {
    name: string;
    onmessage: ((event: unknown) => void) | null = null;
    constructor(name: string) {
      this.name = name;
    }
    postMessage(_data: unknown) {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  }
  window.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;
  globalThis.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;
}
