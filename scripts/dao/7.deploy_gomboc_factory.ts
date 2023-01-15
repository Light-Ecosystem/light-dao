import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";


/**
 * deploy Gomboc factory contract
 */
async function main() {
  const GombocFactory = await ethers.getContractFactory("GombocFactory");
  const gombocFactory = await GombocFactory.deploy();
  await gombocFactory.deployed();
  console.log("GombocFactory address is", gombocFactory.address);
  FileUtils.saveFrontendFiles(gombocFactory.address, "GombocFactory", Constants.GOMBOC_FACTORY);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
