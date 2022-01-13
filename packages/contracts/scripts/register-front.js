const { utils } = require('ethers');
const { network, ethers } = require('hardhat');

require('dotenv').config();

async function main() {
  // Fetch already deployed contracts.
  const deployements = require(`../output/matic.json`);

  const { provider } = ethers;

  const estimateGasPrice = await provider.getGasPrice();
  const gasPrice = estimateGasPrice.mul(3).div(2);
  console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

  const tokens = ['WMATIC', 'WETH', 'DAI'];

  for(let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    console.log('\nSetting frontend for', token, '\n');

    const boInstance = await ethers.getContractAt(
        'BorrowerOperations',
        deployements[`${token}BorrowerOperations`].address
    );

    const spInstance = await ethers.getContractAt(
        'StabilityPool',
        deployements[`${token}StabilityPool`].address
    );

    await spInstance.registerFrontEnd(utils.parseEther('1').mul(90).div(100), { gasPrice })
    await boInstance.registerFrontEnd({ gasPrice });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });