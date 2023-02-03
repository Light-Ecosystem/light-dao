import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";


async function main() {
  const PoolGomboc = await ethers.getContractFactory("PoolGomboc");
  let poolGomboc = await PoolGomboc.deploy();
  await poolGomboc.deployed();
  console.log("Pool Address: ", poolGomboc.address);
  FileUtils.saveFrontendFiles(poolGomboc.address, "PoolGomboc", Constants.POOL_GOMBOC);
}

main().catch((error) => {
  console.log(error);
  process.exitCode = 1;
});
