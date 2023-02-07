import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * set LT and HOPE token burner in burnerManager
 */
async function main() {

    let usdc = FileUtils.getContractAddress(Constants.USDC_TOKEN);
    let usdt = FileUtils.getContractAddress(Constants.USDT_TOKEN);
    let dai = FileUtils.getContractAddress(Constants.DAI_TOKEN);
    let lightSwapBurner = FileUtils.getContractAddress(Constants.LightSwapBurner);
    let burnerManager = FileUtils.getContractAddress(Constants.BurnerManager);
    const burnerManagerContract = await ethers.getContractAt("BurnerManager", burnerManager);

    await burnerManagerContract.setManyBurner([usdc, usdt, dai], [lightSwapBurner, lightSwapBurner, lightSwapBurner]);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});