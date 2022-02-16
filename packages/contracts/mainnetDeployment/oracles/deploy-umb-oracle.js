const { network, ethers } = require('hardhat');

async function main() {
  console.log('network', network.name);

  const deployerWallet = (await ethers.getSigners())[0];

  console.log('i am', deployerWallet.address);

  const polygonArgs = [
    "MAHA/USD", // string memory _name,
    "0x455acbbC2c15c086978083968a69B2e7E4d38d34", // address _umbRegistry,
    "0x0000000000000000000000000000000000000000000000004d4148412d555344", // bytes32 _key
  ];

  const bscArgs = [
    "MAHA/USD", // string memory _name,
    "0xb2C6c4162c0d2B6963C62A9133331b4D0359AA34", // address _umbRegistry,
    "0x0000000000000000000000000000000000000000000000004d4148412d555344", // bytes32 _key
  ];

  const constructorArguments = bscArgs;

  const UMBOracle = await ethers.getContractFactory('UMBOracle');
  // const instance = await UMBOracle.deploy(...constructorArguments);
  // console.log('created', instance.address);
  // await instance.deployed();

  await this.hre.run("verify:verify", {
    address: '0xfF7DBa878C60A5Eb76E052aeAaf023FC45095eA8',
    constructorArguments,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });