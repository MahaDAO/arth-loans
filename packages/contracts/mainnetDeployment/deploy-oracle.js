const { network, ethers } = require('hardhat');

async function main() {
  console.log('network', network.name);

  const deployerWallet = (await ethers.getSigners())[0];

  console.log('i am', deployerWallet.address);

  const constructorArguments = [
    "MAHA/USD", // address _rewardsDistribution,
    "0x455acbbC2c15c086978083968a69B2e7E4d38d34", // address _rewardsToken,
    "0x0000000000000000000000000000000000000000000000004d4148412d555344",
  ];

  const StakingRewards = await ethers.getContractFactory('UMBOracle');
  const instance = await StakingRewards.deploy(...constructorArguments);
  console.log('created', instance.address);
  await instance.deployed();

  await this.hre.run("verify:verify", {
    address: instance.address,
    constructorArguments,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });