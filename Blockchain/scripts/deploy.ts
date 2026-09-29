import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const HoneyChain = await ethers.getContractFactory("HoneyChain");
  const contract = await HoneyChain.deploy(deployer.address);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("HoneyChain deployed to:", address);

  const destDir = path.join(__dirname, "../../backend/src/config");
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, "contract-address.json"), JSON.stringify({ contractAddress: address }));

  const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts/contracts/HoneyChain.sol/HoneyChain.json"), "utf-8"));
  fs.writeFileSync(path.join(destDir, "HoneyChainABI.json"), JSON.stringify(artifact.abi, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
