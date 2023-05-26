import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * deploy ConnetVaultOfHOPE
 */
async function main() {
  const [owner] = await ethers.getSigners();

  let permit2Address = FileUtils.getContractAddress(Constants.PERMIT2);
  let hopeToken = FileUtils.getContractAddress(Constants.HOPE_TOKEN);
  let connectAddress = ethers.constants.AddressZero;
  let _withdrawAdmin = ethers.constants.AddressZero;
  let ownerAddress = owner.address;
  //deloy ConnectVaultOfHOPE  contract
  const ConnectVault = await ethers.getContractFactory("ConnectVault");
  const connectVault = await upgrades.deployProxy(ConnectVault, [
    permit2Address,
    hopeToken,
    connectAddress,
    _withdrawAdmin,
    ownerAddress,
  ]);
  await connectVault.deployed();
  console.log("connectVault: ", connectVault.address);
  FileUtils.saveFrontendFiles(
    connectVault.address,
    "ConnectVault",
    Constants.HOPE_CONNECT_VAULT
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
