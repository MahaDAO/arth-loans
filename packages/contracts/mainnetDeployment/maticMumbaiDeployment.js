const { testnetDeploy } = require('./deployer.js')
const configParams = require("./params/maticMumbai.js")

async function main() {
  await testnetDeploy(configParams);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
