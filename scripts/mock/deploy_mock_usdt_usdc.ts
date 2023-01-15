import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

async function main() {
    let totalSupply = ethers.utils.parseEther('2000000000');
    let symbol = "USDT";
    let name = "USDT Token";
    const UsdtToken = await ethers.getContractFactory("MyToken");
    const usdtToken = await UsdtToken.deploy();
    usdtToken.initialize(name, symbol, totalSupply, 6);
    console.log("USDT contract address: ", usdtToken.address);
    FileUtils.saveFrontendFiles(usdtToken.address, 'MyToken', Constants.USDT_TOKEN);

    // sleep 2s
    await new Promise(res => setTimeout(() => res(null), 2000));


    symbol = "USDC";
    name = "USDC Token";
    const UsdcToken = await ethers.getContractFactory("MyToken");
    const usdcToken = await UsdcToken.deploy();
    usdcToken.initialize(name, symbol, totalSupply, 18);
    console.log("USDC contract address: ", usdcToken.address);
    FileUtils.saveFrontendFiles(usdcToken.address, 'MyToken', Constants.USDC_TOKEN);

    // sleep 2s
    await new Promise(res => setTimeout(() => res(null), 2000));


    symbol = "DAI";
    name = "DAI Token";
    const DaiToken = await ethers.getContractFactory("MyToken");
    const daiToken = await DaiToken.deploy();
    daiToken.initialize(name, symbol, totalSupply, 18);
    console.log("DAI contract address: ", daiToken.address);
    FileUtils.saveFrontendFiles(daiToken.address, 'MyToken', Constants.DAI_TOKEN);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});