require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-abi-exporter");

const accounts = require("./hardhatAccountsList2k.js");
const accountsList = accounts.accountsList

const fs = require('fs')
const getSecret = (secretKey, defaultValue='') => {
    const SECRETS_FILE = "./secrets.js"
    let secret = defaultValue
    if (fs.existsSync(SECRETS_FILE)) {
        const { secrets } = require(SECRETS_FILE)
        if (secrets[secretKey]) { secret = secrets[secretKey] }
    }

    return secret
}

const alchemyUrl = () => {
    return `https://eth-mainnet.alchemyapi.io/v2/${getSecret('alchemyAPIKey')}`
}

const alchemyUrlRinkeby = () => {
    return `https://eth-rinkeby.alchemyapi.io/v2/${getSecret('alchemyAPIKeyRinkeby')}`
}

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
                version: "0.6.11",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 100
                    }
                }
            },
        ]
    },
    networks: {
        hardhat: {
            accounts: accountsList,
            gas: 10000000,  // tx gas limit
            blockGasLimit: 12500000,
            gasPrice: 20000000000,
            // forking: {
            //     url: 'https://eth-mainnet.alchemyapi.io/v2/t4ccmxjLy2G_VCt587OoETn1fzArqbcp',
            //     blockNumber: 12152522
            // }
        },
        maticMumbai: {
            url: 'https://rpc-mumbai.matic.today',
            gasPrice: 250000000000,
            gas: 10000000,  // tx gas limit
            accounts: [
                getSecret('DEPLOYER_PRIVATEKEY', '0x60ddfe7f579ab6867cbe7a2dc03853dc141d7a4ab6dbefc0dae2d2b1bd4e487f'),
                getSecret('ACCOUNT2_PRIVATEKEY', '0x3ec7cedbafd0cb9ec05bf9f7ccfa1e8b42b3e3a02c75addfccbfeb328d1b383b')
            ]
          },
        mainnet: {
            url: alchemyUrl(),
            gasPrice: 150000000000,
            accounts: [
                getSecret('DEPLOYER_PRIVATEKEY', '0x60ddfe7f579ab6867cbe7a2dc03853dc141d7a4ab6dbefc0dae2d2b1bd4e487f'),
                getSecret('ACCOUNT2_PRIVATEKEY', '0x3ec7cedbafd0cb9ec05bf9f7ccfa1e8b42b3e3a02c75addfccbfeb328d1b383b')
            ]
        },
        rinkeby: {
            url: alchemyUrlRinkeby(),
            gas: 10000000,  // tx gas limit
            accounts: [
                getSecret('DEPLOYER_PRIVATEKEY', '0x60ddfe7f579ab6867cbe7a2dc03853dc141d7a4ab6dbefc0dae2d2b1bd4e487f'),
                getSecret('ACCOUNT2_PRIVATEKEY', '0x3ec7cedbafd0cb9ec05bf9f7ccfa1e8b42b3e3a02c75addfccbfeb328d1b383b')
            ]
        },
        development: {
            url: 'HTTP://127.0.0.1:8545',
        }
    },
    abiExporter: {
        path: './output/abi',
        clear: true,
        flat: true,
        // only: [':ERC20$'],
        spacing: 2
    },
    etherscan: {
        apiKey: getSecret("ETHERSCAN_API_KEY")
    },
    mocha: { timeout: 12000000 },
    rpc: {
        host: "localhost",
        port: 8545
    },
    gasReporter: {
        enabled: (process.env.REPORT_GAS) ? true : false
    }
};
