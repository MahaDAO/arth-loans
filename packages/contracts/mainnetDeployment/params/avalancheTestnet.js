const EXTERNAL_ADDRS  = {
    WAVAX: '',
    WFTM: '',
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

const e18 = ethers.BigNumber.from(10).pow(18);
const inf = ethers.BigNumber.from(10).pow(30);

const DEBT_CIELINGS = {
  "WFTM": inf, // infinity
  "WAVAX": inf,
  "BUSDUSDT-APE-LP-S": e18.mul(1000000), // 1mil
  "BUSDUSDC-APE-LP-S": e18.mul(1000000) // 1mil
};

const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => delay(90000); // Wait 90s.

const TX_CONFIRMATIONS = 1;
const GAS_PRICE = 200 * 1000000000; // 5.1 gwei
const NETWORK_NAME = 'avalancheTestnet';
const COLLATERLAS = ['WAVAX'];
const OUTPUT_FILE = './output/avalanceTestnet.json';
const ETHERSCAN_BASE_URL = 'https://testnet.snowtrace.io/address';

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
    NETWORK_NAME,
    DEBT_CIELINGS
};
