import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * deploy PoolGauge contract by GaugeFactory
 */
async function main() {

  // mock lp token
  let mockLPToken = FileUtils.getContractAddress(Constants.LP_TOKEN_MOCK);

  let gaugeFactoryAddress = FileUtils.getContractAddress(Constants.GAUGE_FACTORY);
  console.log(gaugeFactoryAddress)
  const gaugeFactory = await ethers.getContractAt("GaugeFactory", gaugeFactoryAddress);

  // deploy gauge pool
  await gaugeFactory.createPool(mockLPToken);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
