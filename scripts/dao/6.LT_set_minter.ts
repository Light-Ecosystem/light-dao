import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * depend on 'minter contract'
 */
async function main() {

    const Minter = await ethers.getContractFactory("Minter");

    let lt = FileUtils.getContractAddress(Constants.LT_TOKEN);
    let minter = FileUtils.getContractAddress(Constants.LT_MINTER);
    const ltContract = await ethers.getContractAt("LT", lt);
    await ltContract.setMinter(minter);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});