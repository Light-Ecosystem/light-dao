import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";
import { deploy } from "@openzeppelin/hardhat-upgrades/dist/utils";

/**
 * deploy LightSwapBurner contract
 */
async function main() {

    let hopeToken = FileUtils.getContractAddress(Constants.HOPE_TOKEN);

    const LightSwapBurner = await ethers.getContractFactory("LightSwapBurner");
    const lightSwapBurner = await LightSwapBurner.deploy(hopeToken);
    await lightSwapBurner.deployed();
    console.log("lightSwapBurner: ", lightSwapBurner.address);
    FileUtils.saveFrontendFiles(lightSwapBurner.address, "LightSwapBurner", Constants.LightSwapBurner);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});