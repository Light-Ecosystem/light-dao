import { ethers } from "hardhat";
import { Constants } from "../constant";
import { FileUtils } from "../file_utils";

async function main() {
  const feeDistributor = await ethers.getContractAt("FeeDistributor", FileUtils.getContractAddress(Constants.FeeDistributor));
  const gaugeFeeDistributor = await ethers.getContractAt("GaugeFeeDistributor", FileUtils.getContractAddress(Constants.GaugeFeeDistributor));

  await feeDistributor.toggleAllowCheckpointToken();
  await gaugeFeeDistributor.toggleAllowCheckpointToken();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});