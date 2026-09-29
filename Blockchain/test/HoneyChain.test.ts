import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { HoneyChain } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const BATCH_ID = "HNY-2026-0001";
const HIVE_ID = "HIVE-042";
const QTY_GRAMS = 18_400; // 18.4 kg
const ORIGIN_CLUSTER = "Rural-Cluster-A";
const CID_A = "bafybeigdyrztzhx4o3xhmybugvcanuszwcz6q7f3z6ne4ll5o3npbz5s4"; // sample CID, not a real file
const CID_B = "bafybeih7rny5su2u4jrdikwq2sy2etp3mm4msxsz5xgvz6q2c4bmyi5dy";

/** Events index `keccak256(bytes(batchId))`, not the raw string -- see HoneyChain.sol. */
function batchIdHash(batchId: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(batchId));
}

async function deployFixture() {
  const [admin, beekeeper, lab, processor, distributor, retailer, otherLab, stranger] =
    await ethers.getSigners();

  const HoneyChainFactory = await ethers.getContractFactory("HoneyChain");
  const honeyChain = (await HoneyChainFactory.deploy(admin.address)) as unknown as HoneyChain;
  await honeyChain.waitForDeployment();

  const ADMIN_ROLE = await honeyChain.ADMIN_ROLE();
  const BEEKEEPER_ROLE = await honeyChain.BEEKEEPER_ROLE();
  const LAB_ROLE = await honeyChain.LAB_ROLE();
  const PROCESSOR_ROLE = await honeyChain.PROCESSOR_ROLE();
  const DISTRIBUTOR_ROLE = await honeyChain.DISTRIBUTOR_ROLE();
  const RETAILER_ROLE = await honeyChain.RETAILER_ROLE();

  // Admin grants operational roles to the demo participants.
  await honeyChain.connect(admin).grantRole(BEEKEEPER_ROLE, beekeeper.address);
  await honeyChain.connect(admin).grantRole(LAB_ROLE, lab.address);
  await honeyChain.connect(admin).grantRole(PROCESSOR_ROLE, processor.address);
  await honeyChain.connect(admin).grantRole(DISTRIBUTOR_ROLE, distributor.address);
  await honeyChain.connect(admin).grantRole(RETAILER_ROLE, retailer.address);

  return {
    honeyChain,
    admin,
    beekeeper,
    lab,
    processor,
    distributor,
    retailer,
    otherLab,
    stranger,
    roles: { ADMIN_ROLE, BEEKEEPER_ROLE, LAB_ROLE, PROCESSOR_ROLE, DISTRIBUTOR_ROLE, RETAILER_ROLE },
  };
}

async function createDemoBatch(
  honeyChain: HoneyChain,
  beekeeper: HardhatEthersSigner,
  batchId: string = BATCH_ID
) {
  await honeyChain
    .connect(beekeeper)
    .createBatch(batchId, HIVE_ID, QTY_GRAMS, 0, ORIGIN_CLUSTER, "", ethers.ZeroHash);
}

describe("HoneyChain", () => {
  // -----------------------------------------------------------------------
  describe("Deployment & role administration", () => {
    it("deploys and assigns DEFAULT_ADMIN_ROLE and ADMIN_ROLE to the deployer-specified admin", async () => {
      const { honeyChain, admin, roles } = await deployFixture();
      const DEFAULT_ADMIN_ROLE = await honeyChain.DEFAULT_ADMIN_ROLE();
      expect(await honeyChain.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
      expect(await honeyChain.hasRole(roles.ADMIN_ROLE, admin.address)).to.equal(true);
    });

    it("reverts deployment if the admin address is the zero address", async () => {
      const HoneyChainFactory = await ethers.getContractFactory("HoneyChain");
      await expect(HoneyChainFactory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        HoneyChainFactory,
        "InvalidNewOwner"
      );
    });

    it("lets ADMIN_ROLE grant supply-chain roles", async () => {
      const { honeyChain, beekeeper, roles } = await deployFixture();
      expect(await honeyChain.hasRole(roles.BEEKEEPER_ROLE, beekeeper.address)).to.equal(true);
    });

    it("lets ADMIN_ROLE revoke supply-chain roles", async () => {
      const { honeyChain, admin, beekeeper, roles } = await deployFixture();
      await honeyChain.connect(admin).revokeRole(roles.BEEKEEPER_ROLE, beekeeper.address);
      expect(await honeyChain.hasRole(roles.BEEKEEPER_ROLE, beekeeper.address)).to.equal(false);
    });

    it("emits RoleGranted / RoleRevoked events", async () => {
      const { honeyChain, admin, stranger, roles } = await deployFixture();
      await expect(honeyChain.connect(admin).grantRole(roles.LAB_ROLE, stranger.address))
        .to.emit(honeyChain, "RoleGranted")
        .withArgs(roles.LAB_ROLE, stranger.address, admin.address);

      await expect(honeyChain.connect(admin).revokeRole(roles.LAB_ROLE, stranger.address))
        .to.emit(honeyChain, "RoleRevoked")
        .withArgs(roles.LAB_ROLE, stranger.address, admin.address);
    });

    it("prevents a non-admin from granting roles", async () => {
      const { honeyChain, stranger, beekeeper, roles } = await deployFixture();
      await expect(honeyChain.connect(stranger).grantRole(roles.LAB_ROLE, beekeeper.address)).to.be
        .reverted;
    });
  });

  // -----------------------------------------------------------------------
  describe("Batch creation", () => {
    it("allows an authorized beekeeper to create a batch and emits BatchCreated", async () => {
      const { honeyChain, beekeeper } = await deployFixture();

      const tx = await honeyChain
        .connect(beekeeper)
        .createBatch(BATCH_ID, HIVE_ID, QTY_GRAMS, 0, ORIGIN_CLUSTER, "", ethers.ZeroHash);

      await expect(tx)
        .to.emit(honeyChain, "BatchCreated")
        .withArgs(
          batchIdHash(BATCH_ID),
          BATCH_ID,
          beekeeper.address,
          HIVE_ID,
          QTY_GRAMS,
          (await tx.getBlock())?.timestamp ?? 0n
        );

      const batch = await honeyChain.getBatch(BATCH_ID);
      expect(batch.beekeeper).to.equal(beekeeper.address);
      expect(batch.currentOwner).to.equal(beekeeper.address);
      expect(batch.hiveId).to.equal(HIVE_ID);
      expect(batch.harvestQuantityGrams).to.equal(QTY_GRAMS);
      expect(batch.status).to.equal(0); // BatchStatus.Harvested
      expect(batch.qualityStatus).to.equal(0); // QualityStatus.Pending
      expect(batch.exists).to.equal(true);
    });

    it("rejects batch creation from an unauthorized (non-beekeeper) account", async () => {
      const { honeyChain, stranger } = await deployFixture();
      await expect(
        honeyChain
          .connect(stranger)
          .createBatch(BATCH_ID, HIVE_ID, QTY_GRAMS, 0, ORIGIN_CLUSTER, "", ethers.ZeroHash)
      ).to.be.reverted;
    });

    it("prevents duplicate batch IDs", async () => {
      const { honeyChain, beekeeper } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);
      await expect(createDemoBatch(honeyChain, beekeeper)).to.be.revertedWithCustomError(
        honeyChain,
        "BatchAlreadyExists"
      );
    });

    it("rejects an invalid (zero) harvest quantity", async () => {
      const { honeyChain, beekeeper } = await deployFixture();
      await expect(
        honeyChain
          .connect(beekeeper)
          .createBatch(BATCH_ID, HIVE_ID, 0, 0, ORIGIN_CLUSTER, "", ethers.ZeroHash)
      ).to.be.revertedWithCustomError(honeyChain, "InvalidQuantity");
    });

    it("rejects an empty batchId, hiveId, or originClusterId", async () => {
      const { honeyChain, beekeeper } = await deployFixture();
      await expect(
        honeyChain
          .connect(beekeeper)
          .createBatch("", HIVE_ID, QTY_GRAMS, 0, ORIGIN_CLUSTER, "", ethers.ZeroHash)
      ).to.be.revertedWithCustomError(honeyChain, "EmptyIdentifier");

      await expect(
        honeyChain
          .connect(beekeeper)
          .createBatch(BATCH_ID, "", QTY_GRAMS, 0, ORIGIN_CLUSTER, "", ethers.ZeroHash)
      ).to.be.revertedWithCustomError(honeyChain, "EmptyIdentifier");

      await expect(
        honeyChain
          .connect(beekeeper)
          .createBatch(BATCH_ID, HIVE_ID, QTY_GRAMS, 0, "", "", ethers.ZeroHash)
      ).to.be.revertedWithCustomError(honeyChain, "EmptyIdentifier");
    });
  });

  // -----------------------------------------------------------------------
  describe("Quality testing", () => {
    it("allows an authorized lab to submit a quality test and emits QualityTestAdded", async () => {
      const { honeyChain, beekeeper, lab } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);

      await expect(honeyChain.connect(lab).addQualityTest(BATCH_ID, 1720, 3200, true, CID_A, ethers.ZeroHash))
        .to.emit(honeyChain, "QualityTestAdded")
        .withArgs(batchIdHash(BATCH_ID), BATCH_ID, lab.address, 1, CID_A, anyValue); // QualityStatus.Pass == 1

      const batch = await honeyChain.getBatch(BATCH_ID);
      expect(batch.qualityStatus).to.equal(1); // Pass
      expect(batch.latestCertificateCID).to.equal(CID_A);
      expect(batch.status).to.equal(1); // QualityTested

      const tests = await honeyChain.getQualityTests(BATCH_ID);
      expect(tests.length).to.equal(1);
      expect(tests[0].lab).to.equal(lab.address);
      expect(tests[0].moistureContentBps).to.equal(1720);
    });

    it("rejects quality test submission from an unauthorized (non-lab) account", async () => {
      const { honeyChain, beekeeper } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);
      await expect(
        honeyChain.connect(beekeeper).addQualityTest(BATCH_ID, 1720, 3200, true, CID_A, ethers.ZeroHash)
      ).to.be.reverted;
    });

    it("reverts when submitting a quality test for a nonexistent batch", async () => {
      const { honeyChain, lab } = await deployFixture();
      await expect(
        honeyChain.connect(lab).addQualityTest("NO-SUCH-BATCH", 1720, 3200, true, CID_A, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(honeyChain, "BatchDoesNotExist");
    });

    it("records a FAIL result correctly", async () => {
      const { honeyChain, beekeeper, lab } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);
      await honeyChain.connect(lab).addQualityTest(BATCH_ID, 2500, 1000, false, CID_A, ethers.ZeroHash);
      const batch = await honeyChain.getBatch(BATCH_ID);
      expect(batch.qualityStatus).to.equal(2); // Fail
    });

    it("supports multiple quality tests (e.g. a retest) and keeps the latest certificate CID", async () => {
      const { honeyChain, beekeeper, lab, otherLab, admin, roles } = await deployFixture();
      await honeyChain.connect(admin).grantRole(roles.LAB_ROLE, otherLab.address);
      await createDemoBatch(honeyChain, beekeeper);

      await honeyChain.connect(lab).addQualityTest(BATCH_ID, 2500, 1000, false, CID_A, ethers.ZeroHash);
      await honeyChain.connect(otherLab).addQualityTest(BATCH_ID, 1700, 3200, true, CID_B, ethers.ZeroHash);

      const tests = await honeyChain.getQualityTests(BATCH_ID);
      expect(tests.length).to.equal(2);

      const batch = await honeyChain.getBatch(BATCH_ID);
      expect(batch.qualityStatus).to.equal(1); // latest result: Pass
      expect(batch.latestCertificateCID).to.equal(CID_B);
    });
  });

  // -----------------------------------------------------------------------
  describe("Custody transfer", () => {
    it("allows the current custodian to transfer to an authorized participant and emits BatchTransferred", async () => {
      const { honeyChain, beekeeper, distributor } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);

      await expect(honeyChain.connect(beekeeper).transferBatch(BATCH_ID, distributor.address))
        .to.emit(honeyChain, "BatchTransferred")
        .withArgs(batchIdHash(BATCH_ID), BATCH_ID, beekeeper.address, distributor.address, anyValue);

      const batch = await honeyChain.getBatch(BATCH_ID);
      expect(batch.currentOwner).to.equal(distributor.address);

      const history = await honeyChain.getCustodyHistory(BATCH_ID);
      expect(history.length).to.equal(1);
      expect(history[0].from).to.equal(beekeeper.address);
      expect(history[0].to).to.equal(distributor.address);
    });

    it("rejects a transfer initiated by someone other than the current custodian", async () => {
      const { honeyChain, beekeeper, distributor, stranger } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);
      await expect(
        honeyChain.connect(stranger).transferBatch(BATCH_ID, distributor.address)
      ).to.be.revertedWithCustomError(honeyChain, "NotCurrentCustodian");
    });

    it("rejects a transfer to an address with no recognized supply-chain role", async () => {
      const { honeyChain, beekeeper, stranger } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);
      await expect(
        honeyChain.connect(beekeeper).transferBatch(BATCH_ID, stranger.address)
      ).to.be.revertedWithCustomError(honeyChain, "RecipientMissingSupplyChainRole");
    });

    it("rejects transferring to the zero address", async () => {
      const { honeyChain, beekeeper } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);
      await expect(
        honeyChain.connect(beekeeper).transferBatch(BATCH_ID, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(honeyChain, "InvalidNewOwner");
    });

    it("rejects transferring to the same current owner", async () => {
      const { honeyChain, beekeeper, distributor } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);
      await honeyChain.connect(beekeeper).transferBatch(BATCH_ID, distributor.address);
      await expect(
        honeyChain.connect(distributor).transferBatch(BATCH_ID, distributor.address)
      ).to.be.revertedWithCustomError(honeyChain, "SameOwnerTransfer");
    });

    it("marks the batch AtRetailer once transferred to a retailer", async () => {
      const { honeyChain, beekeeper, distributor, retailer } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);
      await honeyChain.connect(beekeeper).transferBatch(BATCH_ID, distributor.address);
      await honeyChain.connect(distributor).transferBatch(BATCH_ID, retailer.address);
      const batch = await honeyChain.getBatch(BATCH_ID);
      expect(batch.currentOwner).to.equal(retailer.address);
      expect(batch.status).to.equal(5); // BatchStatus.AtRetailer
    });

    it("reverts a transfer for a nonexistent batch ID", async () => {
      const { honeyChain, distributor, beekeeper } = await deployFixture();
      await expect(
        honeyChain.connect(beekeeper).transferBatch("NO-SUCH-BATCH", distributor.address)
      ).to.be.revertedWithCustomError(honeyChain, "BatchDoesNotExist");
    });
  });

  // -----------------------------------------------------------------------
  describe("Processing & packaging", () => {
    it("allows the current-custodian processor to record a processing event", async () => {
      const { honeyChain, beekeeper, processor } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);
      await honeyChain.connect(beekeeper).transferBatch(BATCH_ID, processor.address);

      await expect(honeyChain.connect(processor).recordProcessing(BATCH_ID, "extraction", ""))
        .to.emit(honeyChain, "ProcessingRecorded")
        .withArgs(batchIdHash(BATCH_ID), BATCH_ID, processor.address, "extraction", anyValue);

      const batch = await honeyChain.getBatch(BATCH_ID);
      expect(batch.status).to.equal(2); // Processed

      const events = await honeyChain.getProcessingEvents(BATCH_ID);
      expect(events.length).to.equal(1);
      expect(events[0].processType).to.equal("extraction");
    });

    it("rejects a processing record from a processor who is not the current custodian", async () => {
      const { honeyChain, beekeeper, processor, admin, roles } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);
      // processor never received custody
      await expect(
        honeyChain.connect(processor).recordProcessing(BATCH_ID, "extraction", "")
      ).to.be.revertedWithCustomError(honeyChain, "NotCurrentCustodian");
    });

    it("rejects a processing record from an account without PROCESSOR_ROLE", async () => {
      const { honeyChain, beekeeper, distributor } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);
      await honeyChain.connect(beekeeper).transferBatch(BATCH_ID, distributor.address);
      await expect(
        honeyChain.connect(distributor).recordProcessing(BATCH_ID, "extraction", "")
      ).to.be.reverted;
    });

    it("allows the current-custodian processor to record a packaging event", async () => {
      const { honeyChain, beekeeper, processor } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);
      await honeyChain.connect(beekeeper).transferBatch(BATCH_ID, processor.address);
      await honeyChain.connect(processor).recordProcessing(BATCH_ID, "extraction", "");

      await expect(
        honeyChain.connect(processor).recordPackaging(BATCH_ID, "PKG-001", "LOT-2026-01", "")
      )
        .to.emit(honeyChain, "PackagingRecorded")
        .withArgs(batchIdHash(BATCH_ID), BATCH_ID, "PKG-001", anyValue);

      const batch = await honeyChain.getBatch(BATCH_ID);
      expect(batch.status).to.equal(3); // Packaged

      const events = await honeyChain.getPackagingEvents(BATCH_ID);
      expect(events.length).to.equal(1);
      expect(events[0].packagingId).to.equal("PKG-001");
    });

    it("reverts processing/packaging for a nonexistent batch ID", async () => {
      const { honeyChain, processor } = await deployFixture();
      await expect(
        honeyChain.connect(processor).recordProcessing("NO-SUCH-BATCH", "extraction", "")
      ).to.be.revertedWithCustomError(honeyChain, "BatchDoesNotExist");
      await expect(
        honeyChain.connect(processor).recordPackaging("NO-SUCH-BATCH", "PKG-001", "LOT", "")
      ).to.be.revertedWithCustomError(honeyChain, "BatchDoesNotExist");
    });
  });

  // -----------------------------------------------------------------------
  describe("Consumer verification & reads", () => {
    it("verifyBatch returns found=false for a nonexistent batch (NOT FOUND case)", async () => {
      const { honeyChain } = await deployFixture();
      const result = await honeyChain.verifyBatch("NO-SUCH-BATCH");
      expect(result.found).to.equal(false);
    });

    it("verifyBatch returns the full reconstructable timeline for a real batch (VERIFIED case)", async () => {
      const { honeyChain, beekeeper, lab, processor, distributor, retailer } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);
      await honeyChain.connect(lab).addQualityTest(BATCH_ID, 1720, 3200, true, CID_A, ethers.ZeroHash);
      await honeyChain.connect(beekeeper).transferBatch(BATCH_ID, processor.address);
      await honeyChain.connect(processor).recordProcessing(BATCH_ID, "extraction", "");
      await honeyChain.connect(processor).recordPackaging(BATCH_ID, "PKG-001", "LOT-2026-01", "");
      await honeyChain.connect(processor).transferBatch(BATCH_ID, distributor.address);
      await honeyChain.connect(distributor).transferBatch(BATCH_ID, retailer.address);

      const result = await honeyChain.verifyBatch(BATCH_ID);
      expect(result.found).to.equal(true);
      expect(result.batch.currentOwner).to.equal(retailer.address);
      expect(result.tests.length).to.equal(1);
      expect(result.processing.length).to.equal(1);
      expect(result.packaging.length).to.equal(1);
      expect(result.custody.length).to.equal(2);
    });

    it("verifyDocumentHash correctly matches and mismatches a certificate hash", async () => {
      const { honeyChain, beekeeper, lab } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);
      const realHash = ethers.keccak256(ethers.toUtf8Bytes("certificate-file-bytes"));
      const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("tampered-file-bytes"));

      await honeyChain.connect(lab).addQualityTest(BATCH_ID, 1720, 3200, true, CID_A, realHash);

      expect(await honeyChain.verifyDocumentHash(BATCH_ID, realHash)).to.equal(true);
      expect(await honeyChain.verifyDocumentHash(BATCH_ID, wrongHash)).to.equal(false); // MISMATCH case
    });

    it("verifyDocumentHash returns false when no certificate hash was ever recorded", async () => {
      const { honeyChain, beekeeper } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper);
      expect(await honeyChain.verifyDocumentHash(BATCH_ID, ethers.ZeroHash)).to.equal(false);
    });

    it("getBatch reverts for a nonexistent batch ID (edge case)", async () => {
      const { honeyChain } = await deployFixture();
      await expect(honeyChain.getBatch("NO-SUCH-BATCH")).to.be.revertedWithCustomError(
        honeyChain,
        "BatchDoesNotExist"
      );
    });

    it("getAllBatchIds lists every created batch", async () => {
      const { honeyChain, beekeeper } = await deployFixture();
      await createDemoBatch(honeyChain, beekeeper, "HNY-2026-0001");
      await createDemoBatch(honeyChain, beekeeper, "HNY-2026-0002");
      const ids = await honeyChain.getAllBatchIds();
      expect(ids).to.deep.equal(["HNY-2026-0001", "HNY-2026-0002"]);
    });
  });
});

