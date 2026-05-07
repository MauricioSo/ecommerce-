const pendingTokens = new Map<string, string>();

export function storePendingToken(tokenId: string, rawToken: string): void {
  pendingTokens.set(tokenId, rawToken);
  setTimeout(() => pendingTokens.delete(tokenId), 10 * 60 * 1000);
}

export function consumePendingToken(tokenId: string): string | null {
  const raw = pendingTokens.get(tokenId);
  if (raw) pendingTokens.delete(tokenId);
  return raw ?? null;
}
