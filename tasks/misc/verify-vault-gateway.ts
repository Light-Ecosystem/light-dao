import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";

task(
  `verify-vault-gateway`,
  `Etherscan verify HopeAutomation Vault & Gateway contract`
).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }

  const VAULT_ADDRESS = FileUtils.getContractAddress("Vault");
  const GATEWAY_ADDRESS = FileUtils.getContractAddress("Gateway");

  const HOPE_ADDRESS = "0x70C8C67CfbE228c7437Ec586a751a408e23355F4";
  const WBTC_ADDRESS = "0xAF48F7c5866c0Fd63492bAc0b7816c1933c4D43a";
  const WETH_ADDRESS = "0xE55a23aaFb3a712BFae5BE96E0f61C745dedf33C";
  const stETH_ADDRESS = "0x00c71b0fCadE911B2feeE9912DE4Fe19eB04ca56";

  console.log(`- Verifying Vault:`);
  try {
    await hre.run("verify:verify", {
      address: VAULT_ADDRESS,
      constructorArguments: [HOPE_ADDRESS, WBTC_ADDRESS, stETH_ADDRESS],
    });
  } catch (error) {
    console.error(error);
  }
  console.log(`- Verifying Gateway:`);
  try {
    await hre.run("verify:verify", {
      address: GATEWAY_ADDRESS,
      constructorArguments: [
        HOPE_ADDRESS,
        WBTC_ADDRESS,
        WETH_ADDRESS,
        stETH_ADDRESS,
        VAULT_ADDRESS,
      ],
    });
  } catch (error) {
    console.error(error);
  }
});
