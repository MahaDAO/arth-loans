const { utils } = require('ethers');
const { network, ethers } = require('hardhat');

require('dotenv').config();

async function main() {
  // Fetch already deployed contracts.
  const deployements = require(`../output/stagingMaticMumbai.json`);

  const { provider } = ethers;

  const estimateGasPrice = await provider.getGasPrice();
  const gasPrice = estimateGasPrice.mul(3).div(2);
  console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

  const tokens = ['WMATIC', 'WETH', 'DAI'];
  const prices = [
    utils.parseEther('1').mul(15).div(10), 
    utils.parseEther('1').mul(2200), 
    utils.parseEther('1'),
  ];

  for(let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const price = prices[i];
    const addr = deployements[`${token}PriceFeed`].address;

    console.log('\nUpdating testnet price for', token, ethers.utils.formatUnits(price, 'ether'), addr, '\n');

    const instance = await ethers.getContractAt(
        'PriceFeedTestnet',
        deployements[`${token}PriceFeed`].address
    );

    await instance.setPrice(price, { gasPrice });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });