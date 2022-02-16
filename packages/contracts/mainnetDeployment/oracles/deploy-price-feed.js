const { network, ethers } = require('hardhat');

async function main() {
  console.log('network', network.name);

  const deployerWallet = (await ethers.getSigners())[0];

  console.log('i am', deployerWallet.address);

  const polygonArgs = [
    // "MAHA/USD", // string memory _name,
    // "0x455acbbC2c15c086978083968a69B2e7E4d38d34", // address _umbRegistry,
    // "0x0000000000000000000000000000000000000000000000004d4148412d555344", // bytes32 _key
  ];

  const bscArgs = [
    '0xfF7DBa878C60A5Eb76E052aeAaf023FC45095eA8', // address _umbOracle,
    '0x0000000000000000000000000000000000000000', // address _chainlinkOracleAddress,
    '0xdD465B9c68750a02c307744a749954B1F9787efb', // address _gmuOracle
  ];

  const args = bscArgs;

  const PriceFeed = await ethers.getContractFactory('PriceFeed');
  const instance = await PriceFeed.deploy();
  console.log('created', instance.address);
  await instance.deployed();

  console.log('setting addresses', args);
  await instance.setAddresses(...args);

  await this.hre.run("verify:verify", {
    address: instance.address,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });