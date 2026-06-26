// Stub for "next/headers" in Vitest test environment.
// Tests for pure helpers never call readUnlocks/grantUnlocks, so cookies()
// is never invoked — this stub just satisfies the import.
export const cookies = async () => ({
  get: (_name: string) => undefined,
  set: (_name: string, _value: string, _opts?: unknown) => {},
  delete: (_name: string) => {},
});
