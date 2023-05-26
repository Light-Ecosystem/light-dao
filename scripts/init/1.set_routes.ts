import { ethers } from "hardhat";
import { Constants } from "../constant";
import { FileUtils } from "../file_utils";

async function main() {

  // TODO:
  const routerAddress = "0x00";

  const hopeSwapBurn = await ethers.getContractAt("HopeSwapBurner", FileUtils.getContractAddress(Constants.HopeSwapBurner));
  const underlyingBurner = await ethers.getContractAt("UnderlyingBurner", FileUtils.getContractAddress(Constants.UnderlyingBurner));

  await hopeSwapBurn.setRouters([routerAddress]);
  await underlyingBurner.setRouters([routerAddress])
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});