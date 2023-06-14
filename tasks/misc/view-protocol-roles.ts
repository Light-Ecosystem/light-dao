import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";

task(
  `view-protocol-roles`,
  `View current admin of each role and contract`
).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }
  const multiSig = "0x00";
  // 2. Grant operator
  const feeToVaultAddress = FileUtils.getContractAddress(Constants.FeeToVault);
  const feeToVault = await hre.ethers.getContractAt(
    "FeeToVault",
    feeToVaultAddress
  );
  const swapBurnerAddress = FileUtils.getContractAddress(Constants.SwapBurner);
  const swapBurner = await hre.ethers.getContractAt(
    "SwapBurner",
    swapBurnerAddress
  );

  const result = [
    {
      role: "FeeToVault owner",
      address: await feeToVault.owner(),
      assert: (await feeToVault.owner()) === multiSig,
    },
    {
      role: "SwapBurner owner",
      address: await swapBurner.owner(),
      assert: (await swapBurner.owner()) === multiSig,
    },
  ];

  console.table(result);
});
