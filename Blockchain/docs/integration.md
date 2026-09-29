# HoneyChain — Backend Integration Guide

All blockchain interaction for the rest of the HoneyChain application should
go through `src/blockchain/honeyChainClient.ts`. Nothing else in the backend
should import `ethers` directly or know the contract's ABI/address — this
keeps blockchain-specific logic isolated, per the project's integration
requirement.

## Setup

1. Deploy (or reuse an existing deployment) — see `docs/README` "Deployment"
   section.
2. Set in `.env`:
   ```
   BACKEND_RPC_URL=http://127.0.0.1:8545          # or your testnet RPC
   HONEYCHAIN_CONTRACT_ADDRESS=0x...               # from deployments/<network>.json
   DEPLOYER_PRIVATE_KEY=0x...                      # only needed for write access
   ```
3. From any backend module:
   ```ts
   import { getHoneyChainClient } from "./blockchain/honeyChainClient";
   const client = getHoneyChainClient();
   ```

## API surface

| Method | Purpose | Errors |
|---|---|---|
| `createBatch(params)` | Register a new harvest batch | Throws `HoneyChainClientError` wrapping the contract's revert reason (e.g. `BatchAlreadyExists`, `InvalidQuantity`) |
| `addQualityTest(params)` | Submit a lab result | Throws on `BatchDoesNotExist`, or if caller lacks `LAB_ROLE` |
| `transferBatch(batchId, newOwner)` | Move custody | Throws on `NotCurrentCustodian`, `RecipientMissingSupplyChainRole`, etc. |
| `recordProcessing(params)` / `recordPackaging(params)` | Record supply-chain events | Throws on `BatchDoesNotExist` or `NotCurrentCustodian` |
| `getBatch(batchId)` | Fetch current batch state | Throws `HoneyChainClientError` if the batch doesn't exist |
| `getBatchHistory(batchId)` | Fetch batch + all event arrays | Same as above |
| `verifyBatch(batchId)` | Consumer-facing verification | **Never throws for a missing batch** — returns `{ status: "NOT_FOUND" }` |
| `verifyDocumentHash(batchId, hash)` | Certificate integrity check | Returns `boolean`, does not throw for a missing hash |

All write methods return a `ContractTransactionReceipt` once the transaction
is mined. All errors from the underlying chain call are wrapped in
`HoneyChainClientError`, with the original error attached as `.cause`, so API
route handlers can catch one error type and decide how to map it to an HTTP
status (e.g. `BatchAlreadyExists` → 409, `BatchDoesNotExist` → 404,
role-related reverts → 403).

## Example: consumer verification endpoint (Express-style pseudocode)

```ts
app.get("/verify/:batchId", async (req, res) => {
  const client = getHoneyChainClient({ readOnly: true });
  const result = await client.verifyBatch(req.params.batchId);

  if (result.status === "NOT_FOUND") {
    return res.status(404).json({ status: "NOT_FOUND" });
  }

  // Optional extra step: if the frontend also fetched the certificate PDF
  // from IPFS and computed its sha256, compare it here for a MISMATCH check.
  // const matches = await client.verifyDocumentHash(batchId, recomputedHash);

  return res.json({ status: "VERIFIED", history: result.history });
});
```

## Example: beekeeper creates a batch

```ts
const client = getHoneyChainClient();
await client.createBatch({
  batchId: "HNY-2026-0002",
  hiveId: "HIVE-043",
  harvestQuantityGrams: 12_000,
  originClusterId: "Rural-Cluster-B",
});
```

## QR code integration

The blockchain layer does not generate QR images. It only guarantees a
stable identifier and lookup path:

```
Honey jar label --> QR code encodes: https://honeychain.app/verify/HNY-2026-0001
                --> Frontend calls:  GET /verify/HNY-2026-0001
                --> Backend calls:   client.verifyBatch("HNY-2026-0001")
                --> Response:        VERIFIED | NOT_FOUND (+ optional MISMATCH check)
```

The frontend should generate the actual QR image (e.g. with a `qrcode` npm
package) from that URL — that responsibility intentionally sits outside this
repository.

## What "VERIFIED" should be communicated as to a consumer

Be precise in the UI copy: `VERIFIED` means *the batch record exists on-chain
and its history is internally consistent and unaltered since creation*. It
does not, by itself, prove that the specific jar in the consumer's hand is
physically the one described (that additional link — physical jar ↔ QR code
label — is a packaging/anti-counterfeiting concern outside the blockchain
layer). Avoid marketing copy that says a verified batch is "guaranteed
authentic honey"; say what is actually true: its recorded history has not
been tampered with.
