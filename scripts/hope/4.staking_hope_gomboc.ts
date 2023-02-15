import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";


async function main() {
  let hope = FileUtils.getContractAddress(Constants.HOPE_TOKEN);
  let minter = FileUtils.getContractAddress(Constants.LT_MINTER);
  let permit2 = FileUtils.getContractAddress(Constants.PERMIT2);
  let ownership = FileUtils.getContractAddress(Constants.OWNERSHIP);



  const StakingHOPE = await ethers.getContractFactory("StakingHOPE");
  const stakingHope = await StakingHOPE.deploy(hope, minter, permit2, ownership,{ "gasLimit": 4100000 });
  await stakingHope.deployed();
  console.log("StakingHope Address: ", stakingHope.address);
  FileUtils.saveFrontendFiles(stakingHope.address, "StakingHOPE", Constants.STAKING_HOPE_GOMBOC);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});