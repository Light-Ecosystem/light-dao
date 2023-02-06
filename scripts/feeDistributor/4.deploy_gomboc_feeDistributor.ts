import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * deploy feeDistributor contract
 */
async function main() {

    let gombocController = FileUtils.getContractAddress(Constants.GOMBOC_CONTROLLER);
    let hopeToken = FileUtils.getContractAddress(Constants.HOPE_TOKEN);
    let stHope = FileUtils.getContractAddress(Constants.STAKING_HOPE_GOMBOC);
    let emergencyReturn = ethers.constants.AddressZero;

    //build next thursday
    const WEEK = 7 * 86400;
    let startTime = Math.floor((new Date()).valueOf() / 1000) + WEEK;
    startTime = startTime - startTime % WEEK;

    const GombocFeeDistributor = await ethers.getContractFactory("GombocFeeDistributor");
    const gombocFeeDistributor = await upgrades.deployProxy(GombocFeeDistributor, [gombocController, startTime, hopeToken, stHope, emergencyReturn]);
    await gombocFeeDistributor.deployed();
    console.log("gombocFeeDistributor: ", gombocFeeDistributor.address);
    FileUtils.saveFrontendFiles(gombocFeeDistributor.address, "GombocFeeDistributor", Constants.GombocFeeDistributor);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});