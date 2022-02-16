const { network, ethers } = require('hardhat');

async function main() {
  console.log('network', network.name);

  const instance = await ethers.getContractAt('PriceFeed', '0xAa24b64C9B44D874368b09325c6D60165c4B39f2');
  const price = await instance.callStatic.fetchPrice();
  console.log(price.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });