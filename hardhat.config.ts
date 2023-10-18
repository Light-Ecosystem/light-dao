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
    mainnet: {
      chainId: 1,
      url: process.env.MAINNET_NODE_URL,
      accounts: [`${process.env.WALLET_KEY}`],
    },
    baseMainnet: {
      chainId: 8453,
      url: process.env.BASE_NODE_URL,
      accounts: [`${process.env.WALLET_KEY}`],
    },
    arbitrumOne: {
      chainId: 42161,
      url: process.env.ARBITRUM_NODE_URL,
      accounts: [`${process.env.WALLET_KEY}`],
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
    arbitrumGoerli: {
      chainId: 421613,
      url: process.env.ARB_GOERLI_NODE_URL,
      accounts: [`${process.env.WALLET_KEY}`],
    },
    baseGoerli: {
      chainId: 84531,
      gasPrice: 100000000,
      gas: 5000000,
      url: process.env.BASE_GOERLI_NODE_URL,
      accounts: [`${process.env.WALLET_KEY}`],
    },
  },
  etherscan: {
    // Your API key for Etherscan
    apiKey: {
      mainnet: `${process.env.ETHERSCAN_API_KEY}`,
      arbitrumOne: `${process.env.ARBISCAN_API_KEY}`,
      baseMainnet: `${process.env.BASESCAN_API_KEY}`,
      arbitrumGoerli: `${process.env.ARBISCAN_API_KEY}`,
      baseGoerli: `${process.env.BASESCAN_API_KEY}`,
    },
    customChains: [
      {
        network: "baseGoerli",
        chainId: 84531,
        urls: {
          apiURL: "https://api-goerli.basescan.org/api",
          browserURL: "https://goerli.basescan.org",
        },
      },
      {
        network: "baseMainnet",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },
};

export default config;
