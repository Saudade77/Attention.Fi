const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. Deploy MockUSDC
  console.log("\n1. Deploying MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("   MockUSDC:", usdcAddress);

  // 2. Deploy PredictionMarketV2
  console.log("\n2. Deploying PredictionMarketV2...");
  const PredictionMarket = await hre.ethers.getContractFactory("PredictionMarketV2");
  const predictionMarket = await PredictionMarket.deploy(usdcAddress);
  await predictionMarket.waitForDeployment();
  const predictionAddress = await predictionMarket.getAddress();
  console.log("   PredictionMarketV2:", predictionAddress);

  // 3. Deploy CreatorMarketV2
  console.log("\n3. Deploying CreatorMarketV2...");
  const CreatorMarket = await hre.ethers.getContractFactory("CreatorMarketV2");
  const creatorMarket = await CreatorMarket.deploy(usdcAddress);
  await creatorMarket.waitForDeployment();
  const creatorAddress = await creatorMarket.getAddress();
  console.log("   CreatorMarketV2:", creatorAddress);

  // 4. Save addresses
  const addresses = {
    MockUSDC: usdcAddress,
    PredictionMarketV2: predictionAddress,
    CreatorMarketV2: creatorAddress,
    deployer: deployer.address,
    network: hre.network.name,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify(addresses, null, 2)
  );

  console.log("\n✅ All contracts deployed!");
  console.log("=====================================");
  console.log("MockUSDC:          ", usdcAddress);
  console.log("PredictionMarketV2:", predictionAddress);
  console.log("CreatorMarketV2:   ", creatorAddress);
  console.log("=====================================");
  console.log("\n📝 Update frontend/src/constants/config.ts with these addresses!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});