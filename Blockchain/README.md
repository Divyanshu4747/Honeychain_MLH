# HoneyChain — Blockchain Layer

On-chain traceability, quality-verification and custody-history layer for
the HoneyChain honey supply-chain platform. Built with Solidity, Hardhat,
OpenZeppelin AccessControl, and ethers.js.

> **A note on how this was built:** this codebase was generated in a
> sandboxed environment with no outbound network access, so `npm install`
> / `hardhat compile` / `hardhat test` could not actually be executed here
> to prove they pass. Everything below is written against current,
> real APIs (OpenZeppelin Contracts v5.x `AccessControl`, Hardhat 2.22+,
> ethers v6) to the best of available knowledge, but **you must run the
> commands below yourself** before treating this as verified working code.
> If `npx hardhat compile` or `npx hardhat test` surfaces a version
> mismatch, check the current docs for the package in question (links
> below) and adjust `package.json` accordingly — don't force an outdated
> API to work.

## What this is

See `docs/architecture.md` for the full design rationale. In short:

- Beekeepers create harvest batches on-chain.
- Labs attach quality-test results, referencing a certificate stored on
  IPFS (never the PDF itself).
- Custody moves through the supply chain (aggregator → processor →
  distributor → retailer) with on-chain enforcement of who can transfer to
  whom.
- Consumers scan a QR code that resolves to `/verify/{batchId}` and see the
  full, tamper-evident timeline.
- The blockchain is **not** the application database — see
  `docs/architecture.md` for what stays off-chain.

## Project structure

```
honeychain-blockchain/
├── contracts/
│   └── HoneyChain.sol          # Core contract (roles, batches, quality, custody, events)
├── test/
│   └── HoneyChain.test.ts      # Full automated test suite
├── scripts/
│   ├── deploy.ts                # Deployment script (local + testnet)
│   ├── seedDemo.ts              # Populates the demo scenario
│   └── verifyBatch.ts           # CLI simulation of the consumer verify flow
├── src/
│   ├── blockchain/
│   │   └── honeyChainClient.ts # Backend integration API (createBatch, verifyBatch, ...)
│   └── ipfs/
│       └── ipfsClient.ts        # Pin/fetch certificates, CID vs sha256 handling
├── deployments/                 # Written by deploy.ts / seedDemo.ts (git-ignored except .gitkeep)
├── docs/
│   ├── architecture.md
│   ├── smart-contract.md
│   ├── security.md
│   └── integration.md
├── .env.example
├── hardhat.config.ts
├── package.json
└── README.md
```

## Setup

Requires Node.js 18+ and network access (for npm + any testnet RPC).

```bash
cd honeychain-blockchain
npm install
cp .env.example .env
```

Before installing, it's worth a quick sanity check against current docs
since tooling moves fast:
- Hardhat: https://hardhat.org/docs
- OpenZeppelin Contracts: https://docs.openzeppelin.com/contracts/
- ethers.js: https://docs.ethers.org/v6/

## Compile

```bash
npm run compile
```

## Test

```bash
npm test
```

The suite (`test/HoneyChain.test.ts`) covers: deployment, admin role setup,
role granting/revocation + events, authorized/unauthorized batch creation,
duplicate-batch prevention, invalid-input rejection, quality-test
submission (authorized/unauthorized, PASS/FAIL, multiple tests), custody
transfer (authorized/unauthorized, invalid recipient, self-transfer,
nonexistent batch), processing/packaging events (authorized/unauthorized,
custodian enforcement), event emission for all five custom events, consumer
verification (`VERIFIED`/`NOT_FOUND`), document-hash verification
(match/mismatch), and edge cases (`getBatch` on a missing ID, batch
enumeration).

**The test suite must pass before deployment** — this is treated as a hard
gate, not a suggestion.

## Run locally

Terminal 1:
```bash
npx hardhat node
```

Terminal 2:
```bash
npm run deploy:local
npm run seed:local
npm run verify:batch          # prints the demo batch's full verified timeline
```

`npm run deploy:local` writes the contract address + ABI to
`deployments/localhost.json`. `npm run seed:local` attaches to that
deployment (or deploys a fresh one if none exists) and walks the demo batch
`HNY-2026-0001` through the entire lifecycle described in
`docs/integration.md`.

## Testnet deployment

```bash
# in .env: SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY (a throwaway testnet wallet)
npm run deploy:sepolia
```

Never commit `.env`. Only `.env.example` (placeholders only) is tracked.

## Example API calls (backend integration)

```ts
import { getHoneyChainClient } from "./src/blockchain/honeyChainClient";

const client = getHoneyChainClient();

await client.createBatch({
  batchId: "HNY-2026-0001",
  hiveId: "HIVE-042",
  harvestQuantityGrams: 18_400,
  originClusterId: "Rural-Cluster-A",
});

const result = await client.verifyBatch("HNY-2026-0001");
// { status: "VERIFIED", history: { batch, qualityTests, processingEvents, packagingEvents, custodyHistory } }
```

See `docs/integration.md` for the full API surface and an example
`/verify/:batchId` endpoint.

## Example Batch ID

`HNY-2026-0001` (created by `scripts/seedDemo.ts`), origin `Rural-Cluster-A`,
hive `HIVE-042`, 18.4kg, quality PASS at 17.2% moisture, taken through the
full supply chain to a retailer.

## Data flow, end to end

```
Beekeeper wallet --createBatch--> HoneyChain contract (Harvested)
Lab wallet --addQualityTest + IPFS CID--> HoneyChain contract (QualityTested)
KVIC Aggregator/Processor/Distributor/Retailer wallets --transferBatch--> custody chain
Processor wallet --recordProcessing / recordPackaging--> HoneyChain contract
Consumer --scans QR--> GET /verify/:batchId --> backend --> client.verifyBatch() --> HoneyChain contract (view)
```

## Known limitations & security assumptions

See `docs/security.md` for the full checklist. Headline items:

- Not professionally audited; this is an SIH/hackathon prototype.
- No upgradeability (deliberate, documented trade-off for simplicity).
- Per-batch history is stored in on-chain arrays for demo simplicity, not
  behind an event-indexer — fine at hackathon scale, worth revisiting at
  large scale.
- No IoT device-signing/oracle mechanism is implemented; raw sensor data is
  not claimed to be cryptographically authenticated.
- Key management for lab/beekeeper/admin wallets is out of scope for this
  repo and must be handled operationally (see `docs/security.md`).

## Definition of done — status

- [ ] Smart contract compiles — **run `npm run compile` to confirm** (not executable in the environment this was authored in)
- [ ] Automated tests pass — **run `npm test` to confirm**
- [x] Role-based permissions implemented (`AccessControl`, 6 roles)
- [x] Beekeepers can create batches (`createBatch`, tested)
- [x] Labs can submit quality results (`addQualityTest`, tested)
- [x] Unauthorized users are rejected (tested for every write path)
- [x] Custody transfers work (`transferBatch`, tested)
- [x] Processing/packaging events work (tested)
- [x] Events are emitted for all major state changes (tested)
- [x] IPFS/document references implemented (`certificateCID` + `certificateHash`, `src/ipfs`)
- [x] Batch history reconstructable (`verifyBatch`, `getBatchHistory`)
- [x] Consumer verification implemented (`verifyBatch`, `verifyDocumentHash`)
- [x] Demo data seed script (`scripts/seedDemo.ts`)
- [ ] Local deployment — **run `npm run deploy:local` to confirm**
- [x] Testnet deployment configuration present (`hardhat.config.ts`, Sepolia)
- [x] No secrets committed (`.env.example` only, `.gitignore` covers `.env`)
- [x] README complete
- [x] Security review documented (`docs/security.md`)
- [x] Backend integration interface documented (`docs/integration.md`, `src/blockchain/honeyChainClient.ts`)

The three unchecked items require actually running the commands in an
environment with npm registry + Hardhat access, which this authoring
environment did not have. No contract address, deployment tx hash, or test
run output is fabricated anywhere in this repo or its docs — where a real
value would go (e.g. a deployed contract address), it is left as a
placeholder or generated only by actually running the script.
