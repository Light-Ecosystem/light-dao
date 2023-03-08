import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * add Gauges
 */
async function main() {
  // let stakingHopeGaugeAddress = FileUtils.getContractAddress(Constants.STAKING_HOPE_GAUGE);
  //let poolGaugeAddress = FileUtils.getContractAddress(Constants.POOL_GAUGE);

  let gaugeControllerAddress = FileUtils.getContractAddress(Constants.GAUGE_CONTROLLER);
  const gaugeController = await ethers.getContractAt("GaugeController", gaugeControllerAddress);

  let name = "LT Staking Type";
  let weight = ethers.utils.parseEther("1");
  let typeId = await gaugeController.nGaugeTypes();
  await gaugeController.addType(name, weight);

  let gaugeWeight = ethers.utils.parseEther("1");
  // await gaugeController.addGauge(stakingHopeGaugeAddress, typeId, gaugeWeight);
  //await gaugeController.addGauge(poolGaugeAddress, typeId, gaugeWeight);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
