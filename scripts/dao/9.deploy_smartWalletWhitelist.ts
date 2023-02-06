import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";


/**
 * deploy SmartWalletWhitelist contract and set SmartWalletWhitelist in VotingEscrow
 */
async function main() {

  //deloy SmartWalletWhitelist  contract
  const SmartWalletWhitelist = await ethers.getContractFactory("SmartWalletWhitelist");
  const smartWalletWhitelist = await SmartWalletWhitelist.deploy();
  await smartWalletWhitelist.deployed();
  FileUtils.saveFrontendFiles(smartWalletWhitelist.address, "SmartWalletWhitelist", Constants.SmartWalletWhitelist);

  //setSmartWalletChecker in  VotingEscrow
  let veLt = FileUtils.getContractAddress(Constants.VELT_TOKEN);
  const veLtContract = await ethers.getContractAt("VotingEscrow", veLt);
  await veLtContract.setSmartWalletChecker(smartWalletWhitelist.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
