import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";
import { waitForTx } from "../../helpers/tx";

task(
  `transfer-hope-automation-ownership`,
  `Transfer HOPE automation vualt & gateway ownership`
).setAction(async (_, hre) => {
  if (!hre.network.config.chainId) {
    throw new Error("INVALID_CHAIN_ID");
  }

  const deployer = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";
  // 1. Define multi sig address
  const MULTI_SIG = "0x3141f8D6BE4e4d9137577798C1e127Db81D196d7";
  const VAULT_MANAGER_ADDRESS = "0x3141f8D6BE4e4d9137577798C1e127Db81D196d7";
  const EMERGENCY_MANAGER_ADDRESS =
    "0x3141f8D6BE4e4d9137577798C1e127Db81D196d7";

  const VAULT_ADDRESS = FileUtils.getContractAddress("Vault");
  const vault = await hre.ethers.getContractAt("Vault", VAULT_ADDRESS);
  const GATEWAY_ADDRESS = FileUtils.getContractAddress("Gateway");
  const gateway = await hre.ethers.getContractAt("Gateway", GATEWAY_ADDRESS);

  // 2. Revoke deployer VaultManager role
  await waitForTx(await gateway.removeVaultManager(deployer));
  console.log(`- [INFO] Deployer revoked vault manager!`);

  // 3. Grant EmergencyManager VaultManager
  if (EMERGENCY_MANAGER_ADDRESS) {
    await waitForTx(
      await gateway.addEmergencyManager(EMERGENCY_MANAGER_ADDRESS)
    );
    console.log(
      `- [INFO] Grant ${EMERGENCY_MANAGER_ADDRESS} emergency manager role!`
    );
  }
  if (VAULT_MANAGER_ADDRESS) {
    await waitForTx(await vault.addVaultManager(VAULT_MANAGER_ADDRESS));
    await waitForTx(await gateway.addVaultManager(VAULT_MANAGER_ADDRESS));
    console.log(`- [INFO] Grant ${VAULT_MANAGER_ADDRESS} vault manager role!`);
  }

  // 4. Transfer ownership
  await waitForTx(await vault.transferOwnership(MULTI_SIG));
  await waitForTx(await gateway.transferOwnership(MULTI_SIG));
  const vaultPending = (await vault.pendingOwner()) === MULTI_SIG;
  const gatewayPending = (await gateway.pendingOwner()) === MULTI_SIG;
  if (vaultPending && gatewayPending) {
    console.log(
      `- Successfully transfer ownership step 1, pending owner is (${MULTI_SIG})`
    );
    console.log("- Pending multisig accept ownership......");
  }

  const result = [
    {
      role: "Vault pending owner",
      address: await vault.pendingOwner(),
      assert: (await vault.pendingOwner()) === MULTI_SIG,
    },
    {
      role: "Gateway pending owner",
      address: await gateway.pendingOwner(),
      assert: (await gateway.pendingOwner()) === MULTI_SIG,
    },
    {
      role: "VaultManager",
      address: (await vault.isVaultManager(VAULT_MANAGER_ADDRESS))
        ? VAULT_MANAGER_ADDRESS
        : "DISABLED",
      assert: await vault.isVaultManager(VAULT_MANAGER_ADDRESS),
    },
    {
      role: "Gateway VaultManager",
      address: (await gateway.isVaultManager(VAULT_MANAGER_ADDRESS))
        ? VAULT_MANAGER_ADDRESS
        : "DISABLED",
      assert: await gateway.isVaultManager(VAULT_MANAGER_ADDRESS),
    },
    {
      role: "Gateway EmergencyManager",
      address: (await gateway.isEmergencyManager(EMERGENCY_MANAGER_ADDRESS))
        ? EMERGENCY_MANAGER_ADDRESS
        : "DISABLED",
      assert: await gateway.isEmergencyManager(EMERGENCY_MANAGER_ADDRESS),
    },
    {
      role: "Deployer revoked VaultManager",
      address: (await gateway.isVaultManager(deployer))
        ? "NOT REVOKED"
        : "REVOKED",
      assert: !(await gateway.isVaultManager(deployer)),
    },
  ];
  console.table(result);
});
