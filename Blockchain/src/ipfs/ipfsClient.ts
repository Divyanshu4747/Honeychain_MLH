/**
 * IPFS document integration for HoneyChain.
 *
 * Responsibility split (see docs/architecture.md, "Where data lives"):
 *   - Laboratory PDFs and other supporting documents are pinned to IPFS here.
 *   - Only the resulting CID (and optionally a content hash) is written
 *     on-chain, via honeyChainClient.addQualityTest / createBatch.
 *   - This module never talks to the blockchain, and honeyChainClient never
 *     talks to IPFS -- keeping the two storage layers cleanly separated.
 *
 * IMPORTANT DISTINCTION (do not conflate these):
 *   A CID (Content Identifier) is a self-describing, multihash-based
 *   identifier -- it encodes the hash *function* and *version* used, and for
 *   directories/large files can be the root of a Merkle DAG rather than a
 *   single hash of the raw bytes. It is NOT guaranteed to equal a plain
 *   SHA-256 digest of the file. If you need a portable "does this exact file
 *   match" check independent of IPFS chunking/versioning, compute a plain
 *   sha256 digest yourself (see sha256Hex below) and store THAT as the
 *   optional certificateHash / documentHash field, separately from the CID.
 *
 * This module is written against a generic HTTP pinning-service API
 * (Pinata-style: POST multipart file, receive back an IpfsHash). Swap
 * `pinFileToIpfs` for your provider's SDK (web3.storage, nft.storage,
 * a self-hosted Kubo node, etc.) without touching any other file.
 */

import * as fs from "fs";
import * as crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

export interface PinResult {
  cid: string;
  sizeBytes: number;
  sha256: string; // plain digest of the raw file bytes, NOT the CID
  gatewayUrl: string;
}

export class IpfsClientError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "IpfsClientError";
  }
}

/** Plain SHA-256 hex digest of a file's bytes -- distinct from its IPFS CID. */
export function sha256Hex(filePathOrBuffer: string | Buffer): string {
  const data = Buffer.isBuffer(filePathOrBuffer) ? filePathOrBuffer : fs.readFileSync(filePathOrBuffer);
  return "0x" + crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Pins a file (e.g. a lab certificate PDF) to IPFS via a pinning-service
 * HTTP API and returns its CID plus a plain sha256 digest for on-chain
 * document-integrity checks.
 *
 * Requires IPFS_API_URL, IPFS_API_KEY, IPFS_API_SECRET, IPFS_GATEWAY_URL in
 * the environment (see .env.example).
 */
export async function pinFileToIpfs(filePath: string): Promise<PinResult> {
  const apiUrl = requireEnv("IPFS_API_URL");
  const apiKey = requireEnv("IPFS_API_KEY");
  const apiSecret = requireEnv("IPFS_API_SECRET");
  const gatewayUrl = process.env.IPFS_GATEWAY_URL || "https://gateway.pinata.cloud/ipfs/";

  const fileBuffer = fs.readFileSync(filePath);
  const digest = sha256Hex(fileBuffer);

  const form = new FormData();
  form.append("file", new Blob([fileBuffer]), filePath.split("/").pop() ?? "document");

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/pinning/pinFileToIPFS`, {
      method: "POST",
      headers: {
        pinata_api_key: apiKey,
        pinata_secret_api_key: apiSecret,
      },
      body: form,
    });
  } catch (error) {
    throw new IpfsClientError("Network error while pinning file to IPFS", error);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new IpfsClientError(`IPFS pin request failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as { IpfsHash: string; PinSize: number };

  return {
    cid: json.IpfsHash,
    sizeBytes: json.PinSize,
    sha256: digest,
    gatewayUrl: `${gatewayUrl}${json.IpfsHash}`,
  };
}

/**
 * Fetches a document back from an IPFS gateway (for the certificate
 * verification flow) and returns its raw bytes plus a freshly computed
 * sha256 digest, so the caller can compare that digest against the on-chain
 * certificateHash via honeyChainClient.verifyDocumentHash().
 */
export async function fetchFromIpfs(cid: string): Promise<{ bytes: Buffer; sha256: string }> {
  const gatewayUrl = process.env.IPFS_GATEWAY_URL || "https://gateway.pinata.cloud/ipfs/";
  let response: Response;
  try {
    response = await fetch(`${gatewayUrl}${cid}`);
  } catch (error) {
    throw new IpfsClientError(`Network error while fetching CID ${cid} from IPFS`, error);
  }
  if (!response.ok) {
    throw new IpfsClientError(`Failed to fetch CID ${cid} from IPFS gateway (status ${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  return { bytes, sha256: sha256Hex(bytes) };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new IpfsClientError(`Missing required environment variable: ${name}`);
  }
  return value;
}
