import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

async function main() {
    const RestrictedList = await ethers.getContractFactory("RestrictedList");
    const restrictedList = await RestrictedList.deploy();
    await restrictedList.deployed();
    console.log("RestrictedList: ", restrictedList.address);
    FileUtils.saveFrontendFiles(restrictedList.address, 'RestrictedList', Constants.RESTRICTED_LIST);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});