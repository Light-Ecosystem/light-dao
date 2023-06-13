import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";


/**
 * deploy FeeToVault
 */
async function main() {

  // set address first
  let HOPE = FileUtils.getContractAddress(Constants.HOPE_TOKEN);
  let burnerManager = FileUtils.getContractAddress(Constants.BurnerManager);
  let underlyingBurner = FileUtils.getContractAddress(Constants.UnderlyingBurner);

  //deloy FeeToVault  contract
  const FeeToVault = await ethers.getContractFactory("FeeToVault");
  const feeToVault = await upgrades.deployProxy(FeeToVault, [burnerManager, underlyingBurner, HOPE]);
  await feeToVault.deployed();
  console.log("FeeToVault: ", feeToVault.address);
  FileUtils.saveFrontendFiles(feeToVault.address, "FeeToVault", Constants.FeeToVault);

  // deploy new SwapBurner
  const SwapBurner = await ethers.getContractFactory("SwapBurner");
  const swapBurner = await SwapBurner.deploy(HOPE, feeToVault.address);
  await swapBurner.deployed();
  console.log("SwapBurner: ", swapBurner.address);
  FileUtils.saveFrontendFiles(swapBurner.address, "SwapBurner", Constants.SwapBurner);

  // reset burner for tokens,  hope does not need to set
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
