import { task } from "hardhat/config";
import { FileUtils } from "../../scripts/file_utils";
import { Constants } from "../../scripts/constant";

task(`deploy-stHOPE-reward-vault`, `Deploys stHOPE reward vault`).setAction(
  async (_, hre) => {
    if (!hre.network.config.chainId) {
      throw new Error("INVALID_CHAIN_ID");
    }
    let networkName = hre.network.name;
    // Set address first
    let HOPE;
    let stHOPE;
    let minter;
    let signer;
    let operator;
    let newOwner;
    switch (networkName) {
      case "mainnet":
        HOPE = "0xc353Bf07405304AeaB75F4C2Fac7E88D6A68f98e";
        stHOPE = "0xF5C6d9Fc73991F687f158FE30D4A77691a9Fd4d8";
        minter = "0x94aFb2C17af24cFAcf19f364628F459dfAB2688f";
        signer = "";
        operator = "";
        newOwner = "";
        break;
      case "baseMainnet":
        HOPE = "";
        stHOPE = "";
        minter = "";
        signer = "";
        operator = "";
        newOwner = "";
        break;
      case "arbitrumOne":
        HOPE = "";
        stHOPE = "";
        minter = "";
        signer = "";
        operator = "";
        newOwner = "";
        break;
      case "sepolia":
        HOPE = "0x70C8C67CfbE228c7437Ec586a751a408e23355F4";
        stHOPE = "0x03D69A55579496821D8FdF0769F0C1a4A195788A";
        minter = "0x2DD369a0126B014f5A574f92FB5510B4EaB4eF01";
        signer = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";
        operator = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";
        newOwner = "";
        break;
      case "goerli":
        HOPE = "0xdC857E0d4C850deAe3a7735390243d3c444E552F";
        stHOPE = "0x09B4621e2A9dBd37550dC4923E60Ff0782Ef9250";
        minter = "0xf38F371b16Aa1e3396A64BC03e4995C9B67fb3F3";
        signer = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";
        operator = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";
        newOwner = "";
        break;
      case "baseGoerli":
        HOPE = "0x26100653722f1304B172f0B07e83dB60b9ef0296";
        stHOPE = "0x72A400c226de7b7A418ec8FBA8F283f16D5158e0";
        minter = "0x49bc8E9fee846e4ce1cD460Dbf92F54Fd4683733";
        signer = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";
        operator = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";
        newOwner = "";
        break;
      case "arbitrumGoerli":
        HOPE = "0x26100653722f1304B172f0B07e83dB60b9ef0296";
        stHOPE = "0xD5315E662e72683B817c9a96Adea6158d43F3b55";
        minter = "0x49bc8E9fee846e4ce1cD460Dbf92F54Fd4683733";
        signer = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";
        operator = "0xcbeD65Db7E177D4875dDF5B67E13326A43a7B03f";
        newOwner = "";
        break;
    }
    console.log("HOPE: ", HOPE, "stHOPE: ", stHOPE, "minter: ", minter);

    // Deploy Vault contract
    const StHOPERewardVault = await hre.ethers.getContractFactory(
      "StHOPERewardVault"
    );
    const Vault = await hre.upgrades.deployProxy(StHOPERewardVault, [
      HOPE,
      stHOPE,
      minter,
      signer,
    ]);
    await Vault.deployed();
    console.log("- Vault deployed: ", Vault.address);
    FileUtils.saveFrontendFiles(
      Vault.address,
      "StHOPERewardVault",
      Constants.stHOPERewardVault
    );

    // Set operator
    await Vault.addOperator(operator);

    // Transfer ownership
    if (networkName === "mainnet") {
      await Vault.transferOwnership(newOwner);
    }
  }
);
