// Minimal in-memory R2 for tests — supports put/get/delete with content-type.
export function makeMemoryR2(): R2Bucket {
  const store = new Map<string, { body: ArrayBuffer; contentType?: string }>();
  const toBuf = (v: unknown): ArrayBuffer => {
    if (typeof v === 'string') return new TextEncoder().encode(v).buffer as ArrayBuffer;
    if (v instanceof ArrayBuffer) return v;
    if (v instanceof Uint8Array)
      return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) as ArrayBuffer;
    return new ArrayBuffer(0);
  };
  return {
    put: async (key: string, value: unknown, opts?: { httpMetadata?: { contentType?: string } }) => {
      store.set(key, { body: toBuf(value), contentType: opts?.httpMetadata?.contentType });
      return {};
    },
    get: async (key: string) => {
      const e = store.get(key);
      if (!e) return null;
      // Real R2 objects expose both a stream and arrayBuffer(); the route streams.
      return {
        body: new Blob([e.body]).stream(),
        arrayBuffer: async () => e.body,
        httpMetadata: { contentType: e.contentType },
      };
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  } as unknown as R2Bucket;
}
