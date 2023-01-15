import { ethers } from "hardhat";
import { Constants } from "../constant";
import { FileUtils } from "../file_utils";

async function main() {

    let tokenSaleAddress = FileUtils.getContractAddress(Constants.TOKEN_SALE);
    const tokenSale = await ethers.getContractAt('HOPESalesAgent', tokenSaleAddress);

    let currencys = [
        {
            symbol: 'USDT',
            address: FileUtils.getContractAddress(Constants.USDT_TOKEN),
            rate: 2 * 1000 * Math.pow(10, 18 - 6)
        },
        {
            symbol: 'USDC',
            address: FileUtils.getContractAddress(Constants.USDC_TOKEN),
            //主网的USDC和USDT的decimal都是6
            rate: 2 * 1000
        },
        {
            symbol: 'DAI',
            address: FileUtils.getContractAddress(Constants.DAI_TOKEN),
            rate: 2 * 1000
        }
    ];

    for (let i = 0; i < currencys.length; i++) {
        let item = currencys[i];
        await tokenSale.addCurrency(item.symbol, item.address, item.rate);
    }

    for (let i = 0; i < currencys.length; i++) {
        let item = currencys[i];
        let currency = await tokenSale.currencys(item.symbol);
        console.log('query currency info from contract', currency);
    }

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
