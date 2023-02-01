import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";


/**
 * deploy Gomboc factory contract
 */
async function main() {
  let minter = FileUtils.getContractAddress(Constants.LT_MINTER);
  let permit2 = FileUtils.getContractAddress(Constants.PERMIT2);

  const GombocFactory = await ethers.getContractFactory("GombocFactory");
  const gombocFactory = await GombocFactory.deploy(minter, permit2, { "gasLimit": 4100000 });
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
