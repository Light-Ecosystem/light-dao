import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * add staking hope Gombocs
 */
async function main() {
  let stakingHopeGombocAddress = FileUtils.getContractAddress(Constants.STAKING_HOPE_GOMBOC);

  let gombocControllerAddress = FileUtils.getContractAddress(Constants.GOMBOC_CONTROLLER);
  const gombocController = await ethers.getContractAt("GombocController", gombocControllerAddress);

  let name = "LT Staking Type";
  let weight = ethers.utils.parseEther("1");
  let typeId = await gombocController.nGombocTypes();
  await gombocController.addType(name, weight);

  let gombocWeight = ethers.utils.parseEther("0");
  await gombocController.addGomboc(stakingHopeGombocAddress, typeId, gombocWeight);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
