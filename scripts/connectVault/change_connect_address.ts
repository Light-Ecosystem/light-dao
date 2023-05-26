import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * deploy ConnetVaultOfStHOPE
 */
async function main() {
  let connectAddress = ethers.constants.AddressZero;
  let withdrawAddress = ethers.constants.AddressZero;
  let adminRole = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("WITHDRAW_ADMIN_ROLE")
  );

  // change connect and withdrawAdmin for connectVaultOfHOPE
  let connectVaultOfHOPEAddress = FileUtils.getContractAddress(
    Constants.HOPE_CONNECT_VAULT
  );
  let connectVaultOfHOPE = await ethers.getContractAt(
    "ConnectVaultOfStHOPE",
    connectVaultOfHOPEAddress
  );
  await connectVaultOfHOPE.changeConnet(connectAddress);
  await connectVaultOfHOPE.changeConnet(connectAddress);
  await connectVaultOfHOPE.grantRole(adminRole, withdrawAddress);

  // change connect and withdrawAdmin for connectVaultOfStHOPE
  let connectVaultOfStHOPEAddress = FileUtils.getContractAddress(
    Constants.stHOPE_CONNECT_VAULT
  );
  let connectVaultOfStHOPE = await ethers.getContractAt(
    "ConnectVaultOfStHOPE",
    connectVaultOfStHOPEAddress
  );
  await connectVaultOfStHOPE.changeConnet(connectAddress);
  await connectVaultOfStHOPE.changeConnet(connectAddress);
  await connectVaultOfStHOPE.grantRole(adminRole, withdrawAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
