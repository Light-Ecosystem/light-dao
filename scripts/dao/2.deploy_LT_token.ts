import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

async function main() {

    const ERC20LT = await ethers.getContractFactory("LT");
    let name = "Light Token";
    let symbol = "LT";
    const ltToken = await upgrades.deployProxy(ERC20LT, [name, symbol]);
    await ltToken.deployed();
    console.log("LT Token Address: ", ltToken.address);
    FileUtils.saveFrontendFiles(ltToken.address, "LT", Constants.LT_TOKEN);

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});