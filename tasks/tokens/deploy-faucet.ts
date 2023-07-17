import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";

task(`deploy-faucet`, `Deploys Faucet`).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }

  const Faucet = await hre.ethers.getContractFactory("Faucet");
  const faucet = await Faucet.deploy();
  await faucet.deployed();
  console.log("- Faucet deployed: ", faucet.address);
  FileUtils.saveFrontendFiles(faucet.address, "Faucet", "Faucet");
});
