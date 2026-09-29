/**
 * HoneyChain blockchain integration client.
 *
 * This module is the ONLY place in the backend that should know about ethers.js,
 * ABIs, or contract addresses. Every other part of the HoneyChain application
 * (API routes, dashboards, AI services) should go through the functions exported
 * here instead of talking to the chain directly. This keeps blockchain-specific
 * logic isolated per the project's integration requirements.
 *
 * Usage (from the rest of the backend):
 *
 *   import { getHoneyChainClient } from "./blockchain/honeyChainClient";
 *   const client = getHoneyChainClient();
 *   await client.createBatch({ ... });
 */

import { ethers, Wallet, JsonRpcProvider, Contract, ContractTransactionReceipt } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

// ---------------------------------------------------------------------------
// Types (mirror the Solidity structs / enums 1:1 so the rest of the backend
// gets a typed, JS-friendly view instead of raw ethers Result arrays).
// ---------------------------------------------------------------------------

export enum BatchStatus {
  Harvested = 0,
  QualityTested = 1,
  Processed = 2,
  Packaged = 3,
  InTransit = 4,
  AtRetailer = 5,
}

export enum QualityStatus {
  Pending = 0,
  Pass = 1,
  Fail = 2,
}

export interface BatchRecord {
  batchId: string;
  beekeeper: string;
  hiveId: string;
  harvestQuantityGrams: bigint;
  harvestTimestamp: bigint;
  originClusterId: string;
  currentOwner: string;
  status: BatchStatus;
  qualityStatus: QualityStatus;
  latestCertificateCID: string;
  documentHash: string;
  creationTimestamp: bigint;
  exists: boolean;
}

export interface QualityTestRecord {
  lab: string;
  moistureContentBps: number;
  sucroseLevelBps: number;
  result: QualityStatus;
  testTimestamp: bigint;
  certificateCID: string;
  certificateHash: string;
}

export interface ProcessingEventRecord {
  processor: string;
  timestamp: bigint;
  processType: string;
  metadataCID: string;
}

export interface PackagingEventRecord {
  packager: string;
  packagingId: string;
  packagingDate: bigint;
  packageRef: string;
  metadataCID: string;
}

export interface CustodyTransferRecord {
  from: string;
  to: string;
  timestamp: bigint;
}

export interface BatchHistory {
  batch: BatchRecord;
  qualityTests: QualityTestRecord[];
  processingEvents: ProcessingEventRecord[];
  packagingEvents: PackagingEventRecord[];
  custodyHistory: CustodyTransferRecord[];
}

export interface VerificationResult {
  status: "VERIFIED" | "NOT_FOUND";
  history?: BatchHistory;
}

/** Thrown for any blockchain-layer failure, with the underlying cause attached. */
export class HoneyChainClientError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "HoneyChainClientError";
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class HoneyChainClient {
  private readonly contract: Contract;
  private readonly signerOrProvider: Wallet | JsonRpcProvider;

  constructor(contract: Contract, signerOrProvider: Wallet | JsonRpcProvider) {
    this.contract = contract;
    this.signerOrProvider = signerOrProvider;
  }

  // -- Writes ---------------------------------------------------------------

  async createBatch(params: {
    batchId: string;
    hiveId: string;
    harvestQuantityGrams: number | bigint;
    harvestTimestamp?: number | bigint; // 0/omitted = "now" (contract fills in block.timestamp)
    originClusterId: string;
    initialCertificateCID?: string;
    documentHash?: string; // bytes32 hex string, defaults to zero
  }): Promise<ContractTransactionReceipt> {
    return this.send("createBatch", [
      params.batchId,
      params.hiveId,
      params.harvestQuantityGrams,
      params.harvestTimestamp ?? 0,
      params.originClusterId,
      params.initialCertificateCID ?? "",
      params.documentHash ?? ethers.ZeroHash,
    ]);
  }

  async addQualityTest(params: {
    batchId: string;
    moistureContentBps: number;
    sucroseLevelBps: number;
    passed: boolean;
    certificateCID: string;
    certificateHash?: string;
  }): Promise<ContractTransactionReceipt> {
    return this.send("addQualityTest", [
      params.batchId,
      params.moistureContentBps,
      params.sucroseLevelBps,
      params.passed,
      params.certificateCID,
      params.certificateHash ?? ethers.ZeroHash,
    ]);
  }

  async transferBatch(batchId: string, newOwner: string): Promise<ContractTransactionReceipt> {
    return this.send("transferBatch", [batchId, newOwner]);
  }

  async recordProcessing(params: {
    batchId: string;
    processType: string;
    metadataCID?: string;
  }): Promise<ContractTransactionReceipt> {
    return this.send("recordProcessing", [params.batchId, params.processType, params.metadataCID ?? ""]);
  }

  async recordPackaging(params: {
    batchId: string;
    packagingId: string;
    packageRef: string;
    metadataCID?: string;
  }): Promise<ContractTransactionReceipt> {
    return this.send("recordPackaging", [
      params.batchId,
      params.packagingId,
      params.packageRef,
      params.metadataCID ?? "",
    ]);
  }

  // -- Reads ------------------------------------------------------------------

  async getBatch(batchId: string): Promise<BatchRecord> {
    try {
      const raw = await this.contract.getBatch(batchId);
      return toBatchRecord(raw);
    } catch (error) {
      throw new HoneyChainClientError(`Failed to read batch "${batchId}"`, error);
    }
  }

  async getBatchHistory(batchId: string): Promise<BatchHistory> {
    try {
      const [batch, tests, processing, packaging, custody] = await Promise.all([
        this.contract.getBatch(batchId),
        this.contract.getQualityTests(batchId),
        this.contract.getProcessingEvents(batchId),
        this.contract.getPackagingEvents(batchId),
        this.contract.getCustodyHistory(batchId),
      ]);
      return {
        batch: toBatchRecord(batch),
        qualityTests: tests.map(toQualityTestRecord),
        processingEvents: processing.map(toProcessingEventRecord),
        packagingEvents: packaging.map(toPackagingEventRecord),
        custodyHistory: custody.map(toCustodyTransferRecord),
      };
    } catch (error) {
      throw new HoneyChainClientError(`Failed to read history for batch "${batchId}"`, error);
    }
  }

  /**
   * Consumer-facing verification (QR-code flow). Never throws for a missing
   * batch -- returns NOT_FOUND instead, matching the "clearly distinguish
   * VERIFIED from NOT_FOUND" requirement.
   */
  async verifyBatch(batchId: string): Promise<VerificationResult> {
    try {
      const result = await this.contract.verifyBatch(batchId);
      if (!result.found) {
        return { status: "NOT_FOUND" };
      }
      return {
        status: "VERIFIED",
        history: {
          batch: toBatchRecord(result.batch),
          qualityTests: result.tests.map(toQualityTestRecord),
          processingEvents: result.processing.map(toProcessingEventRecord),
          packagingEvents: result.packaging.map(toPackagingEventRecord),
          custodyHistory: result.custody.map(toCustodyTransferRecord),
        },
      };
    } catch (error) {
      throw new HoneyChainClientError(`Failed to verify batch "${batchId}"`, error);
    }
  }

  /**
   * Compares a hash computed off-chain (after re-downloading the certificate
   * from IPFS) against the on-chain record. Distinguishes the three consumer-
   * facing verification outcomes together with verifyBatch():
   *   - batch not found            -> verifyBatch() returns NOT_FOUND
   *   - hash matches               -> VERIFIED
   *   - batch found but hash differs -> DOCUMENT/REFERENCE MISMATCH
   */
  async verifyDocumentHash(batchId: string, providedHash: string): Promise<boolean> {
    try {
      return await this.contract.verifyDocumentHash(batchId, providedHash);
    } catch (error) {
      throw new HoneyChainClientError(`Failed to verify document hash for batch "${batchId}"`, error);
    }
  }

  async batchExists(batchId: string): Promise<boolean> {
    return this.contract.batchExists(batchId);
  }

  async getAllBatchIds(): Promise<string[]> {
    return this.contract.getAllBatchIds();
  }

  // -- Internal ---------------------------------------------------------------

  private async send(method: string, args: unknown[]): Promise<ContractTransactionReceipt> {
    try {
      const tx = await this.contract[method](...args);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error("Transaction did not return a receipt");
      }
      return receipt;
    } catch (error) {
      throw new HoneyChainClientError(`Blockchain call "${method}" failed: ${extractRevertReason(error)}`, error);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory: builds a client from environment configuration
// ---------------------------------------------------------------------------

let cachedClient: HoneyChainClient | null = null;

/**
 * Builds (and caches) a HoneyChainClient using BACKEND_RPC_URL,
 * HONEYCHAIN_CONTRACT_ADDRESS and, for write access, DEPLOYER_PRIVATE_KEY
 * from the environment. Falls back to reading deployments/<network>.json
 * for the address/ABI if HONEYCHAIN_CONTRACT_ADDRESS is not set.
 */
export function getHoneyChainClient(options?: { networkName?: string; readOnly?: boolean }): HoneyChainClient {
  if (cachedClient) return cachedClient;

  const rpcUrl = process.env.BACKEND_RPC_URL || "http://127.0.0.1:8545";
  const provider = new JsonRpcProvider(rpcUrl);

  const { address, abi } = resolveDeployment(options?.networkName);

  let signerOrProvider: Wallet | JsonRpcProvider = provider;
  if (!options?.readOnly && process.env.DEPLOYER_PRIVATE_KEY) {
    signerOrProvider = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  }

  const contract = new Contract(address, abi, signerOrProvider);
  cachedClient = new HoneyChainClient(contract, signerOrProvider);
  return cachedClient;
}

function resolveDeployment(networkName?: string): { address: string; abi: ethers.InterfaceAbi } {
  if (process.env.HONEYCHAIN_CONTRACT_ADDRESS) {
    const artifactPath = path.join(__dirname, "..", "..", "artifacts", "contracts", "HoneyChain.sol", "HoneyChain.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    return { address: process.env.HONEYCHAIN_CONTRACT_ADDRESS, abi: artifact.abi };
  }

  const deploymentFile = path.join(__dirname, "..", "..", "deployments", `${networkName ?? "localhost"}.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new HoneyChainClientError(
      `No deployment found for network "${networkName ?? "localhost"}". ` +
        "Run `npm run deploy:local` first, or set HONEYCHAIN_CONTRACT_ADDRESS in .env."
    );
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  return { address: deployment.address, abi: deployment.abi };
}

// ---------------------------------------------------------------------------
// Raw -> typed record mapping helpers
// ---------------------------------------------------------------------------

function toBatchRecord(raw: any): BatchRecord {
  return {
    batchId: raw.batchId,
    beekeeper: raw.beekeeper,
    hiveId: raw.hiveId,
    harvestQuantityGrams: raw.harvestQuantityGrams,
    harvestTimestamp: raw.harvestTimestamp,
    originClusterId: raw.originClusterId,
    currentOwner: raw.currentOwner,
    status: Number(raw.status),
    qualityStatus: Number(raw.qualityStatus),
    latestCertificateCID: raw.latestCertificateCID,
    documentHash: raw.documentHash,
    creationTimestamp: raw.creationTimestamp,
    exists: raw.exists,
  };
}

function toQualityTestRecord(raw: any): QualityTestRecord {
  return {
    lab: raw.lab,
    moistureContentBps: Number(raw.moistureContentBps),
    sucroseLevelBps: Number(raw.sucroseLevelBps),
    result: Number(raw.result),
    testTimestamp: raw.testTimestamp,
    certificateCID: raw.certificateCID,
    certificateHash: raw.certificateHash,
  };
}

function toProcessingEventRecord(raw: any): ProcessingEventRecord {
  return {
    processor: raw.processor,
    timestamp: raw.timestamp,
    processType: raw.processType,
    metadataCID: raw.metadataCID,
  };
}

function toPackagingEventRecord(raw: any): PackagingEventRecord {
  return {
    packager: raw.packager,
    packagingId: raw.packagingId,
    packagingDate: raw.packagingDate,
    packageRef: raw.packageRef,
    metadataCID: raw.metadataCID,
  };
}

function toCustodyTransferRecord(raw: any): CustodyTransferRecord {
  return {
    from: raw.from,
    to: raw.to,
    timestamp: raw.timestamp,
  };
}

function extractRevertReason(error: unknown): string {
  const anyErr = error as any;
  return anyErr?.shortMessage || anyErr?.reason || anyErr?.message || String(error);
}
