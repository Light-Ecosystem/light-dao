import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

/**
 * depend on 'LT token contract' and 'permit2 contract'
 */
async function main() {
    let LT = FileUtils.getContractAddress(Constants.LT_TOKEN);
    let permit2 = FileUtils.getContractAddress(Constants.PERMIT2);

    const VeLT = await ethers.getContractFactory("VotingEscrow");
    const veLT = await VeLT.deploy(LT, permit2);
    await veLT.deployed();
    console.log("VotingEscrow Address: ", veLT.address);
    FileUtils.saveFrontendFiles(veLT.address, "VotingEscrow", Constants.VELT_TOKEN);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});