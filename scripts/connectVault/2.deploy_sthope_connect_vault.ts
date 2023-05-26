import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * deploy ConnetVaultOfStHOPE
 */
async function main() {
  const [owner] = await ethers.getSigners();

  let permit2Address = FileUtils.getContractAddress(Constants.PERMIT2);
  let sthopeToken = FileUtils.getContractAddress(Constants.STAKING_HOPE_GAUGE);
  let connetAddress = ethers.constants.AddressZero;
  let _withdrawAdmin = ethers.constants.AddressZero;
  let ownerAddress = owner.address;
  let minter = FileUtils.getContractAddress(Constants.LT_MINTER);
  let ltToken = FileUtils.getContractAddress(Constants.LT_TOKEN);
  //deloy ConnectVaultOfStHOPE  contract
  const ConnectVaultOfStHOPE = await ethers.getContractFactory(
    "ConnectVaultOfStHOPE"
  );
  const connectVaultOfStHOPE = await upgrades.deployProxy(
    ConnectVaultOfStHOPE,
    [
      permit2Address,
      sthopeToken,
      connetAddress,
      _withdrawAdmin,
      ownerAddress,
      minter,
      ltToken,
    ]
  );
  await connectVaultOfStHOPE.deployed();
  console.log("connectVaultOfStHOPE: ", connectVaultOfStHOPE.address);
  FileUtils.saveFrontendFiles(
    connectVaultOfStHOPE.address,
    "ConnectVaultOfStHOPE",
    Constants.stHOPE_CONNECT_VAULT
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
