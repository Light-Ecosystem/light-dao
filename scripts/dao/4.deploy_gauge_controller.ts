import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * depend on 'LT token contract' and 'veLT token contract'
 */
async function main() {

    let ltToken = FileUtils.getContractAddress(Constants.LT_TOKEN);
    let veLTToken = FileUtils.getContractAddress(Constants.VELT_TOKEN);

    const GaugeController = await ethers.getContractFactory("GaugeController");
    const gaugeController = await GaugeController.deploy(ltToken, veLTToken);
    await gaugeController.deployed();
    console.log("gaugeController Address: ", gaugeController.address);
    FileUtils.saveFrontendFiles(gaugeController.address, "GaugeController", Constants.GAUGE_CONTROLLER);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});