import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";
import { waitForTx } from "../../helpers/tx";

task(
  `upgrade-feeDistributor`,
  `upgrade underlyingBurner and deploy a new SwapBurner`
).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }
  // 0. Set address first
  const uniV2Router = "0x00";
  const WBTC = "0x01";
  const WETH = "0x02";
  const USDC = "0x03";
  const multiSig = "0x04";
  const HOPE = "0x05";
  const burnerManagerAddress = "0x06";
  const underlyingBurner = "0x07";
  const feeToVault = "0x08";
  
  // 1: upgrade underlyingBurner to underlyingBurnerV2
  const UnderlyingBurnerV2 = await hre.ethers.getContractFactory("UnderlyingBurnerV2");
  await hre.upgrades.upgradeProxy(underlyingBurner, UnderlyingBurnerV2);

  // 2: deploy another SwapBurner
  const SwapBurner = await hre.ethers.getContractFactory("SwapBurner");
  const swapBurner = await SwapBurner.deploy(HOPE, feeToVault);
  await swapBurner.deployed();
  console.log("swapBurner2: ", swapBurner.address);
  FileUtils.saveFrontendFiles(
    swapBurner.address,
    "SwapBurner",
    Constants.SwapBurner2
  );

  // 3: set router
  await waitForTx(await swapBurner.setRouters([uniV2Router]));

  // 4: set burner for wbtc, weth, usdc
  const burnerManager = hre.ethers.getContractAt("BurnerManager", burnerManagerAddress);
  await waitForTx(await burnerManager.setManyBurner(
    [WBTC, WETH, USDC], 
    [swapBurner.address, swapBurner.address, swapBurner.address]
  ));

  // 5: transfer ownership of swapBurner
  await waitForTx(await swapBurner.transferOwnership(multiSig));
  const swapBurnerPending = (await swapBurner.pendingOwner()) === multiSig;
  if (swapBurnerPending) {
    console.log(
      `- Successfully transfer ownership step 1, pending owner is (${multiSig})`
    );
    console.log("- Pending multisig accept ownership......");
  }

  // 6: verify swapBurner
  try {
    await hre.run("verify:verify", {
      address: swapBurner.address,
      constructorArguments: [HOPE, feeToVault],
    });
  } catch (error) {
    console.error(error);
  }

});
