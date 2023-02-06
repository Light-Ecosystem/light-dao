import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * deploy feeDistributor contract
 */
async function main() {

    let veLT = FileUtils.getContractAddress(Constants.VELT_TOKEN);
    let hopeToken = FileUtils.getContractAddress(Constants.HOPE_TOKEN);
    let stHope = FileUtils.getContractAddress(Constants.STAKING_HOPE_GOMBOC);
    let emergencyReturn = ethers.constants.AddressZero;

    //build next thursday
    const WEEK = 7 * 86400;
    let startTime = Math.floor((new Date()).valueOf() / 1000) + WEEK;
    startTime = startTime - startTime % WEEK;

    const FeeDistributor = await ethers.getContractFactory("FeeDistributor");
    const feeDistributor = await upgrades.deployProxy(FeeDistributor, [veLT, startTime, hopeToken, stHope, emergencyReturn]);
    await feeDistributor.deployed();
    console.log("feeDistributor: ", feeDistributor.address);
    FileUtils.saveFrontendFiles(feeDistributor.address, "FeeDistributor", Constants.FeeDistributor);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});