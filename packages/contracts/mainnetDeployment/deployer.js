const MainnetDeploymentHelper = require("../utils/mainnetDeploymentHelpers.js")

async function mainnetDeploy() {
  const date = new Date()
  const gasPrice = configParams.GAS_PRICE

  console.log('Deployment start time', date.toUTCString())
  console.log('Gas price', gasPrice.toString());

  const deployerWallet = (await ethers.getSigners())[0]
  
  const mdh = new MainnetDeploymentHelper(configParams, deployerWallet)
  await mdh.loadAllContractFactories()
  const deploymentState = mdh.loadPreviousDeployment()

  console.log(`Deployer address: ${deployerWallet.address}`)
  assert.equal(deployerWallet.address, configParams.DEPLOYER_ADDRS.DEPLOYER)
  let deployerETHBalance = await ethers.provider.getBalance(deployerWallet.address)
  console.log(`Deployer ETH balance before: ${deployerETHBalance}`)

  // Deploy core logic contracts.
  await mdh.deployTestnet(deploymentState)

  deployerETHBalance = await ethers.provider.getBalance(deployerWallet.address)
  console.log(`Deployer's ETH balance after deployments: ${deployerETHBalance}`)
}


async function testnetDeploy(configParams) {
    const date = new Date()
    const gasPrice = configParams.GAS_PRICE

    console.log('Deployment start time', date.toUTCString())
    console.log('Gas price', gasPrice.toString());

    const deployerWallet = (await ethers.getSigners())[0]

    const mdh = new MainnetDeploymentHelper(configParams, deployerWallet)
    await mdh.loadAllContractFactories()
    const deploymentState = mdh.loadPreviousDeployment()

    console.log(`Deployer address: ${deployerWallet.address}`)
    assert.equal(deployerWallet.address, configParams.DEPLOYER_ADDRS.DEPLOYER)
    let deployerETHBalance = await ethers.provider.getBalance(deployerWallet.address)
    console.log(`Deployer ETH balance before: ${deployerETHBalance}`)

    // Deploy core logic contracts.
    await mdh.deployTestnet(deploymentState)

    deployerETHBalance = await ethers.provider.getBalance(deployerWallet.address)
    console.log(`Deployer's ETH balance after deployments: ${deployerETHBalance}`)
}

module.exports = {
  mainnetDeploy,
  testnetDeploy
}
