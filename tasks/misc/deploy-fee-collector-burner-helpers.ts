import { task } from "hardhat/config";

task(
  `deploy-fee-collector-burner-helpers`,
  `Deploys fee collector and swap burnder helpers`
).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }
  await hre.run("deploy-fee-collector-burner");
  await hre.run("setup-vault-operator");
  await hre.run("setup-burner-router");
  // Multisig
  await hre.run("setup-tokens-burner");
  // setup-swap-feeto
  await hre.run("transfer-fee-ownership");
  await hre.run("verify-fee-collector-burner");
});
