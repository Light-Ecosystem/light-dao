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
      "0xB2448D911BC792c463AF9ED8cf558a85D97c5Bf1",
      "0xf9B7E9bb840b7BBf7E0C42724f11121D4D1eFC22",
      "0x06DBf77E62Bdc9F5697ca6d696C1dC8B8923fdFf",
      "0x092c325a98e50BE78A140cD043D49904fFB8Ea1F",
      "0xee44150250AfF3E6aC25539765F056EDb7F85D7B",
      "0x0f760D4f644a99962A25Bb7bcF563CC07Bd51b5C",
    ];

    const burners = [
      FileUtils.getContractAddress(Constants.SwapBurner),
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
    const burnerManagerAddress = "0x00";
    const burnerManager = await hre.ethers.getContractAt(
      "BurnerManager",
      burnerManagerAddress
    );
    await waitForTx(await burnerManager.setManyBurner(tokens, burners));
  }
);
