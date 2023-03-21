import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * deploy PoolGomboc contract by GombocFactory
 */
async function main() {

  // todo
  let pairAddress = "0x01";

  let gauageFactoryAddress = FileUtils.getContractAddress(Constants.GAUGE_FACTORY);
  console.log(gauageFactoryAddress);
  const gaugeFactory = await ethers.getContractAt("GaugeFactory", gauageFactoryAddress);

  //crate gauge pool
  let tx = await gaugeFactory.createPool(pairAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});