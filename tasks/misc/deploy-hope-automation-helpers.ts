import { task } from "hardhat/config";

task(
  `deploy-hope-automation-helpers`,
  `Deploys HOPE automation vualt & gateway ownership helpers`
).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }
  await hre.run("deploy-hope-automation");
  await hre.run("transfer-hope-automation-ownership");
  await hre.run("verify-vault-gateway");
  // Multisig HOPE agent
  // Multisig accept ownership
});
