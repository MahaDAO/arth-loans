const EXTERNAL_ADDRS  = {
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    MAHA: '0xCE86F7fcD3B40791F63B86C3ea3B8B355Ce2685b',
    CHAINLINK_WBNB_USD: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
    CHAINLINK_BUSD_USD: "0xcBb98864Ef56E9042e7d2efef76141f15731B82f",
    // CHAINLINK_MAHA_USD: "0xF9680D99D6C9589e2a93a78A04A279e509205945",
    MahaToken: '0xCE86F7fcD3B40791F63B86C3ea3B8B355Ce2685b',
};

const DEPLOYER_ADDRS = {
    DEPLOYER: "0xc3c1f5e3C94b7a05B3bB314c187d1df0f45c814F",  // TODO; change this addr
    TIMELOCK: "0xc3c1f5e3C94b7a05B3bB314c187d1df0f45c814F" // TODO; change this addr
};

const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => delay(90000); // Wait 90s.

const TX_CONFIRMATIONS = 1;
const GAS_PRICE = 50 * 1000000000; // 5.1 gwei
const NETWORK_NAME = 'bsc';
const COLLATERLAS = ['WBNB', 'BUSD', 'MAHA'];
const OUTPUT_FILE = './output/bsc.json';
const ETHERSCAN_BASE_URL = 'https://bscscan.com/address';

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