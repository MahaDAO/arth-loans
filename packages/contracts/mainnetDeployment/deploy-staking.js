const { network, ethers } = require('hardhat');

const oracles = [
    'UniswapPairOracle_ARTH_ARTHX',
    'UniswapPairOracle_ARTH_MAHA',
    'UniswapPairOracle_ARTH_USDC',
];

async function main() {
    console.log('network', network.name);

    const distributor = '0xeccE08c2636820a81FC0c805dBDC7D846636bbc4';

    const pancakeARTHBUSD = '0x80342bc6125a102a33909d124a6c26CC5D7b8d56';
    const pancakeARTHMAHA = '0xb955d5b120ff5b803cdb5a225c11583cd56b7040';
    const bscMAHA = '0xCE86F7fcD3B40791F63B86C3ea3B8B355Ce2685b';

    const quickswapARTHUSDC = '0x34aAfA58894aFf03E137b63275aff64cA3552a3E';
    const quickswapARTHMAHA = '0x95de8efD01dc92ab2372596B3682dA76a79f24c3';
    const polygonMAHA = '0xedd6ca8a4202d4a36611e2fff109648c4863ae19';

    const deployerWallet = (await ethers.getSigners())[0];
    const maha = polygonMAHA;
    const stakingToken = quickswapARTHUSDC;
    const duration = 86400 * 30; // 1 month

    console.log('i am', deployerWallet.address);

    const constructorArguments = [
        distributor, // address _rewardsDistribution,
        maha, // address _rewardsToken,
        stakingToken, // address _stakingToken,
        duration// uint256 _rewardsDuration
    ];

    const StakingRewards = await ethers.getContractFactory('StakingRewards');
    const instance = await StakingRewards.deploy(...constructorArguments);
    await instance.deployed();
    console.log('created', instance.address);

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