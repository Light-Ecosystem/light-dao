import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";


/**
 * deploy Gauge factory contract
 */
async function main() {
  let poolGauge = FileUtils.getContractAddress(Constants.POOL_GAUGE);
  let minter = FileUtils.getContractAddress(Constants.LT_MINTER);
  let permit2 = FileUtils.getContractAddress(Constants.PERMIT2);

  const GaugeFactory = await ethers.getContractFactory("GaugeFactory");
  const gaugeFactory = await GaugeFactory.deploy(poolGauge, minter, permit2);
  await gaugeFactory.deployed();
  console.log("GaugeFactory address is", gaugeFactory.address);
  FileUtils.saveFrontendFiles(gaugeFactory.address, "GaugeFactory", Constants.GAUGE_FACTORY);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
