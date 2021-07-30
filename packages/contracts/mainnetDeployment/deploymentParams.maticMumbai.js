const externalAddrs  = {
    CHAINLINK_ETHUSD_PROXY: "0x0715A7794a1dc8e42615F059dD6e406A6594651A", 
    UNISWAP_V2_FACTORY: "0xc35dadb65012ec5796536bd9864ed8773abc74c4",
    UNIWAP_V2_ROUTER02: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
    WETH_ERC20: "0x5b67676a984807a212b1c59ebfc9b3568a474f0a",
}

const liquityAddrsTest = {
    GENERAL_SAFE:"0x8be7e24263c199ebfcfd6aebca83f8d7ed85a5dd",  // Hardhat dev address
    LQTY_SAFE:"0x20c81d658aae3a8580d990e441a9ef2c9809be74",  //  Hardhat dev address
    DEPLOYER: "0x44DD28a7D636bBAad0f491632Ac447983652342B"  // Mainnet test deployment address
}
  
const liquityAddrs = {
    GENERAL_SAFE:"0x0047056B8136e9294A731c0Fcceb26455026d56d",  // TODO
    LQTY_SAFE:"0xcb6419a5661250CEb8C6B2354a713CdaBB5722a5",  // TODO
    DEPLOYER: "0x44DD28a7D636bBAad0f491632Ac447983652342B",
    TIMELOCK: "0x44DD28a7D636bBAad0f491632Ac447983652342B"
}

const beneficiaries = {
    TEST_INVESTOR_A: "0xB8A0db9905E5f90F4A2162603AfA9A655B821915",
    TEST_INVESTOR_B: "0x330f46D965469a3D1D419b426df0f45b06c625ad",
    TEST_INVESTOR_C: "0xB5Bd916bf23B5C0a675c60Bb2AA1fb210a51C0d7",
    TEST_INVESTOR_D: "0x0D4859A066c6aD448Aa3A96fd6Ee762A0FA81317",
    TEST_INVESTOR_E: "0xbfF590Fb7E7C4e8cFc584DbbdA540d16df2dc69c"
}

const OUTPUT_FILE = './mainnetDeployment/maticMumbaiDeploymentOutput.json'

const delay = ms => new Promise(res => setTimeout(res, ms));
    const waitFunction = async () => {
    return delay(90000) // Wait 90s.
}

const NETWORK_NAME = 'maticMumbai'
const GAS_PRICE = 1000000000  // 1 Gwei
const TX_CONFIRMATIONS = 1

const ETHERSCAN_BASE_URL = 'https://mumbai.polygonscan.com/address'

module.exports = {
    externalAddrs,
    liquityAddrs,
    beneficiaries,
    OUTPUT_FILE,
    waitFunction,
    NETWORK_NAME,
    GAS_PRICE,
    TX_CONFIRMATIONS,
    ETHERSCAN_BASE_URL,
    NETWORK_NAME
};
  