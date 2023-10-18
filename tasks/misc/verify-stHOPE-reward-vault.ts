import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";

task(
  `verify-stHOPE-reward-vault`,
  `Etherscan verify stHOPERewardVault contract`
).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }
  let networkName = hre.network.name;
  console.log("networkName: ", networkName);

  // Set address first
  let HOPE = "0x26100653722f1304B172f0B07e83dB60b9ef0296";
  let stHOPE = "0xD5315E662e72683B817c9a96Adea6158d43F3b55";
  let minter = "0x49bc8E9fee846e4ce1cD460Dbf92F54Fd4683733";
  let signer = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";

  const VaultProxyAddress = FileUtils.getContractAddress(
    Constants.stHOPERewardVault
  );
  const VaultImplAddress = await hre.upgrades.erc1967.getImplementationAddress(
    VaultProxyAddress
  );
  console.log("Impl: ", VaultImplAddress);
  console.log("Proxy: ", VaultProxyAddress);

  console.log(`- Verifying stHOPERewardVault Implementation:`);
  try {
    await hre.run("verify:verify", {
      address: VaultImplAddress,
      constructorArguments: [],
    });
  } catch (error) {
    console.error(error);
  }
  console.log(`- Verifying stHOPERewardVault Proxy :`);
  try {
    await hre.run("verify:verify", {
      address: VaultProxyAddress,
      constructorArguments: [HOPE, stHOPE, minter, signer],
    });
  } catch (error) {
    console.error(error);
  }
});
