import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * depend on 'minter contract'
 */
async function main() {

    let tokens = [
        ["HOPE", Constants.HOPE_TOKEN, "HOPE"],
        ["MyToken", Constants.USDT_TOKEN, "USDT"],
        ["MyToken", Constants.USDC_TOKEN, "USDC"],
        ["MyToken", Constants.DAI_TOKEN, "DAI"],
        ["LT", Constants.LT_TOKEN, "LT"]
    ]

    let value = ethers.utils.parseEther("100000");
    let toAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    for (let i = 0; i < tokens.length; i++) {
        let address = FileUtils.getContractAddress(tokens[i][1]);
        const contract = await ethers.getContractAt(tokens[i][0], address);
        await contract.transfer(toAddress, value);
        let balance = await contract.balanceOf(toAddress);
        console.log("%s balance of: %s   %s", tokens[i][2], toAddress, balance);
    }

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});