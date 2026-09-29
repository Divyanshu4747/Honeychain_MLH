const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying HoneyChain using account:", deployer.address);

  const HoneyChain = await hre.ethers.getContractFactory("HoneyChain");
  const contract = await HoneyChain.deploy(deployer.address);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("HoneyChain deployed successfully to:", contractAddress);

  const configDir = path.join(__dirname, "../../backend/src/config");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(configDir, "contract-address.json"),
    JSON.stringify({ contractAddress }, null, 2)
  );

  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/HoneyChain.sol/HoneyChain.json"
  );
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    fs.writeFileSync(
      path.join(configDir, "HoneyChainABI.json"),
      JSON.stringify(artifact.abi, null, 2)
    );
    console.log("Exported ABI and contract address to backend/src/config/");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
