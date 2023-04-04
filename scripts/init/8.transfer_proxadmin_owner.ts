import { upgrades } from "hardhat";

async function main() {
  // todo
  const gnosisSafe = "0x00";

  // transfer proxyAdmin ownership
  let admin = await upgrades.admin.getInstance();
  console.log("Transferring ownership of ProxyAdmin...");
  if (gnosisSafe != (await admin.owner())) {
    await upgrades.admin.transferProxyAdminOwnership(gnosisSafe);
  }
  console.log("Transferred ownership of ProxyAdmin to:", await admin.owner());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});