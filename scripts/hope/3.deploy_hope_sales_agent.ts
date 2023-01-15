import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

async function main() {
    const hopeToken = FileUtils.getContractAddress(Constants.HOPE_TOKEN);
    const permit2 = FileUtils.getContractAddress(Constants.PERMIT2);
    const HOPESalesAgent = await ethers.getContractFactory("HOPESalesAgent");
    const hopeSalesAgent = await HOPESalesAgent.deploy(hopeToken, permit2);
    await hopeSalesAgent.deployed();
    console.log("HOPESalesAgent address: ", hopeSalesAgent.address);
    FileUtils.saveFrontendFiles(hopeSalesAgent.address, 'HOPESalesAgent', Constants.TOKEN_SALE);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});