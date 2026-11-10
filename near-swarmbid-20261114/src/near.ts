export interface NearStatus {
  chainId: string;
  latestBlockHeight: number;
  rpc: string;
}

/** Read-only adapter. It never signs, creates accounts, or spends funds. */
export async function readTestnetStatus(rpc = "https://rpc.testnet.near.org"): Promise<NearStatus> {
  const response = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "swarm-bid", method: "status", params: [] }),
  });
  if (!response.ok) throw new Error(`NEAR RPC HTTP ${response.status}`);
  const body = (await response.json()) as { result?: { chain_id?: string; sync_info?: { latest_block_height?: number } }; error?: { message: string } };
  if (body.error) throw new Error(body.error.message);
  return {
    chainId: body.result?.chain_id ?? "unknown",
    latestBlockHeight: body.result?.sync_info?.latest_block_height ?? 0,
    rpc,
  };
}
