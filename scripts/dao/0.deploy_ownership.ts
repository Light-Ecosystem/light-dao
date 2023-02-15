import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

async function main() {
  const Ownership = await ethers.getContractFactory("Ownership");
  const ownership = await Ownership.deploy();
  await ownership.deployed();
  console.log("Permit2 Address: ", ownership.address);
  FileUtils.saveFrontendFiles(ownership.address, "Ownership", Constants.OWNERSHIP);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});