import { ethers } from "hardhat";
import { Constants } from "../constant";
import { FileUtils } from "../file_utils";

async function main() {

  // TODO:
  const teamVaultManager = "";
  const teamVault = "";
  const treasuryVault = "";
  const foundationVault = "";

  const ltToken = await ethers.getContractAt("LT", FileUtils.getContractAddress(Constants.LT_TOKEN));
  const smartWalletWhitelist = await ethers.getContractAt("SmartWalletWhitelist", FileUtils.getContractAddress(Constants.SmartWalletWhitelist));

  await smartWalletWhitelist.approveWallet(teamVaultManager);

  console.log(await ltToken.totalSupply());
  await ltToken.transfer(teamVault, ethers.utils.parseEther("300000000000"));
  await ltToken.transfer(treasuryVault, ethers.utils.parseEther("50000000000"));
  await ltToken.transfer(foundationVault, ethers.utils.parseEther("50000000000"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});