import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Simulates the consumer-facing "scan QR code -> verify batch" flow from the
 * command line.
 *
 * Usage:
 *   npx hardhat run scripts/verifyBatch.ts --network localhost -- HNY-2026-0001
 * or simply:
 *   BATCH_ID=HNY-2026-0001 npm run verify:batch
 */
async function main() {
  const cliArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const batchId = process.env.BATCH_ID || cliArg || "HNY-2026-0001";

  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(deploymentFile)) {
    console.error(
      `No deployment found for network "${network.name}". Run \`npm run deploy:local\` (and \`npm run seed:local\`) first.`
    );
    process.exitCode = 1;
    return;
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const honeyChain = await ethers.getContractAt("HoneyChain", deployment.address);

  console.log(`Verifying batch "${batchId}" against contract ${deployment.address}...\n`);
  const result = await honeyChain.verifyBatch(batchId);

  if (!result.found) {
    console.log("Result: NOT_FOUND");
    console.log("No batch with this ID exists on-chain. Do not display any product details.");
    return;
  }

  console.log("Result: VERIFIED (batch record found on-chain)");
  console.log("Note: VERIFIED means the batch record and its history are authentic and unaltered");
  console.log("on-chain -- it does NOT by itself certify the physical product in a consumer's hand.\n");

  const statusNames = ["Harvested", "QualityTested", "Processed", "Packaged", "InTransit", "AtRetailer"];
  const qualityNames = ["Pending", "Pass", "Fail"];

  console.log("Batch summary:");
  console.log(`  Batch ID:        ${result.batch.batchId}`);
  console.log(`  Origin cluster:  ${result.batch.originClusterId}`);
  console.log(`  Hive:            ${result.batch.hiveId}`);
  console.log(`  Harvest qty:     ${result.batch.harvestQuantityGrams} g`);
  console.log(
    `  Harvest date:    ${new Date(Number(result.batch.harvestTimestamp) * 1000).toISOString()}`
  );
  console.log(`  Current owner:   ${result.batch.currentOwner}`);
  console.log(`  Status:          ${statusNames[Number(result.batch.status)]}`);
  console.log(`  Quality status:  ${qualityNames[Number(result.batch.qualityStatus)]}`);
  console.log(`  Certificate CID: ${result.batch.latestCertificateCID || "(none)"}`);

  console.log(`\nQuality tests (${result.tests.length}):`);
  result.tests.forEach((t: any, i: number) =>
    console.log(
      `  [${i}] lab=${t.lab} result=${qualityNames[Number(t.result)]} moisture=${
        Number(t.moistureContentBps) / 100
      }% cid=${t.certificateCID}`
    )
  );

  console.log(`\nProcessing events (${result.processing.length}):`);
  result.processing.forEach((p: any, i: number) =>
    console.log(`  [${i}] ${p.processType} by ${p.processor} at ${new Date(Number(p.timestamp) * 1000).toISOString()}`)
  );

  console.log(`\nPackaging events (${result.packaging.length}):`);
  result.packaging.forEach((p: any, i: number) =>
    console.log(`  [${i}] ${p.packagingId} (ref ${p.packageRef}) by ${p.packager}`)
  );

  console.log(`\nCustody history (${result.custody.length}):`);
  result.custody.forEach((c: any, i: number) =>
    console.log(`  [${i}] ${c.from} -> ${c.to} at ${new Date(Number(c.timestamp) * 1000).toISOString()}`)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
