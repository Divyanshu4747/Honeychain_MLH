# HoneyChain — Smart Contract Reference

Contract: `contracts/HoneyChain.sol`
Solidity: `^0.8.24` (built-in overflow/underflow checks; no SafeMath needed)
Base: OpenZeppelin `AccessControl` (role-based access control, not a custom
authorization system)
Pattern: single immutable contract, **no proxy / upgradeability** — see
`docs/security.md` for why this was chosen for the hackathon MVP.

## Roles

| Role | Constant | Granted by | Can do |
|---|---|---|---|
| Super admin | `DEFAULT_ADMIN_ROLE` (OZ built-in) | Deployer, at construction | Manage `ADMIN_ROLE` itself |
| Admin | `ADMIN_ROLE` | `DEFAULT_ADMIN_ROLE` | Grant/revoke `BEEKEEPER_ROLE`, `LAB_ROLE`, `PROCESSOR_ROLE`, `DISTRIBUTOR_ROLE`, `RETAILER_ROLE` |
| Beekeeper | `BEEKEEPER_ROLE` | `ADMIN_ROLE` | `createBatch`; hold/transfer custody |
| Lab | `LAB_ROLE` | `ADMIN_ROLE` | `addQualityTest` |
| Processor | `PROCESSOR_ROLE` | `ADMIN_ROLE` | `recordProcessing`, `recordPackaging`; hold/transfer custody |
| Distributor | `DISTRIBUTOR_ROLE` | `ADMIN_ROLE` | Hold/transfer custody |
| Retailer | `RETAILER_ROLE` | `ADMIN_ROLE` | Hold custody (end of chain in this model) |
| Consumer | *(no role)* | — | Read-only: `getBatch`, `verifyBatch`, etc. Can never hold custody or write. |

The role admin for all five operational roles is set to `ADMIN_ROLE` (not
`DEFAULT_ADMIN_ROLE`) in the constructor via `_setRoleAdmin`, so the platform
admin can onboard/offboard participants day-to-day without needing the
top-level super-admin key. Granting/revoking roles automatically emits
OpenZeppelin's standard `RoleGranted` / `RoleRevoked` events — this project
does not reimplement those.

**Design note — "KVIC Aggregator":** the spec's example supply chain
(`Beekeeper → KVIC Aggregator → Processor → Distributor → Retailer`)
includes an aggregator step that isn't in the required-roles list. Rather
than inventing a seventh role, this implementation maps the aggregator onto
`DISTRIBUTOR_ROLE` for on-chain purposes (any intermediate custodian that
isn't a lab/processor/retailer is, functionally, a distributor). This is a
documented simplification — see `scripts/seedDemo.ts`.

## Data model

### `Batch`

| Field | Type | Notes |
|---|---|---|
| `batchId` | `string` | Human-readable, QR-encoded (e.g. `HNY-2026-0001`) |
| `beekeeper` | `address` | Creator; identity is the wallet only, no PII |
| `hiveId` | `string` | Hive identifier, not a GPS coordinate |
| `harvestQuantityGrams` | `uint256` | Grams, to avoid on-chain decimals |
| `harvestTimestamp` | `uint256` | Unix seconds |
| `originClusterId` | `string` | Rural cluster/region identifier — privacy-safe, not a home address |
| `currentOwner` | `address` | Current custodian |
| `status` | `BatchStatus` | Coarse lifecycle stage (see below) |
| `qualityStatus` | `QualityStatus` | `Pending` / `Pass` / `Fail`, from the latest test |
| `latestCertificateCID` | `string` | Most recent lab certificate's IPFS CID |
| `documentHash` | `bytes32` | Optional generic supporting-document digest |
| `creationTimestamp` | `uint256` | Block timestamp at creation |
| `exists` | `bool` | Existence flag (Solidity has no native `Option` type) |

`BatchStatus`: `Harvested → QualityTested → Processed → Packaged → InTransit
→ AtRetailer`. This is a coarse, quick-read status; the authoritative
timeline is the union of the arrays below plus emitted events.

### Per-batch arrays

- `QualityTest[]` — `lab`, `moistureContentBps`, `sucroseLevelBps`, `result`,
  `testTimestamp`, `certificateCID`, `certificateHash`. Basis points
  (`1720` = 17.2%) are used instead of fixed-point decimals to keep the
  contract simple.
- `ProcessingEvent[]` — `processor`, `timestamp`, `processType`, `metadataCID`.
- `PackagingEvent[]` — `packager`, `packagingId`, `packagingDate`,
  `packageRef`, `metadataCID`.
- `CustodyTransfer[]` — `from`, `to`, `timestamp`.

**Trade-off, stated explicitly:** these are stored as on-chain arrays
(rather than reconstructed purely from event logs) so the entire batch
history can be fetched in a single `verifyBatch()` call — good for a
hackathon demo and a simple backend. At production scale (many thousands of
transfers per batch, which is unrealistic for honey but worth naming), an
event-indexer/subgraph approach would be more gas-efficient for writers and
should replace or supplement these arrays.

## Functions

| Function | Access | Effect |
|---|---|---|
| `createBatch(batchId, hiveId, qtyGrams, harvestTimestamp, originClusterId, initialCertificateCID, documentHash)` | `BEEKEEPER_ROLE` | Creates a batch, `currentOwner = msg.sender`, emits `BatchCreated` |
| `addQualityTest(batchId, moistureBps, sucroseBps, passed, certificateCID, certificateHash)` | `LAB_ROLE` | Appends a test, updates `qualityStatus`/`latestCertificateCID`, emits `QualityTestAdded` |
| `transferBatch(batchId, newOwner)` | Current custodian only | Requires `newOwner` to hold a recognized supply-chain role; emits `BatchTransferred` |
| `recordProcessing(batchId, processType, metadataCID)` | `PROCESSOR_ROLE` **and** current custodian | Appends a processing event, sets status `Processed`, emits `ProcessingRecorded` |
| `recordPackaging(batchId, packagingId, packageRef, metadataCID)` | `PROCESSOR_ROLE` **and** current custodian | Appends a packaging event, sets status `Packaged`, emits `PackagingRecorded` |
| `getBatch(batchId)` | Public view | Reverts `BatchDoesNotExist` if missing |
| `getQualityTests/getProcessingEvents/getPackagingEvents/getCustodyHistory(batchId)` | Public view | Returns the relevant array (empty if the batch is missing) |
| `verifyBatch(batchId)` | Public view | Never reverts for a missing batch; returns `found = false` instead — see below |
| `verifyDocumentHash(batchId, providedHash)` | Public view | Compares a caller-supplied hash against the latest test's `certificateHash` |
| `batchExists(batchId)` / `getAllBatchIds()` | Public view | Convenience/demo helpers |
| `grantRole` / `revokeRole` / `hasRole` | OpenZeppelin standard | Role administration |

Why `recordProcessing`/`recordPackaging` require **both** `PROCESSOR_ROLE`
and current custody: a processor who does not currently hold the batch
should not be able to fabricate a processing record for someone else's
batch, even though they're a legitimately-authorized processor in general.

## Events

`BatchCreated`, `QualityTestAdded`, `BatchTransferred`, `ProcessingRecorded`,
`PackagingRecorded` are all custom events, each indexed on `batchIdHash =
keccak256(bytes(batchId))` for efficient filtering, while also emitting the
plain-text `batchId` as a non-indexed field. This split matters: Solidity/
ethers cannot decode an indexed `string` back to its original value from a
log (only its hash is recoverable), so indexing the raw string would make
`batchId` unreadable from the log itself. Indexing the hash and separately
emitting the plain string gives both efficient filtering *and* a
human-readable batch ID in every log entry.
`RoleGranted`/`RoleRevoked`/`RoleAdminChanged` come from OpenZeppelin
`AccessControl` and are emitted automatically.

Together, these five custom events let a backend indexer reconstruct the
consumer-facing timeline (`Harvested → Quality Tested → Processed →
Packaged → Transferred → Retailer`) purely from logs, without needing to
call into the contract at all — useful for a dashboard that wants to avoid
RPC calls per batch.

## Consumer verification semantics

`verifyBatch(batchId)` returns `found: bool` plus the full batch + arrays.
The backend/API layer is expected to translate this into exactly one of
three consumer-facing states:

- **VERIFIED** — `found == true`. This means *the on-chain record exists and
  is internally consistent* — it does **not** by itself prove the physical
  jar in the consumer's hand is the one described. A batch ID existing is
  necessary, not sufficient, for a claim of authenticity (see
  `docs/integration.md` for how the frontend should phrase this).
- **NOT_FOUND** — `found == false`. No such batch ID was ever created.
- **DOCUMENT/REFERENCE MISMATCH** — `found == true`, but
  `verifyDocumentHash(batchId, hashOfRedownloadedCertificate)` returns
  `false`. This means the batch exists, but the certificate the caller
  fetched from IPFS does not match the digest recorded on-chain at test
  time (e.g. `certificateCID` was tampered with off-chain, or the wrong
  file is being served from the gateway).
