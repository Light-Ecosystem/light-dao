import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * deploy PoolGomboc contract by GombocFactory
 */
async function main() {

  // todo
  let pair0 = "0x01";
  let pair1 = "0x02";

  let gauageFactoryAddress = FileUtils.getContractAddress(Constants.GAUGE_FACTORY);
  console.log(gauageFactoryAddress);
  const gaugeFactory = await ethers.getContractAt("GaugeFactory", gauageFactoryAddress);

  //crate gauge pool
  await gaugeFactory.createPool(pair0);
  await gaugeFactory.createPool(pair1);

  console.log("pair0: ", await gaugeFactory.getPool(pair0));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});