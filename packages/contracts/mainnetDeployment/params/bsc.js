const zeroAddress = '0x' + '0'.repeat(40)

const EXTERNAL_ADDRS  = {
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    MAHA: '0xCE86F7fcD3B40791F63B86C3ea3B8B355Ce2685b',
    MahaToken: '0xCE86F7fcD3B40791F63B86C3ea3B8B355Ce2685b',
};

const DEPLOYER_ADDRS = {
    DEPLOYER: "0xbA1af27c0eFdfBE8B0FE1E8F890f9E896D1B2d6f",  // TODO; change this addr
    TIMELOCK: "0xbA1af27c0eFdfBE8B0FE1E8F890f9E896D1B2d6f" // TODO; change this addr
};

const PRICEFEED_CONFIGS = {
    WBNB: {
        baseAsset: zeroAddress,
        quoteAsset: zeroAddress,
        uniPairOracle: zeroAddress,
        priceAggregator: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE", // WBNB/USD
    },
    BUSD: {
        baseAsset: zeroAddress,
        quoteAsset: zeroAddress,
        uniPairOracle: zeroAddress,
        priceAggregator: "0xcBb98864Ef56E9042e7d2efef76141f15731B82f", // BUSD/USD
    },
    MAHA: {
        baseAsset: "0xCE86F7fcD3B40791F63B86C3ea3B8B355Ce2685b",
        quoteAsset: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        uniPairOracle: "0xCdf53e1d7C2Dabe3973d601Fa28290f4bC1e90b7", // MAHA/WBNB Uni
        priceAggregator: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE", // WBNB/USD
    }
}

const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => delay(90000); // Wait 90s.

const TX_CONFIRMATIONS = 1;
const GAS_PRICE = 50 * 1000000000; // 5.1 gwei
const NETWORK_NAME = 'bsc';
const COLLATERLAS = ['WBNB', 'BUSD', 'MAHA'];
const OUTPUT_FILE = './output/bsc.json';
const ETHERSCAN_BASE_URL = 'https://bscscan.com/address';

module.exports = {
    PRICEFEED_CONFIGS,
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
