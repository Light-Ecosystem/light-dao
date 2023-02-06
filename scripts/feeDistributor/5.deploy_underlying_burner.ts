import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * deploy feeDistributor contract
 */
async function main() {

    let hopeToken = FileUtils.getContractAddress(Constants.HOPE_TOKEN);
    let feeDistributor = FileUtils.getContractAddress(Constants.FeeDistributor);
    let gombocFeeDistributor = FileUtils.getContractAddress(Constants.GombocFeeDistributor);
    let emergencyReturn = ethers.constants.AddressZero;

    const UnderlyingBurner = await ethers.getContractFactory("UnderlyingBurner");
    const underlyingBurner = await upgrades.deployProxy(UnderlyingBurner, [hopeToken, feeDistributor, gombocFeeDistributor, emergencyReturn]);
    await underlyingBurner.deployed();
    console.log("underlyingBurner: ", underlyingBurner.address);
    FileUtils.saveFrontendFiles(underlyingBurner.address, "UnderlyingBurner", Constants.UnderlyingBurner);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});