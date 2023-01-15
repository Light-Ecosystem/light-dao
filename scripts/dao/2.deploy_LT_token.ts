import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

async function main() {

    const ERC20LT = await ethers.getContractFactory("LT");
    const ltToken = await ERC20LT.deploy();
    await ltToken.deployed();
    console.log("LT Token Address: ", ltToken.address);
    FileUtils.saveFrontendFiles(ltToken.address, "LT", Constants.LT_TOKEN);

    let name = "Light Token";
    let symbol = "LT";
    await ltToken.initialize(name, symbol);

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});