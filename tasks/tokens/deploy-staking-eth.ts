import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
task(`deploy-staking-eth`, `Deploys stETH`).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }

  const StETH = await hre.ethers.getContractFactory("StETH");
  const stETH = await StETH.deploy();
  await stETH.deployed();
  console.log(`- stETH deployed: `, stETH.address);
  FileUtils.saveFrontendFiles(stETH.address, "StETH", "stETH");
});
