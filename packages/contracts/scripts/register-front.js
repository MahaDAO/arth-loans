const { utils } = require('ethers');
const { network, ethers } = require('hardhat');

require('dotenv').config();

async function main() {
  const { provider } = ethers;

  const estimateGasPrice = await provider.getGasPrice();
  const gasPrice = estimateGasPrice.mul(3).div(2);
  console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

  const instance = await ethers.getContractAt(
    'LiquityLUSDToken',
    "0xd0d2DBdb27598fb2214bD6FB270560046A2Ff9A4"
  );

  await instance.toggleBorrowerOperations("0xcFC5E66C35cE267f2d030D626270064a1342F058", { gasPrice })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });