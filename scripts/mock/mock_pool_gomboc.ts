import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";


async function main() {
  let mockLPToken = FileUtils.getContractAddress(Constants.LP_TOKEN_MOCK);
  let minter = FileUtils.getContractAddress(Constants.LT_MINTER);
  let permit2 = FileUtils.getContractAddress(Constants.PERMIT2);


  const PoolGomboc = await ethers.getContractFactory("PoolGomboc");
  const poolGomboc = await PoolGomboc.deploy(mockLPToken, minter, permit2);
  await poolGomboc.deployed();
  console.log("PoolGomboc Address: ", poolGomboc.address);
  FileUtils.saveFrontendFiles(poolGomboc.address, "PoolGomboc", Constants.POOL_GOMBOC);
}

main().catch((error) => {
  console.log(error);
  process.exitCode = 1;
});
