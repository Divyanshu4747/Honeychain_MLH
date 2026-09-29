import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Seeds a realistic demo scenario matching the HoneyChain example:
 *   Batch: HNY-2026-0001, Hive HIVE-042, Rural Cluster A, 18.4kg, PASS @ 17.2% moisture
 *   Supply chain: Beekeeper -> KVIC Aggregator (DISTRIBUTOR_ROLE) -> Processor -> Distributor -> Retailer
 *
 * If deployments/<network>.json already exists, attaches to that contract.
 * Otherwise deploys a fresh instance first (convenient for a one-shot local demo).
 */
async function main() {
  const [admin, beekeeper, lab, kvicAggregator, processor, distributor, retailer] =
    await ethers.getSigners();

  const honeyChain = await getOrDeployContract(admin.address);

  console.log("Granting demo roles...");
  const [ADMIN_ROLE, BEEKEEPER_ROLE, LAB_ROLE, PROCESSOR_ROLE, DISTRIBUTOR_ROLE, RETAILER_ROLE] =
    await Promise.all([
      honeyChain.ADMIN_ROLE(),
      honeyChain.BEEKEEPER_ROLE(),
      honeyChain.LAB_ROLE(),
      honeyChain.PROCESSOR_ROLE(),
      honeyChain.DISTRIBUTOR_ROLE(),
      honeyChain.RETAILER_ROLE(),
    ]);

  await (await honeyChain.connect(admin).grantRole(BEEKEEPER_ROLE, beekeeper.address)).wait();
  await (await honeyChain.connect(admin).grantRole(LAB_ROLE, lab.address)).wait();
  // "KVIC Aggregator" is mapped onto DISTRIBUTOR_ROLE -- see docs/smart-contract.md.
  await (await honeyChain.connect(admin).grantRole(DISTRIBUTOR_ROLE, kvicAggregator.address)).wait();
  await (await honeyChain.connect(admin).grantRole(PROCESSOR_ROLE, processor.address)).wait();
  await (await honeyChain.connect(admin).grantRole(DISTRIBUTOR_ROLE, distributor.address)).wait();
  await (await honeyChain.connect(admin).grantRole(RETAILER_ROLE, retailer.address)).wait();

  const batchId = "HNY-2026-0001";
  console.log(`Creating demo batch ${batchId}...`);
  await (
    await honeyChain
      .connect(beekeeper)
      .createBatch(
        batchId,
        "HIVE-042",
        18_400, // 18.4 kg in grams
        0,
        "Rural-Cluster-A",
        "",
        ethers.ZeroHash
      )
  ).wait();

  console.log("Submitting lab quality test (PASS, 17.2% moisture, demo sucrose value)...");
  const demoCertificateCID = "bafybeigdyrztzhx4o3xhmybugvcanuszwcz6q7f3z6ne4ll5o3npbz5s4"; // placeholder demo CID
  await (
    await honeyChain.connect(lab).addQualityTest(
      batchId,
      1720, // 17.2%
      3250, // 32.5% -- representative demo sucrose value
      true,
      demoCertificateCID,
      ethers.ZeroHash
    )
  ).wait();

  console.log("Running supply chain: Beekeeper -> KVIC Aggregator -> Processor -> Distributor -> Retailer...");
  await (await honeyChain.connect(beekeeper).transferBatch(batchId, kvicAggregator.address)).wait();
  await (await honeyChain.connect(kvicAggregator).transferBatch(batchId, processor.address)).wait();
  await (await honeyChain.connect(processor).recordProcessing(batchId, "extraction-and-filtering", "")).wait();
  await (
    await honeyChain.connect(processor).recordPackaging(batchId, "PKG-2026-0001", "LOT-2026-01", "")
  ).wait();
  await (await honeyChain.connect(processor).transferBatch(batchId, distributor.address)).wait();
  await (await honeyChain.connect(distributor).transferBatch(batchId, retailer.address)).wait();

  console.log("\nDemo data seeded successfully.");
  console.log(`Verification URL for QR encoding: /verify/${batchId}`);

  const result = await honeyChain.verifyBatch(batchId);
  console.log("\nverifyBatch() result:");
  console.log(`  status: ${result.found ? "VERIFIED" : "NOT_FOUND"}`);
  console.log(`  currentOwner (retailer): ${result.batch.currentOwner}`);
  console.log(`  qualityStatus: ${["Pending", "Pass", "Fail"][Number(result.batch.qualityStatus)]}`);
  console.log(`  custody transfers recorded: ${result.custody.length}`);

  const rolesFile = path.join(__dirname, "..", "deployments", `${network.name}-demo-accounts.json`);
  fs.writeFileSync(
    rolesFile,
    JSON.stringify(
      {
        admin: admin.address,
        beekeeper: beekeeper.address,
        lab: lab.address,
        kvicAggregator: kvicAggregator.address,
        processor: processor.address,
        distributor: distributor.address,
        retailer: retailer.address,
        demoBatchId: batchId,
      },
      null,
      2
    )
  );
  console.log(`\nDemo account addresses written to ${rolesFile}`);
}

async function getOrDeployContract(adminAddress: string) {
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (fs.existsSync(deploymentFile)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
    console.log(`Attaching to existing HoneyChain deployment at ${deployment.address}`);
    return ethers.getContractAt("HoneyChain", deployment.address);
  }

  console.log("No existing deployment found -- deploying a fresh HoneyChain instance for the demo...");
  const HoneyChainFactory = await ethers.getContractFactory("HoneyChain");
  const honeyChain = await HoneyChainFactory.deploy(adminAddress);
  await honeyChain.waitForDeployment();
  console.log(`Deployed HoneyChain at ${await honeyChain.getAddress()}`);
  return honeyChain;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
