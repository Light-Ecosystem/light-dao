import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

async function main() {
    let tokenSaleAddress = FileUtils.getContractAddress(Constants.TOKEN_SALE);
    let TokenSaleV2 = await ethers.getContractFactory("TokenSaleContract");
    console.log("Preparing upgrade...");
    let tokenSaleV2 = await upgrades.upgradeProxy(tokenSaleAddress, TokenSaleV2);
    await print(tokenSaleV2);
    FileUtils.saveFrontendFiles(tokenSaleV2.address, 'TokenSaleContract', Constants.TOKEN_SALE);
}

async function print(token: any) {
    console.log(token.address, "TokenSale-ProxyAddress")
    console.log(await upgrades.erc1967.getImplementationAddress(token.address), "TokenSale-LogicAddress")
    console.log(await upgrades.erc1967.getAdminAddress(token.address), "ProxyAdminAddress")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
