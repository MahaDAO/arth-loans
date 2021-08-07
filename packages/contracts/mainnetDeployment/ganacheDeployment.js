const deploymentHelper = require("../utils/ganacheDeploymentHelpers.js");

async function main() {
  const deployments = new deploymentHelper();
  const [owner,bountyAddress, lpRewardsAddress, multisig] = await ethers.getSigners();
  
  const coreContracts = await deployments.deployLiquityCore(owner.address, owner.address);
  const LQTYContracts = await deployments.deployLQTYContractsHardhat(
    bountyAddress.address, 
    lpRewardsAddress.address, 
    multisig.address
  );

  await deployments.connectLQTYContracts(LQTYContracts);
  await deployments.connectCoreContracts(coreContracts, LQTYContracts);
  await deployments.connectLQTYContractsToCore(LQTYContracts, coreContracts);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });

