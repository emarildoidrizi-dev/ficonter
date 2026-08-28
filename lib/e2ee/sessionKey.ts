let activeVaultKey: CryptoKey | null = null;

export function setActiveVaultKey(key: CryptoKey): void {
  activeVaultKey = key;
}

export function clearActiveVaultKey(): void {
  activeVaultKey = null;
}

export function getActiveVaultKey(): CryptoKey | null {
  return activeVaultKey;
}