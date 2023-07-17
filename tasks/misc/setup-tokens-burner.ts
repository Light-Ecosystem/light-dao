import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";
import { waitForTx } from "../../helpers/tx";

task(`setup-tokens-burner`, `Setups tokens swap burner`).setAction(
  async (_, hre) => {
    if (!hre.network.config.chainId) {
      throw new Error("INVALID_CHAIN_ID");
    }
    // 1. Reset burner for tokens,  hope does not need to set
    const tokens = [
      "0x5B71dC777A8aDCba065A644e30BBEeB8fCca273f", // DAI
      "0x3da37B4A2F5172580411DdcddDCcae857f9a7aE6", // USDT
      "0x235eBFC0bE0E58cF267D1c5BCb8c03a002A711ed", // USDC
      "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6", // WETH
      "0x89009881287EB51256141265B2f250b9960AaeE5", // stHOPE
    ];

    const burners = [
      FileUtils.getContractAddress(Constants.SwapBurner),
      FileUtils.getContractAddress(Constants.SwapBurner),
      FileUtils.getContractAddress(Constants.SwapBurner),
      FileUtils.getContractAddress(Constants.SwapBurner),
      FileUtils.getContractAddress(Constants.SwapBurner),
    ];
    if (tokens.length != burners.length) {
      console.log("ERROR: tokens length must be equal burners length");
    }
    // 2. Grant operator
    const burnerManagerAddress = "0x46DD0d74189c5b91CE235eC3B09cB5311AB72647";
    const burnerManager = await hre.ethers.getContractAt(
      "BurnerManager",
      burnerManagerAddress
    );
    await waitForTx(await burnerManager.setManyBurner(tokens, burners));
  }
);
