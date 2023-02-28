import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";


/**
 * deploy ConnetVaultOfStHOPE
 */
async function main() {

  let connetAddress = ethers.constants.AddressZero;
  let withdrawAddress = ethers.constants.AddressZero;
  let adminRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("withraw_Admin_Role"));

  // change connet and withdrawAdmin for connetVaultOfHOPE
  let connetVaultOfHOPEAddress = FileUtils.getContractAddress(Constants.HOPE_CONNET_VAULT);
  let connetVaultOfHOPE = await ethers.getContractAt("ConnetVaultOfStHOPE", connetVaultOfHOPEAddress);
  await connetVaultOfHOPE.changeConnet(connetAddress);
  await connetVaultOfHOPE.changeConnet(connetAddress);
  await connetVaultOfHOPE.grantRole(adminRole, withdrawAddress);

  // change connet and withdrawAdmin for connetVaultOfStHOPE
  let connetVaultOfStHOPEAddress = FileUtils.getContractAddress(Constants.stHOPE_CONNET_VAULT);
  let connetVaultOfStHOPE = await ethers.getContractAt("ConnetVaultOfStHOPE", connetVaultOfStHOPEAddress);
  await connetVaultOfStHOPE.changeConnet(connetAddress);
  await connetVaultOfStHOPE.changeConnet(connetAddress);
  await connetVaultOfStHOPE.grantRole(adminRole, withdrawAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
