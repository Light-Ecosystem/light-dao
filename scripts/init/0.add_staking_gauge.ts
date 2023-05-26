import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * add staking hope Gauges
 */
async function main() {
  let stakingHopeGaugeAddress = FileUtils.getContractAddress(Constants.STAKING_HOPE_GAUGE);

  let gaugeControllerAddress = FileUtils.getContractAddress(Constants.GAUGE_CONTROLLER);
  const gaugeController = await ethers.getContractAt("GaugeController", gaugeControllerAddress);

  // create Hope Staking type
  let name = "Hope Staking";
  let weight = ethers.utils.parseEther("1");
  let typeId = await gaugeController.nGaugeTypes();
  let tx = await gaugeController.addType(name, weight);
  await tx.wait(1);

  // add Gauge of HopeStaking
  let gaugeWeight = ethers.utils.parseEther("0");
  tx = await gaugeController.addGauge(stakingHopeGaugeAddress, typeId, gaugeWeight);
  await tx.wait(1);

  // create Hope swap type
  name = "Hope Swap";
  tx = await gaugeController.addType(name, weight);
  await tx.wait(1);


}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
