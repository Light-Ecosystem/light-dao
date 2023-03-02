import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-contract-sizer';
import "hardhat-gas-reporter"

const config: HardhatUserConfig = {

  gasReporter: {
    enabled: false
  },
  contractSizer: {
    alphaSort: false,
    disambiguatePaths: false,
    runOnCompile: false,
    strict: true,
    // only: [':ERC20$'],
  },
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true, // Default: false
            runs: 200, // Default: 200,
          },
          viaIR: true,
        },
      },
    ],
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: false,
    },
    ganache: {
      gas: 4100000,
      gasPrice: 8000000000,
      url: `http://localhost:7545`,
      accounts: {
        mnemonic: "soda scrub envelope feature net hunt sea copper extend hole inner horse",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
        passphrase: "",
      }
    },
  }
};

export default config;
