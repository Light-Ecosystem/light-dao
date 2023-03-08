import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * deploy feeDistributor contract
 */
async function main() {

    let gaugeController = FileUtils.getContractAddress(Constants.GAUGE_CONTROLLER);
    let hopeToken = FileUtils.getContractAddress(Constants.HOPE_TOKEN);
    let stHope = FileUtils.getContractAddress(Constants.STAKING_HOPE_GAUGE);
    let emergencyReturn = ethers.constants.AddressZero;

    //build next thursday
    const WEEK = 7 * 86400;
    let startTime = Math.floor((new Date()).valueOf() / 1000) + WEEK;
    startTime = startTime - startTime % WEEK;

    const GaugeFeeDistributor = await ethers.getContractFactory("GaugeFeeDistributor");
    const gaugeFeeDistributor = await upgrades.deployProxy(GaugeFeeDistributor, [gaugeController, startTime, hopeToken, stHope, emergencyReturn]);
    await gaugeFeeDistributor.deployed();
    console.log("gaugeFeeDistributor: ", gaugeFeeDistributor.address);
    FileUtils.saveFrontendFiles(gaugeFeeDistributor.address, "GaugeFeeDistributor", Constants.GaugeFeeDistributor);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});