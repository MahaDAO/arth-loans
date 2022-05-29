const zeroAddress = "0x" + "0".repeat(40);

const EXTERNAL_ADDRS = {
  MAHA: "0x4EC8E506E3E900Bc1593C367eBDE40a1f7c6aFA7",
  WBNB: "0x6f3B03fFF0685452c6133fF0FD3ADd60492cdF18"
};

const DEPLOYER_ADDRS = {
  DEPLOYER: "0xbA1af27c0eFdfBE8B0FE1E8F890f9E896D1B2d6f", // TODO; change this addr
  TIMELOCK: "0xbA1af27c0eFdfBE8B0FE1E8F890f9E896D1B2d6f" // TODO; change this addr
};

const PRICEFEED_CONFIGS = {
  WBNB: "0xe5aB3842A33D7cc3EAB45a081e3cbFcf4A782bff"
};

const e18 = ethers.BigNumber.from(10).pow(18);
const inf = ethers.BigNumber.from(10).pow(30);

const DEBT_CIELINGS = {
  WBNB: inf
};

const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => delay(90000); // Wait 90s.

const TX_CONFIRMATIONS = 1;
const GAS_PRICE = 5 * 1000000000; // 5.1 gwei
const NETWORK_NAME = "bscTestnet";
const COLLATERLAS = ["WBNB"];
const OUTPUT_FILE = "./output/bscTestnet.json";
const ETHERSCAN_BASE_URL = "https://testnet.bscscan.com/address";

module.exports = {
  PRICEFEED_CONFIGS,
  COLLATERLAS,
  EXTERNAL_ADDRS,
  DEPLOYER_ADDRS,
  DEBT_CIELINGS,
  OUTPUT_FILE,
  waitFunction,
  GAS_PRICE,
  TX_CONFIRMATIONS,
  ETHERSCAN_BASE_URL,
  NETWORK_NAME
};
