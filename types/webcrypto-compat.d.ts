export {};

declare global {
  interface SubtleCrypto {
    deriveKey(
      algorithm: {
        name: "PBKDF2";
        salt: Uint8Array;
        iterations: number;
        hash: string;
      },
      baseKey: CryptoKey,
      derivedKeyType: { name: "AES-GCM"; length: number },
      extractable: boolean,
      keyUsages: KeyUsage[],
    ): Promise<CryptoKey>;

    encrypt(
      algorithm: { name: "AES-GCM"; iv: Uint8Array },
      key: CryptoKey,
      data: Uint8Array,
    ): Promise<ArrayBuffer>;

    decrypt(
      algorithm: { name: "AES-GCM"; iv: Uint8Array },
      key: CryptoKey,
      data: Uint8Array,
    ): Promise<ArrayBuffer>;
  }
}
