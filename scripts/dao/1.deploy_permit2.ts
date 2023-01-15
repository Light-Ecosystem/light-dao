import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

async function main() {
    const Permit2 = await ethers.getContractFactory("Permit2");
    const permit2 = await Permit2.deploy();
    await permit2.deployed();
    console.log("Permit2 Address: ", permit2.address);
    FileUtils.saveFrontendFiles(permit2.address, 'Permit2', Constants.PERMIT2);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});