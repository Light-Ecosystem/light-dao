import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * deploy MockLP Contract
 */
async function main() {
  const MockLP = await ethers.getContractFactory("MockLP");
  const mockLP = await MockLP.deploy("LP_TOKEN", "LP", 18, 10000);
  await mockLP.deployed();
  console.log("MockLP Address: ", mockLP.address);
  FileUtils.saveFrontendFiles(mockLP.address, "MockLP", Constants.LP_TOKEN_MOCK);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});