import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * depend on 'LT token contract' and 'veLT token contract'
 */
async function main() {

    let ltToken = FileUtils.getContractAddress(Constants.LT_TOKEN);
    let veLTToken = FileUtils.getContractAddress(Constants.VELT_TOKEN);

    const GombocController = await ethers.getContractFactory("GombocController");
    const gombocController = await GombocController.deploy(ltToken, veLTToken);
    await gombocController.deployed();
    console.log("gombocController Address: ", gombocController.address);
    FileUtils.saveFrontendFiles(gombocController.address, "GombocController", Constants.GOMBOC_CONTROLLER);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});