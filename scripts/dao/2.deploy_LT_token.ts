import { ethers, upgrades } from "hardhat";
import { FileUtils } from "../file_utils";
import { Constants } from "../constant";

async function main() {
  const ERC20LT = await ethers.getContractFactory("LT");
  let name = "Light Token";
  let symbol = "LT";
  const ltToken = await upgrades.deployProxy(ERC20LT, [name, symbol]);
  await ltToken.deployed();
  printAddress(ltToken);
  FileUtils.saveFrontendFiles(ltToken.address, "LT", Constants.LT_TOKEN);
}

async function printAddress(token: any) {
  console.log(token.address, "LightToken-ProxyAddress");
  console.log(await upgrades.erc1967.getImplementationAddress(token.address), "LightToken-LogicAddress");
  console.log(await upgrades.erc1967.getAdminAddress(token.address), "ProxyAdminAddress");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});