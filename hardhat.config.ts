import { loadTasks } from "./helpers/hardhat-config-helpers";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "dotenv/config";

const TASK_FOLDERS = ["misc", "tokens"];
loadTasks(TASK_FOLDERS);

const config: HardhatUserConfig = {
  gasReporter: {
    enabled: false,
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
      gas: 4100000,
      initialBaseFeePerGas: 8000000000,
      allowUnlimitedContractSize: false,
      chainId: 31337,
      // forking: {
      //   url: `${process.env.MAIN_NODE_URL}`
      // }
    },
    ganache: {
      gas: 4100000,
      gasPrice: 8000000000,
      url: `http://localhost:7545`,
      accounts: {
        mnemonic:
          "soda scrub envelope feature net hunt sea copper extend hole inner horse",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
        passphrase: "",
      },
    },
    sepolia: {
      gas: 4100000,
      chainId: 11155111,
      url: process.env.SEPOLIA_NODE_URL,
      accounts: [`${process.env.WALLET_KEY}`],
    },
    goerli: {
      gas: 4100000,
      chainId: 5,
      url: process.env.GOERLI_NODE_URL,
      accounts: [`${process.env.WALLET_KEY}`],
    },
  },
  etherscan: {
    // Your API key for Etherscan
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
