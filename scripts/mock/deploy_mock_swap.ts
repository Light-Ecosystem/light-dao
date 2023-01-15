import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

async function main() {
    const MockSwap = await ethers.getContractFactory("MockSwap");
    const mockSwap = await MockSwap.deploy();
    await mockSwap.deployed();
    console.log("MockSwap: ", mockSwap.address);
    FileUtils.saveFrontendFiles(mockSwap.address, 'MockSwap', Constants.MOCK_SWAP);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});