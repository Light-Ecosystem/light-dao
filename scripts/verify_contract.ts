import { run, upgrades } from "hardhat";

import { FileUtils } from "./file_utils";
import { Constants } from "./constant";

async function main() {
  const permit2Address = FileUtils.getContractAddress(Constants.PERMIT2);
  const ltTokenAddress = FileUtils.getContractAddress(Constants.LT_TOKEN);
  const veLightAddress = FileUtils.getContractAddress(Constants.VELT_TOKEN);
  const gaugeControllerAddress = FileUtils.getContractAddress(Constants.GAUGE_CONTROLLER);
  const minterAddress = FileUtils.getContractAddress(Constants.LT_MINTER);
  const poolGaugeAddress = FileUtils.getContractAddress(Constants.POOL_GAUGE);
  const gaugeFactory = FileUtils.getContractAddress(Constants.GAUGE_FACTORY);
  const smartWalletWhitelist = FileUtils.getContractAddress(Constants.SmartWalletWhitelist);
  const restrictedAddress = FileUtils.getContractAddress(Constants.RESTRICTED_LIST);
  const hopeAddress = FileUtils.getContractAddress(Constants.HOPE_TOKEN);
  const tokenSaleAddress = FileUtils.getContractAddress(Constants.TOKEN_SALE);
  const stakingHopeAddress = FileUtils.getContractAddress(Constants.STAKING_HOPE_GAUGE);


  await run(`verify:verify`, { address: permit2Address, constructorArguments: [] });
  await run(`verify:verify`, {
    address: await upgrades.erc1967.getImplementationAddress(ltTokenAddress),
    constructorArguments: []
  });
  await run(`verify:verify`, { address: veLightAddress, constructorArguments: [ltTokenAddress, permit2Address] });
  await run(`verify:verify`, { address: gaugeControllerAddress, constructorArguments: [ltTokenAddress, veLightAddress] });
  await run(`verify:verify`, { address: minterAddress, constructorArguments: [ltTokenAddress, gaugeControllerAddress] });
  await run(`verify:verify`, { address: poolGaugeAddress, constructorArguments: [] });
  await run(`verify:verify`, { address: gaugeFactory, constructorArguments: [poolGaugeAddress, minterAddress, permit2Address] });
  await run(`verify:verify`, { address: smartWalletWhitelist, constructorArguments: [] });
  await run(`verify:verify`, { address: restrictedAddress, constructorArguments: [] });
  await run(`verify:verify`, {
    address: await upgrades.erc1967.getImplementationAddress(hopeAddress),
    constructorArguments: []
  });
  await run(`verify:verify`, { address: tokenSaleAddress, constructorArguments: [permit2Address] });
  await run(`verify:verify`, { address: stakingHopeAddress, constructorArguments: [minterAddress, permit2Address] });

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});