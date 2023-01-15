import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

async function main() {
    const [owner] = await ethers.getSigners();
    const restrictedList = FileUtils.getContractAddress(Constants.RESTRICTED_LIST);
    const HOPEToken = await ethers.getContractFactory("HOPE");
    const hopeToken = await upgrades.deployProxy(HOPEToken, [restrictedList]);
    await hopeToken.deployed();
    await print(hopeToken);
    FileUtils.saveFrontendFiles(hopeToken.address, 'HOPE', Constants.HOPE_TOKEN);
}

async function print(token: any) {
    console.log(token.address, "HOPEToken-ProxyAddress")
    console.log(await upgrades.erc1967.getImplementationAddress(token.address), "HOPEToken-LogicAddress")
    console.log(await upgrades.erc1967.getAdminAddress(token.address), "ProxyAdminAddress")
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});