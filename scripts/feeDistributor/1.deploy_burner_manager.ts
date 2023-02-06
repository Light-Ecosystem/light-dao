import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";


/**
 * deploy BurnerManager
 */
async function main() {

  //deloy BurnerManager  contract
  const BurnerManager = await ethers.getContractFactory("BurnerManager");
  const burnerManager = await BurnerManager.deploy();
  await burnerManager.deployed();
  console.log("burnerManager: ", burnerManager.address);
  FileUtils.saveFrontendFiles(burnerManager.address, "BurnerManager", Constants.BurnerManager);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
