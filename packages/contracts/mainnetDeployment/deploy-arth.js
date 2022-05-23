const { network, ethers } = require("hardhat");

const oracles = [
  "UniswapPairOracle_ARTH_ARTHX",
  "UniswapPairOracle_ARTH_MAHA",
  "UniswapPairOracle_ARTH_USDC"
];

async function main() {
  console.log("network", network.name);

  const governance = "0x9a66fC7a20f21fB72d9f229984109246e9c9F4a5";

  // const ARTHValuecoin = await ethers.getContractFactory("ARTHValuecoin");
  // const instance = await ARTHValuecoin.deploy(governance);
  // await instance.deployed();
  // console.log("created", instance.address);

  await this.hre.run("verify:verify", {
    address: "0xA5C40F510dd2EdB8d8F8cBb425dACC5180458d1A",
    constructorArguments: [governance]
  });
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
