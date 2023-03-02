import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * set LT and HOPE token burner in burnerManager
 */
async function main() {

    let hopeToken = FileUtils.getContractAddress(Constants.HOPE_TOKEN);
    let ltToken = FileUtils.getContractAddress(Constants.LT_TOKEN);
    let hopeSwapBurner = FileUtils.getContractAddress(Constants.HopeSwapBurner);
    let burnerManager = FileUtils.getContractAddress(Constants.BurnerManager);
    const burnerManagerContract = await ethers.getContractAt("BurnerManager", burnerManager);

    await burnerManagerContract.setManyBurner([hopeToken, ltToken], [hopeSwapBurner, hopeSwapBurner]);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
