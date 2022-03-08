const EXTERNAL_ADDRS  = {
    DAI: '',
    WETH: '',
    ARTH: '',
    GMU_ORACLE: '',
    WMATIC: "",
    CHAINLINK_WMATIC_USD: "",
    CHAINLINK_DAI_USD: "",
    CHAINLINK_WETH_USD: "",
    MahaToken: '',
    MAHA_ARTH_PAIR_ORACLE: '',
    ECOSYSTEMFUND: '',  // TODO: add this addr.
};

const DEPLOYER_ADDRS = {
    DEPLOYER: "0xbA1af27c0eFdfBE8B0FE1E8F890f9E896D1B2d6f",  // TODO; change this addr
    TIMELOCK: "0xbA1af27c0eFdfBE8B0FE1E8F890f9E896D1B2d6f" // TODO; change this addr
};

const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => delay(90000); // Wait 90s.

const TX_CONFIRMATIONS = 1;
const GAS_PRICE = 50 * 1000000000; // 5.1 gwei
const NETWORK_NAME = 'maticMumbai';
const COLLATERLAS = ['WETH', 'DAI'];
const OUTPUT_FILE = './output/maticMumbai1.json';
const ETHERSCAN_BASE_URL = 'https://mumbai.polygonscan.com/address';

module.exports = {
    COLLATERLAS,
    EXTERNAL_ADDRS,
    DEPLOYER_ADDRS,
    ...DEPLOYER_ADDRS,
    OUTPUT_FILE,
    waitFunction,
    GAS_PRICE,
    TX_CONFIRMATIONS,
    ETHERSCAN_BASE_URL,
    NETWORK_NAME
};