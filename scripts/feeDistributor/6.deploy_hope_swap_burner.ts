import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";
import { deploy } from "@openzeppelin/hardhat-upgrades/dist/utils";

/**
 * deploy HopeSwapBurner contract
 */
async function main() {
  let hopeToken = FileUtils.getContractAddress(Constants.HOPE_TOKEN);
  let swapFeeVault = FileUtils.getContractAddress(Constants.SwapFeeToVault);

  const HopeSwapBurner = await ethers.getContractFactory("HopeSwapBurner");
  const hopeSwapBurner = await HopeSwapBurner.deploy(hopeToken, swapFeeVault);
  await hopeSwapBurner.deployed();
  console.log("hopeSwapBurner: ", hopeSwapBurner.address);
  FileUtils.saveFrontendFiles(
    hopeSwapBurner.address,
    "HopeSwapBurner",
    Constants.HopeSwapBurner
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
