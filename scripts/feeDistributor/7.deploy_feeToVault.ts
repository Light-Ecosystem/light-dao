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
  const feeToVault = await upgrades.deployProxy(FeeToVault, [burnerManager, underlyingBurner]);
  await feeToVault.deployed();
  console.log("FeeToVault: ", feeToVault.address);
  FileUtils.saveFrontendFiles(feeToVault.address, "FeeToVault", Constants.FeeToVault);

  // deploy new HopeSwapBurner
  const HopeSwapBurner = await ethers.getContractFactory("HopeSwapBurner");
  const hopeSwapBurner = await HopeSwapBurner.deploy(HOPE, feeToVault.address);
  await hopeSwapBurner.deployed();
  console.log("new HopeSwapBurner: ", hopeSwapBurner.address);
  FileUtils.saveFrontendFiles(hopeSwapBurner.address, "NewHopeSwapBurner", Constants.NewHopeSwapBurner);

  // reset burner for HOPE
  const burnerManagerInstance = await ethers.getContractAt("BurnerManager", burnerManager);
  await burnerManagerInstance.setBurner(HOPE, hopeSwapBurner.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
