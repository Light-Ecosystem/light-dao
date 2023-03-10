import { ethers } from "hardhat";
import { Constants } from "../constant";
import { FileUtils } from "../file_utils";

async function main() {

  // todo
  const newOwnerAddress = "0x00";

  const ltToken = await ethers.getContractAt("LT", FileUtils.getContractAddress(Constants.LT_TOKEN));

  console.log(await ltToken.totalSupply());
  await ltToken.transfer(newOwnerAddress, ethers.utils.parseEther("300000000000"))
  await ltToken.transfer(newOwnerAddress, ethers.utils.parseEther("50000000000"))
  await ltToken.transfer(newOwnerAddress, ethers.utils.parseEther("50000000000"))
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});