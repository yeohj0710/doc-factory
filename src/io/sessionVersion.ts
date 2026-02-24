type SessionState = {
  version: number;
  lastSignature: string | null;
};

declare global {
  var __docFactorySessionState__: SessionState | undefined;
}

function getState(): SessionState {
  if (!globalThis.__docFactorySessionState__) {
    globalThis.__docFactorySessionState__ = {
      version: 0,
      lastSignature: null,
    };
  }
  return globalThis.__docFactorySessionState__;
}

export function registerRegeneration(signature: string): number {
  const state = getState();
  state.version += 1;
  state.lastSignature = signature;
  return state.version;
}

export function getCurrentSessionVersion(): number {
  const state = getState();
  return state.version > 0 ? state.version : 1;
}

export function getLastSessionSignature(): string | null {
  return getState().lastSignature;
}
