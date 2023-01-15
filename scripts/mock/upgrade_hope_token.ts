import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

async function main() {

    const [owner] = await ethers.getSigners();

    let hopeTokenAddress = FileUtils.getContractAddress(Constants.HOPE_TOKEN);
    let HOPETokenV2 = await ethers.getContractFactory("HOPEToken");
    console.log("Preparing upgrade...");
    let hopeTokenV2 = await upgrades.upgradeProxy(hopeTokenAddress, HOPETokenV2);
    await print(hopeTokenV2);
    FileUtils.saveFrontendFiles(hopeTokenV2.address, 'HOPEToken', Constants.HOPE_TOKEN);
}

async function print(token: any) {
    console.log(token.address, "HOPEToken-ProxyAddress")
    console.log(await upgrades.erc1967.getImplementationAddress(token.address), "HOPEToken-LogicAddress")
    console.log(await upgrades.erc1967.getAdminAddress(token.address), "ProxyAdminAddress")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
