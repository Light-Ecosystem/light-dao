import { ethers } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

async function main() {
    const [owner] = await ethers.getSigners();
    const hopeTokenAddress = FileUtils.getContractAddress(Constants.HOPE_TOKEN);
    const hopeToken = await ethers.getContractAt('HOPE', hopeTokenAddress);
    const Admin = await ethers.getContractFactory("Admin");
    const admin = await Admin.deploy(hopeTokenAddress);
    await admin.deployed();
    console.log("Admin address: ", admin.address);
    FileUtils.saveFrontendFiles(admin.address, 'Admin', Constants.ADMIN);

    let totalSupply = ethers.utils.parseEther("2000000000");
    await hopeToken.grantAgent(
        admin.address,
        totalSupply,
        0,
        100000000,
        true,
        true
    );
    await admin.mint(owner.address, totalSupply);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});