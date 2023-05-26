import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * deploy PoolGomboc contract by GombocFactory
 */
async function main() {

  // todo
  let pairs = [
    "0x00000",
  ];

  let gauageFactoryAddress = FileUtils.getContractAddress(Constants.GAUGE_FACTORY);
  console.log("FactoryAddress: ", gauageFactoryAddress);
  const gaugeFactory = await ethers.getContractAt("GaugeFactory", gauageFactoryAddress);

  for (let pairAddress of pairs) {
    // crate gauge pool
    let tx  = await gaugeFactory.createPool(pairAddress);
    await tx.wait(1)
  }

  for (let pairAddress of pairs) {
    // get gauge pool
    console.log(`pair: ${pairAddress}  ,  gauge: ${await gaugeFactory.getPool(pairAddress)}`)
  }


  //crate gauge pool
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});