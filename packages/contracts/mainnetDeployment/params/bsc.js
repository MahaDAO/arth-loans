const zeroAddress = "0x" + "0".repeat(40);

const EXTERNAL_ADDRS = {
  MAHA: "0xCE86F7fcD3B40791F63B86C3ea3B8B355Ce2685b",
  "BUSD-V2": "0xe9e7cea3dedca5984780bafc599bd69add087d56",
  "BUSDUSDT-APE-LP-S": "0xc5FB6476a6518dd35687e0Ad2670CB8Ab5a0D4C5",
  "BUSDUSDC-APE-LP-S": "0xBb9858603B1FB9375f6Df972650343e985186Ac5"
};

const DEPLOYER_ADDRS = {
  DEPLOYER: "0xc3c1f5e3C94b7a05B3bB314c187d1df0f45c814F", // TODO; change this addr
  TIMELOCK: "0x9a66fC7a20f21fB72d9f229984109246e9c9F4a5" // TODO; change this addr
};

const PRICEFEED_CONFIGS = {
  "BUSD-V2": "0x97651d5188af954ce1402Ca7288D6F74A6F5f09e",
  "BUSDUSDT-APE-LP-S": "0x2658140C0981e1d179482226b0e382350C9C8b18",
  "BUSDUSDC-APE-LP-S": "0x6852F8bB8a476fCAD8D6a54aF4a1A61B29146484"
};

const e18 = ethers.BigNumber.from(10).pow(18);
const inf = ethers.BigNumber.from(10).pow(30);

const DEBT_CIELINGS = {
  "BUSD-V2": inf, // infinity
  "BUSDUSDT-APE-LP-S": e18.mul(1000000), // 1mil
  "BUSDUSDC-APE-LP-S": e18.mul(1000000) // 1mil
};

const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => delay(90000); // Wait 90s.

const TX_CONFIRMATIONS = 1;
const GAS_PRICE = 5 * 1000000000; // 5.1 gwei
const NETWORK_NAME = "bsc";
const COLLATERLAS = ["BUSD-V2"];
const OUTPUT_FILE = "./output/bsc.json";
const ETHERSCAN_BASE_URL = "https://bscscan.com/address";

module.exports = {
  PRICEFEED_CONFIGS,
  COLLATERLAS,
  EXTERNAL_ADDRS,
  DEPLOYER_ADDRS,
  DEBT_CIELINGS,
  ...DEPLOYER_ADDRS,
  OUTPUT_FILE,
  waitFunction,
  GAS_PRICE,
  TX_CONFIRMATIONS,
  ETHERSCAN_BASE_URL,
  NETWORK_NAME
};
