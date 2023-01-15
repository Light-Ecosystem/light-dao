import { ethers } from "hardhat";
import { Constants } from "../constant";
import { FileUtils } from "../file_utils";

async function main() {

    let tokenSaleAddress = FileUtils.getContractAddress(Constants.TOKEN_SALE);
    let hopeTokenAddress = FileUtils.getContractAddress(Constants.HOPE_TOKEN);
    const hopeToken = await ethers.getContractAt('HOPE', hopeTokenAddress);
    let maxCredit = ethers.utils.parseEther('200000');
    await hopeToken.grantAgent(
        tokenSaleAddress,
        maxCredit,
        1673319761,
        1703681460,
        true,
        true
    )
    console.log("Grant Info: ", tokenSaleAddress, await hopeToken.getMaxCredit(tokenSaleAddress), await hopeToken.getExpirationTime(tokenSaleAddress));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
