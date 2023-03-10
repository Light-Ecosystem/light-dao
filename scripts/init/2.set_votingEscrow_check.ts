import { ethers } from "hardhat";
import { Constants } from "../constant";
import { FileUtils } from "../file_utils";

async function main() {

  // todo
  const checkAddress = "0x00";

  const veLight = await ethers.getContractAt("VotingEscrow", FileUtils.getContractAddress(Constants.VELT_TOKEN));
  await veLight.setSmartWalletChecker(checkAddress);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});