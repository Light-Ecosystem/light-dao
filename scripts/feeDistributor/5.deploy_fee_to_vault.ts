import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";


/**
 * deploy SwapFeeToVault
 */
async function main() {

  let burnerManager = FileUtils.getContractAddress(Constants.BurnerManager);
  let underlyingBurner = FileUtils.getContractAddress(Constants.UnderlyingBurner);

  //deloy SwapFeeToVault  contract
  const SwapFeeToVault = await ethers.getContractFactory("SwapFeeToVault");
  const swapFeeToVault = await SwapFeeToVault.deploy(burnerManager, underlyingBurner);
  await swapFeeToVault.deployed();
  console.log("swapFeeToVault: ", swapFeeToVault.address);
  FileUtils.saveFrontendFiles(swapFeeToVault.address, "SwapFeeToVault", Constants.SwapFeeToVault);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
