import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";


/**
 * deploy ConnetVaultOfStHOPE
 */
async function main() {

  const [owner] = await ethers.getSigners();

  let permit2Address = FileUtils.getContractAddress(Constants.PERMIT2);
  let sthopeToken = FileUtils.getContractAddress(Constants.STAKING_HOPE_GOMBOC);
  let connetAddress = ethers.constants.AddressZero;
  let _withdrawAdmin = ethers.constants.AddressZero;
  let ownerAddress = owner.address;
  let minter = FileUtils.getContractAddress(Constants.LT_MINTER);
  let ltToken = FileUtils.getContractAddress(Constants.LT_TOKEN);
  //deloy ConnetVaultOfStHOPE  contract
  const ConnetVaultOfStHOPE = await ethers.getContractFactory("ConnetVaultOfStHOPE");
  const connetVaultOfStHOPE = await upgrades.deployProxy(ConnetVaultOfStHOPE, [permit2Address, sthopeToken, connetAddress, _withdrawAdmin, ownerAddress, minter, ltToken]);
  await connetVaultOfStHOPE.deployed();
  console.log("connetVaultOfStHOPE: ", connetVaultOfStHOPE.address);
  FileUtils.saveFrontendFiles(connetVaultOfStHOPE.address, "ConnetVaultOfStHOPE", Constants.stHOPE_CONNET_VAULT);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
