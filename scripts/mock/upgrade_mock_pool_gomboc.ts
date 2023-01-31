import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";


async function main() {
  let mockLPToken = FileUtils.getContractAddress(Constants.LP_TOKEN_MOCK);
  let minter = FileUtils.getContractAddress(Constants.LT_MINTER);
  let permit2 = FileUtils.getContractAddress(Constants.PERMIT2);

  const PoolGomboc = await ethers.getContractFactory("PoolGomboc");
  let poolGomboc = await upgrades.deployProxy(PoolGomboc, [mockLPToken, minter, permit2]);
  await poolGomboc.deployed();
  await print(poolGomboc);
  FileUtils.saveFrontendFiles(poolGomboc.address, "PoolGomboc", Constants.POOL_GOMBOC);
}

async function print(token: any) {
  console.log(token.address, "PoolGomboc-ProxyAddress")
  console.log(await upgrades.erc1967.getImplementationAddress(token.address), "PoolGomboc-LogicAddress")
  console.log(await upgrades.erc1967.getAdminAddress(token.address), "ProxyAdminAddress")
}

main().catch((error) => {
  console.log(error);
  process.exitCode = 1;
});
