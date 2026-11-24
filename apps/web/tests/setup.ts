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

  class MockAudioNode {
    connect() {}
    disconnect() {}
  }

  class MockGainNode extends MockAudioNode {
    gain = {
      value: 1,
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {},
      cancelScheduledValues() {},
    };
  }

  class MockOscillatorNode extends MockAudioNode {
    type = 'sine';
    frequency = {
      value: 440,
      setValueAtTime() {},
    };
    start() {}
    stop() {}
  }

  class MockAudioContext {
    state = 'running';
    currentTime = 0;
    destination = new MockAudioNode();
    createGain() {
      return new MockGainNode();
    }
    createOscillator() {
      return new MockOscillatorNode();
    }
    async resume() {
      this.state = 'running';
    }
    async close() {
      this.state = 'closed';
    }
  }

  (window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
  (window as unknown as { webkitAudioContext: unknown }).webkitAudioContext = MockAudioContext;
}
