# HoneyChain — Security Review

This document records the security review performed against
`contracts/HoneyChain.sol`, organized against the checklist in the project
spec. It states assumptions and limitations explicitly rather than making
unsupported guarantees — per the project's engineering rules, this system
never claims a security property it does not actually implement.

> **Status:** This is a hackathon/SIH prototype. It has NOT been
> professionally audited. Do not deploy it to mainnet with real value at
> stake without an independent audit.

## Checklist

| Item | Status | Notes |
|---|---|---|
| Missing access control | ✅ Mitigated | Every state-changing function is gated by `onlyRole(...)` (OpenZeppelin `AccessControl`) and/or a custodian check (`msg.sender == batch.currentOwner`). No function that mutates a `Batch` is callable by an arbitrary address. |
| Unauthorized state changes | ✅ Mitigated | Same as above; additionally `transferBatch` requires the *recipient* to hold a recognized supply-chain role (`_hasSupplyChainRole`), so custody can't be handed to a random address, including a consumer wallet. |
| Duplicate batch IDs | ✅ Mitigated | `createBatch` checks `batches[key].exists` and reverts `BatchAlreadyExists` before writing. |
| Invalid inputs | ✅ Mitigated | `_requireNonEmpty` guards every required string field; `harvestQuantityGrams == 0` reverts `InvalidQuantity`; `newOwner == address(0)` reverts `InvalidNewOwner`. |
| Incorrect ownership transitions | ✅ Mitigated | Only the current custodian can call `transferBatch`; self-transfer is explicitly rejected (`SameOwnerTransfer`); recipient role is checked. |
| Reentrancy | ✅ Not applicable | The contract makes no external calls to untrusted contracts and holds no ETH/tokens — there is nothing for a reentrant callback to exploit. `ReentrancyGuard` was deliberately omitted rather than added as unnecessary complexity, per the "simple > enterprise" instruction. If a future version adds ETH transfers or calls to external contracts, `ReentrancyGuard` should be added at that time. |
| Unsafe external calls | ✅ Not applicable | No external calls are made from this contract. IPFS interaction happens entirely off-chain in `src/ipfs`. |
| Denial-of-service patterns | ⚠️ Documented trade-off | `getBatch`/`verifyBatch` return dynamically-sized arrays (quality tests, processing/packaging events, custody transfers). At realistic hackathon/demo volumes this is fine; at very large per-batch event counts, a `view` call could become expensive to run off a full node (though this doesn't cost the caller gas since these are `view` functions, not transactions). No unbounded loop exists in any **state-changing** function, so this cannot be used to block writes or waste other users' gas. |
| Inappropriate use of `tx.origin` | ✅ Mitigated | `tx.origin` is never used; all authorization checks use `msg.sender`. |
| Timestamp assumptions | ✅ Documented | `block.timestamp` is used for `harvestTimestamp` (when not explicitly supplied), `creationTimestamp`, and all event timestamps. Miners/validators can influence `block.timestamp` by a small amount (seconds), which is irrelevant at the granularity (harvest dates, supply-chain steps) this contract cares about. No logic branches on sub-minute timestamp precision. |
| Integer overflow/underflow | ✅ Mitigated | Solidity `^0.8.x` reverts on overflow/underflow by default; no `unchecked` blocks are used anywhere in this contract. |
| Unsafe role administration | ✅ Mitigated | Role admin hierarchy is explicit: `DEFAULT_ADMIN_ROLE` manages `ADMIN_ROLE`; `ADMIN_ROLE` manages the five operational roles. No role is left with `DEFAULT_ADMIN_ROLE` as its admin unintentionally (OpenZeppelin's default), because the constructor explicitly calls `_setRoleAdmin` for every operational role. |
| Accidental exposure of private data | ✅ Mitigated | See `docs/architecture.md` "Privacy" section — no phone numbers, addresses, government IDs, emails, or precise coordinates are ever written to any field. Only wallet addresses and a coarse `originClusterId` identify a beekeeper. |
| Excessive on-chain storage | ⚠️ Documented trade-off | Per-batch history is stored as on-chain arrays for demo simplicity (see `docs/smart-contract.md`). Documents/PDFs themselves are never stored on-chain — only CIDs and optional 32-byte hashes. |
| Gas-expensive loops | ✅ Mitigated in write paths | No state-changing function contains a loop over user-controlled or unbounded data. The only loops are in `view` functions returning arrays (see DoS row above), which cost the caller nothing when called off-chain (e.g. via `eth_call`). |
| Incorrect assumptions about IPFS | ✅ Documented | See `docs/architecture.md` "IPFS vs. hashing" — the contract and `src/ipfs/ipfsClient.ts` never treat a CID as equivalent to a SHA-256 digest; they are stored and compared as distinct fields (`certificateCID` vs `certificateHash`). |
| Incorrect assumptions about IoT authenticity | ✅ Documented | No IoT-signing/oracle mechanism is implemented in this repository. `docs/architecture.md` explicitly states the trust model and does not claim any cryptographic authentication of sensor data. |

## Additional notes

- **Upgradeability:** deliberately **not** upgradeable. A single immutable
  deployment is simpler to reason about and sufficient for the prototype. If
  a bug is found post-deployment, the fix is a new deployment plus a
  migration script, not a proxy upgrade — this is a conscious trade-off
  documented here, not an oversight.
- **No custom cryptography:** all authorization uses OpenZeppelin's audited
  `AccessControl` rather than a hand-rolled role system.
- **No token/NFT functionality:** intentionally omitted — HoneyChain is a
  traceability system, not a cryptocurrency or NFT project, per the
  project's explicit engineering rules.
- **Front-running:** custody transfers and quality-test submissions are
  restricted to specific, pre-authorized addresses, which limits the value
  of front-running these transactions (there's no auction, price, or
  race-to-claim mechanic anywhere in this contract).
- **Known limitation — role compromise:** as with any `AccessControl`-based
  system, if a `LAB_ROLE` or `BEEKEEPER_ROLE` private key is compromised, the
  attacker can submit a false quality test or create a fraudulent batch
  until `ADMIN_ROLE` revokes that address. This is a supply-chain
  identity/key-management problem, not something the smart contract alone
  can solve — production deployment should pair this with proper key
  custody (hardware wallets / MPC for lab and admin keys) for real
  participants.
- **Known limitation — data availability of off-chain content:** if an IPFS
  pin is not maintained by anyone (unpinned / garbage collected), the CID
  becomes unretrievable even though it's still correctly recorded on-chain.
  Production use should use a paid pinning service or run dedicated pinning
  infrastructure with redundancy.
