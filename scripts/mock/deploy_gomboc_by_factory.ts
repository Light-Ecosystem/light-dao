import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * deploy PoolGomboc contract by GombocFactory
 */
async function main() {

  // mock lp token
  let mockLPToken = FileUtils.getContractAddress(Constants.LP_TOKEN_MOCK);

  let gombocFactoryAddress = FileUtils.getContractAddress(Constants.GOMBOC_FACTORY);
  console.log(gombocFactoryAddress)
  const gombocFactory = await ethers.getContractAt("GombocFactory", gombocFactoryAddress);

  // deploy gomboc pool
  await gombocFactory.createPool(mockLPToken);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
