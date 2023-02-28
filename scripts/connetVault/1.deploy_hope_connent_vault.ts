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
  let connetAddress = "";
  let _withdrawAdmin = "";
  let ownerAddress = owner;
  //deloy ConnetVaultOfHOPE  contract
  const ConnetVault = await ethers.getContractFactory("ConnetVault");
  const connetVault = await upgrades.deployProxy(ConnetVault, [permit2Address, hopeToken, hopeToken, connetAddress, _withdrawAdmin, ownerAddress]);
  await connetVault.deployed();
  console.log("connetVault: ", connetVault.address);
  FileUtils.saveFrontendFiles(connetVault.address, "ConnetVault", Constants.HOPE_CONNET_VAULT);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
