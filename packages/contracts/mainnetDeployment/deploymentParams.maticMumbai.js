const EXTERNAL_ADDRS  = {
    DAI: '',
    WETH: '',
    WMATIC: "0x5b67676a984807a212b1c59ebfc9b3568a474f0a",
    UNISWAP_V2_FACTORY: "0xc35dadb65012ec5796536bd9864ed8773abc74c4",
    UNIWAP_V2_ROUTER02: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
    CHAINLINK_WMATIC_USD: "0x0715A7794a1dc8e42615F059dD6e406A6594651A", 
}

const DEPLOYER_ADDRS = {
    DEPLOYER: "0x44DD28a7D636bBAad0f491632Ac447983652342B",
    TIMELOCK: "0x44DD28a7D636bBAad0f491632Ac447983652342B"
}

const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => delay(90000) // Wait 90s.

const TX_CONFIRMATIONS = 1
const GAS_PRICE = 2000000000  // 1 Gwei
const NETWORK_NAME = 'maticMumbai'
const COLLATERLAS = ['WETH', 'DAI', 'WMATIC']
const OUTPUT_FILE = './mainnetDeployment/stagingMaticMumbai.json'
const ETHERSCAN_BASE_URL = 'https://mumbai.polygonscan.com/address'

module.exports = {
    COLLATERLAS,
    EXTERNAL_ADDRS,
    DEPLOYER_ADDRS,
    OUTPUT_FILE,
    waitFunction,
    GAS_PRICE,
    TX_CONFIRMATIONS,
    ETHERSCAN_BASE_URL,
    NETWORK_NAME
};
  