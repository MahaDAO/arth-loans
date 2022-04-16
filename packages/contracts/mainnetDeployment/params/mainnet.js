const zeroAddress = "0x" + "0".repeat(40);

const EXTERNAL_ADDRS = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  FXS: "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0"
};

const DEPLOYER_ADDRS = {
  DEPLOYER: "0x6357EDbfE5aDA570005ceB8FAd3139eF5A8863CC", // TODO; change this addr
  TIMELOCK: "0x6357EDbfE5aDA570005ceB8FAd3139eF5A8863CC" // TODO; change this addr
};

const PRICEFEED_CONFIGS = {
  WET: "0x15726a29c398e65Ae5dA551DFf3BBC26D767d0F7",
  FXS: "0xe448dd09596Cc32677613C14F52FCd72fa0a984b"
};

const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => delay(90000); // Wait 90s.

const TX_CONFIRMATIONS = 1;
const GAS_PRICE = 30 * 1000000000; // 5.1 gwei
const NETWORK_NAME = "mainnet";
const COLLATERLAS = ["WETH"];
const OUTPUT_FILE = "./output/mainnet.json";
const ETHERSCAN_BASE_URL = "https://etherscan.io/address";

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
