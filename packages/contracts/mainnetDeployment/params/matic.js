const EXTERNAL_ADDRS  = {
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    ARTH: '0xE52509181FEb30EB4979E29EC70D50FD5C44D590',
    GMU_ORACLE: '0xBe5514E856a4eb971653BcC74475B26b56763FD0',
    WMATIC: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
    CHAINLINK_WMATIC_USD: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",
    CHAINLINK_DAI_USD: "0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D",
    CHAINLINK_WETH_USD: "0xF9680D99D6C9589e2a93a78A04A279e509205945",
    MahaToken: '0xedd6ca8a4202d4a36611e2fff109648c4863ae19',
    MAHA_ARTH_PAIR_ORACLE: '0xFC645E3c39e257d634bBea9637a4c7f326eB4B50',
    ECOSYSTEMFUND: '0xC4E65254bb14dD5A99259247b0b9760722dc2A7F',  // TODO: add this addr.
};

const DEPLOYER_ADDRS = {
    DEPLOYER: "0x459438151b1f97880732cde20950523987EC6e91",  // TODO; change this addr
    TIMELOCK: "0x459438151b1f97880732cde20950523987EC6e91" // TODO; change this addr
};

const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => delay(90000); // Wait 90s.

const TX_CONFIRMATIONS = 1;
const GAS_PRICE = 50 * 1000000000; // 5.1 gwei
const NETWORK_NAME = 'matic';
const COLLATERLAS = ['WETH', 'DAI', 'WMATIC'];
const OUTPUT_FILE = './output/matic.json';
const ETHERSCAN_BASE_URL = 'https://polygonscan.com/address';

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
