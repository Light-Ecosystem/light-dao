import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";


async function main() {
  const PoolGauge = await ethers.getContractFactory("PoolGauge");
  let poolGauge = await PoolGauge.deploy();
  await poolGauge.deployed();
  console.log("Pool Address: ", poolGauge.address);
  FileUtils.saveFrontendFiles(poolGauge.address, "PoolGauge", Constants.POOL_GAUGE);
}

main().catch((error) => {
  console.log(error);
  process.exitCode = 1;
});
