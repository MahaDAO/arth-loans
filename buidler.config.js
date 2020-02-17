usePlugin("@nomiclabs/buidler-truffle5");

const accounts = require("./accountsList.js");

const accountsList = accounts.accountsList

module.exports = {
    paths: {
        contracts: "./contracts",
        artifacts: "./client/src/contracts"
    },
    solc: {
        optimizer: {
            enabled: true,
            runs: 1000
        }
    },
    networks: {
        buidlerevm: {
            accounts: accountsList
        }
    },
    mocha: { timeout: 12000000 },
    rpc: {
        host: "localhost",
        port: 8545
    },
    // gasReporter: {
    //     currency: 'CHF',
    //     gasPrice: 20
    // }

};
