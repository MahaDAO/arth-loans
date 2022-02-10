const EXTERNAL_ADDRS  = {
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    ARTH: '0xE52509181FEb30EB4979E29EC70D50FD5C44D590',
    GMU_ORACLE: '0xBe5514E856a4eb971653BcC74475B26b56763FD0',
    WMATIC: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
    MahaToken: '0xedd6ca8a4202d4a36611e2fff109648c4863ae19',
    MAHA: '0xedd6ca8a4202d4a36611e2fff109648c4863ae19',
    ECOSYSTEMFUND: '0xC4E65254bb14dD5A99259247b0b9760722dc2A7F',  // TODO: add this addr.
};

const EXTERNAL_ADDRS  = {
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    MAHA: '0xCE86F7fcD3B40791F63B86C3ea3B8B355Ce2685b',
    MahaToken: '0xCE86F7fcD3B40791F63B86C3ea3B8B355Ce2685b',
};

const DEPLOYER_ADDRS = {
    DEPLOYER: "0xc3c1f5e3C94b7a05B3bB314c187d1df0f45c814F",  // TODO; change this addr
    TIMELOCK: "0xc3c1f5e3C94b7a05B3bB314c187d1df0f45c814F" // TODO; change this addr
};

const PRICEFEED_CONFIGS = {
    WMATIC: {
        baseAsset: zeroAddress,
        quoteAsset: zeroAddress,
        uniPairOracle: zeroAddress,
        priceAggregator: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0", // MATIC/USD
    },
    DAI: {
        baseAsset: zeroAddress,
        quoteAsset: zeroAddress,
        uniPairOracle: zeroAddress,
        priceAggregator: "0x4746DeC9e833A82EC7C2C1356372CcF2cfcD2F3D", // DAI/USD
    },
    WETH: {
        baseAsset: zeroAddress,
        quoteAsset: zeroAddress,
        uniPairOracle: zeroAddress,
        priceAggregator: "0xF9680D99D6C9589e2a93a78A04A279e509205945", // WETH/USD
    },
    MAHA: {
        baseAsset: "0xCE86F7fcD3B40791F63B86C3ea3B8B355Ce2685b",
        quoteAsset: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        uniPairOracle: "", // MAHA/WBNB Uni
        priceAggregator: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE", // WBNB/USD
    }
};


const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => delay(90000); // Wait 90s.

const TX_CONFIRMATIONS = 1;
const GAS_PRICE = 50 * 1000000000; // 5.1 gwei
const NETWORK_NAME = 'matic';
const COLLATERLAS = ['MAHA'];
const OUTPUT_FILE = './output/matic.json';
const ETHERSCAN_BASE_URL = 'https://polygonscan.com/address';

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
