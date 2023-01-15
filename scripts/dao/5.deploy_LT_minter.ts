import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * depend on 'gombocController contract'
 */
async function main() {
    let ltToken = FileUtils.getContractAddress(Constants.LT_TOKEN);
    let gombocController = FileUtils.getContractAddress(Constants.GOMBOC_CONTROLLER);

    const Minter = await ethers.getContractFactory("Minter");
    const minter = await Minter.deploy(ltToken, gombocController);
    await minter.deployed();
    console.log("minter Address: ", minter.address);
    FileUtils.saveFrontendFiles(minter.address, "Minter", Constants.LT_MINTER);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});