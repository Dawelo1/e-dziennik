const TEST_CLOCK_STORAGE_KEY = 'debug_test_clock_override_iso';

const NativeDate = Date;
const nativeNow = NativeDate.now.bind(NativeDate);

let overrideState = null;

const makeMockDateClass = () => {
  class MockDate extends NativeDate {
    constructor(...args) {
      if (args.length === 0 && overrideState) {
        const elapsed = nativeNow() - overrideState.baseRealMs;
        super(overrideState.baseOverrideMs + elapsed);
        return;
      }
      super(...args);
    }

    static now() {
      if (!overrideState) {
        return nativeNow();
      }
      const elapsed = nativeNow() - overrideState.baseRealMs;
      return overrideState.baseOverrideMs + elapsed;
    }

    static parse(value) {
      return NativeDate.parse(value);
    }

    static UTC(...args) {
      return NativeDate.UTC(...args);
    }
  }

  Object.defineProperty(MockDate, 'name', { value: 'Date' });
  return MockDate;
};

const applyGlobalOverride = () => {
  if (overrideState) {
    globalThis.Date = makeMockDateClass();
  } else {
    globalThis.Date = NativeDate;
  }
};

const applyIsoOverride = (isoValue) => {
  if (!isoValue) {
    overrideState = null;
    applyGlobalOverride();
    return null;
  }

  const parsed = new NativeDate(isoValue);
  if (Number.isNaN(parsed.getTime())) {
    overrideState = null;
    applyGlobalOverride();
    return null;
  }

  overrideState = {
    baseRealMs: nativeNow(),
    baseOverrideMs: parsed.getTime(),
    iso: parsed.toISOString(),
  };
  applyGlobalOverride();
  return overrideState.iso;
};

export const initializeClientTimeOverride = () => {
  const storedValue = localStorage.getItem(TEST_CLOCK_STORAGE_KEY);
  applyIsoOverride(storedValue);
};

export const setClientTimeOverride = (isoValue) => {
  const normalizedIso = applyIsoOverride(isoValue);

  if (normalizedIso) {
    localStorage.setItem(TEST_CLOCK_STORAGE_KEY, normalizedIso);
  } else {
    localStorage.removeItem(TEST_CLOCK_STORAGE_KEY);
  }

  return normalizedIso;
};

export const clearClientTimeOverride = () => {
  overrideState = null;
  localStorage.removeItem(TEST_CLOCK_STORAGE_KEY);
  applyGlobalOverride();
};

export const getClientTimeOverride = () => {
  return overrideState?.iso || null;
};
