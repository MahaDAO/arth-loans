const { mainnetDeploy } = require('./deployer.js')
const configParams = require("./params/rinkeby.js")

async function main() {
  await mainnetDeploy(configParams)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
