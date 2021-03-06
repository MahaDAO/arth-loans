require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-abi-exporter");

const accounts = require("./hardhatAccountsList2k.js");
const accountsList = accounts.accountsList;

const fs = require("fs");
const getSecret = (secretKey, defaultValue = "") => {
  const SECRETS_FILE = "./secrets.js";
  let secret = defaultValue;
  if (fs.existsSync(SECRETS_FILE)) {
    const { secrets } = require(SECRETS_FILE);
    if (secrets[secretKey]) {
      secret = secrets[secretKey];
    }
  }

  return secret;
};

const alchemyUrl = () => {
  return `https://eth-mainnet.alchemyapi.io/v2/${getSecret("alchemyAPIKey")}`;
};

const alchemyUrlRinkeby = () => {
  return `https://eth-rinkeby.alchemyapi.io/v2/${getSecret("alchemyAPIKeyRinkeby")}`;
};

module.exports = {
  paths: {
    // contracts: "./contracts",
    // artifacts: "./artifacts"
  },
  solidity: {
    compilers: [
      // {
      //     version: "0.4.23",
      //     settings: {
      //         optimizer: {
      //             enabled: true,
      //             runs: 100
      //         }
      //     }
      // },
      // {
      //     version: "0.5.17",
      //     settings: {
      //         optimizer: {
      //             enabled: true,
      //             runs: 100
      //         }
      //     }
      // },
      {
        version: "0.8.0",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100
          }
        }
      }
      //   {
      //     version: "0.5.17",
      //     settings: {
      //       optimizer: {
      //         enabled: true,
      //         runs: 100
      //       }
      //     }
      //   }
    ]
  },
  networks: {
    matic: {
      url: "https://speedy-nodes-nyc.moralis.io/a134b32bcf89c622864fd416/polygon/mainnet",
      accounts: [getSecret("DEPLOYER_PRIVATEKEY"), getSecret("ACCOUNT2_PRIVATEKEY")],
      gasPrice: 50 * 1000000000 // 5.1 gwei
    },
    hardhat: {
      accounts: accountsList,
      gas: 10000000, // tx gas limit
      blockGasLimit: 12500000,
      gasPrice: 20000000000
      // forking: {
      //     url: 'https://eth-mainnet.alchemyapi.io/v2/t4ccmxjLy2G_VCt587OoETn1fzArqbcp',
      //     blockNumber: 12152522
      // }
    },
    maticMumbai: {
      url: "https://matic-mumbai.chainstacklabs.com",
      accounts: [getSecret("DEPLOYER_PRIVATEKEY"), getSecret("ACCOUNT2_PRIVATEKEY")]
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: [getSecret("BSC_DEPLOYER_PRIVATEKEY")]
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      accounts: [getSecret("BSC_DEPLOYER_PRIVATEKEY")]
    },
    mainnet: {
      url: "https://mainnet.infura.io/v3/69666afe933b4175afe4999170158a5f",
      accounts: [getSecret("ETH_DEPLOYER_PRIVATEKEY")]
    },
    rinkeby: {
      url: alchemyUrlRinkeby(),
      gas: 10000000, // tx gas limit
      accounts: [getSecret("DEPLOYER_PRIVATEKEY"), getSecret("ACCOUNT2_PRIVATEKEY")]
    }
  },
  etherscan: {
    apiKey: {
      bsc: getSecret("BSCSCAN_API_KEY"),
      mainnet: getSecret("ETHERSCAN_API_KEY")
    }
  },
  mocha: { timeout: 12000000 },
  rpc: {
    host: "localhost",
    port: 8545
  },
  abiExporter: {
    path: "./output/abi",
    clear: true,
    flat: true,
    spacing: 2
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false
  }
};
