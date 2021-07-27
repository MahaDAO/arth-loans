const { BigNumber } = require('ethers')
const fs = require('fs')

const ZERO_ADDRESS = '0x' + '0'.repeat(40)
const maxBytes32 = '0x' + 'f'.repeat(64)

class MainnetDeploymentHelper {
  constructor(configParams, deployerWallet) {
    this.configParams = configParams
    this.deployerWallet = deployerWallet
    this.hre = require("hardhat")
    this.knownContracts = require("./knownContracts.js");
  }

  loadPreviousDeployment() {
    let previousDeployment = {}
    if (fs.existsSync(this.configParams.OUTPUT_FILE)) {
      console.log(`Loading previous deployment...`)
      previousDeployment = require('../' + this.configParams.OUTPUT_FILE)
    }

    return previousDeployment
  }

  saveDeployment(deploymentState) {
    const deploymentStateJSON = JSON.stringify(deploymentState, null, 2)
    fs.writeFileSync(this.configParams.OUTPUT_FILE, deploymentStateJSON)

  }
  // --- Deployer methods ---

  async getFactory(name) {
    const factory = await ethers.getContractFactory(name, this.deployerWallet)
    return factory
  }

  async sendAndWaitForTransaction(txPromise) {
    const tx = await txPromise
    const minedTx = await ethers.provider.waitForTransaction(tx.hash, this.configParams.TX_CONFIRMATIONS)

    return minedTx
  }

  async loadOrDeploy(factory, name, deploymentState, params=[]) {
    if (deploymentState[name] && deploymentState[name].address) {
      console.log(`Using previously deployed ${name} contract at address ${deploymentState[name].address}`)
      return new ethers.Contract(
        deploymentState[name].address,
        factory.interface,
        this.deployerWallet
      );
    }

    const contract = await factory.deploy(...params, {gasPrice: this.configParams.GAS_PRICE})
    await this.deployerWallet.provider.waitForTransaction(contract.deployTransaction.hash, this.configParams.TX_CONFIRMATIONS)

    deploymentState[name] = {
      address: contract.address,
      txHash: contract.deployTransaction.hash
    }

    this.saveDeployment(deploymentState)

    return contract
  }

  async deployLiquityCoreMainnet(tellorMasterAddr, deploymentState) {
    // Get contract factories
    const arthControllerFactory = await this.getFactory("ARTHController")
    const coreControllerFactory = await this.getFactory("Controller")
    const governanceFactory = await this.getFactory('Governance')
    const gmuOracleFactory = await this.getFactory("GMUOracle");
    const priceFeedFactory = await this.getFactory("PriceFeed")
    const sortedTrovesFactory = await this.getFactory("SortedTroves")
    const troveManagerFactory = await this.getFactory("TroveManager")
    const activePoolFactory = await this.getFactory("ActivePool")
    const stabilityPoolFactory = await this.getFactory("StabilityPool")
    const gasPoolFactory = await this.getFactory("GasPool")
    const defaultPoolFactory = await this.getFactory("DefaultPool")
    const collSurplusPoolFactory = await this.getFactory("CollSurplusPool")
    const borrowerOperationsFactory = await this.getFactory("BorrowerOperations")
    const hintHelpersFactory = await this.getFactory("HintHelpers")
    const lusdTokenFactory = await this.getFactory("LUSDToken")
    const mahaTokenFactory = await this.getFactory("MahaToken")  // TODO: do no redeploy in mainnet as it already exists.
    const mahaARTHPairoracleFactory = await this.getFactory("MockUniswapOracle")  // TODO: replace with the proper oracle as it exists on mainnet.
    const ecosystemFundFactory = await this.getFactory("EcosystemFund")
    // const tellorCallerFactory = await this.getFactory("TellorCaller")

    // Deploy txs
    const ecosystemFund = await this.loadOrDeploy(ecosystemFundFactory, 'ecosystemFund', deploymentState)
    const gmuOracle = await this.loadOrDeploy(gmuOracleFactory, 'gmuOracle', deploymentState, [BigNumber.from(2e6)])
    const priceFeed = await this.loadOrDeploy(priceFeedFactory, 'priceFeed', deploymentState)
    const sortedTroves = await this.loadOrDeploy(sortedTrovesFactory, 'sortedTroves', deploymentState)
    const troveManager = await this.loadOrDeploy(troveManagerFactory, 'troveManager', deploymentState)
    const activePool = await this.loadOrDeploy(activePoolFactory, 'activePool', deploymentState)
    const stabilityPool = await this.loadOrDeploy(stabilityPoolFactory, 'stabilityPool', deploymentState)
    const gasPool = await this.loadOrDeploy(gasPoolFactory, 'gasPool', deploymentState)
    const defaultPool = await this.loadOrDeploy(defaultPoolFactory, 'defaultPool', deploymentState)
    const collSurplusPool = await this.loadOrDeploy(collSurplusPoolFactory, 'collSurplusPool', deploymentState)
    const borrowerOperations = await this.loadOrDeploy(borrowerOperationsFactory, 'borrowerOperations', deploymentState)
    const hintHelpers = await this.loadOrDeploy(hintHelpersFactory, 'hintHelpers', deploymentState)
    const mahaToken = await this.loadOrDeploy(mahaTokenFactory, 'mahaToken', deploymentState)
    const governance = await this.loadOrDeploy(governanceFactory, 'governance', deploymentState, [troveManager.address, borrowerOperations.address])
    // const tellorCaller = await this.loadOrDeploy(tellorCallerFactory, 'tellorCaller', deploymentState, [tellorMasterAddr])
    const lusdToken = await this.loadOrDeploy(
        lusdTokenFactory,
        'lusdToken',
        deploymentState,
    )
    const mahaARTHPairOracle = await this.loadOrDeploy(mahaARTHPairoracleFactory, 'mahaARTHPairOracle', deploymentState)
    const controllerParams = [
        troveManager.address,
        stabilityPool.address,
        borrowerOperations.address,
        governance.address,
        lusdToken.address,
        gasPool.address
    ]
    const controller = await this.loadOrDeploy(coreControllerFactory, 'controller', deploymentState, controllerParams)

    const arthControllerParams = [
        lusdToken.address,
        mahaToken.address,
        this.configParams.liquityAddrs.DEPLOYER,
        this.configParams.liquityAddrs.TIMELOCK,
    ]
    const arthController = await this.loadOrDeploy(arthControllerFactory, 'arthController', deploymentState, arthControllerParams)

    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('No Etherscan Url defined, skipping verification')
    } else {
      await this.verifyContract('ecosystemFund', deploymentState)
      await this.verifyContract('mahaARTHPairOracle', deploymentState)
      await this.verifyContract('mahaToken', deploymentState)
      await this.verifyContract('controller', deploymentState, controllerParams)
      await this.verifyContract('arthController', deploymentState, arthControllerParams)
      await this.verifyContract('governance', deploymentState, [troveManager.address])
      await this.verifyContract('gmuOracle', deploymentState)
      await this.verifyContract('priceFeed', deploymentState)
      await this.verifyContract('sortedTroves', deploymentState)
      await this.verifyContract('troveManager', deploymentState)
      await this.verifyContract('activePool', deploymentState)
      await this.verifyContract('stabilityPool', deploymentState)
      await this.verifyContract('gasPool', deploymentState)
      await this.verifyContract('defaultPool', deploymentState)
      await this.verifyContract('collSurplusPool', deploymentState)
      await this.verifyContract('borrowerOperations', deploymentState)
      await this.verifyContract('hintHelpers', deploymentState)
      // await this.verifyContract('tellorCaller', deploymentState, [tellorMasterAddr])
      await this.verifyContract('lusdToken', deploymentState)
    }

    const coreContracts = {
      gmuOracle,
      priceFeed,
      governance,
      lusdToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      borrowerOperations,
      hintHelpers,
      arthController,
      ecosystemFund,
      controller,
      mahaToken,
      mahaARTHPairOracle
      // tellorCaller
    }

    return coreContracts
  }

  async deployLQTYContractsMainnet(bountyAddress, lpRewardsAddress, multisigAddress, deploymentState) {
    const lqtyStakingFactory = await this.getFactory("LQTYStaking")
    const lockupContractFactory_Factory = await this.getFactory("LockupContractFactory")
    const communityIssuanceFactory = await this.getFactory("CommunityIssuance")
    const lqtyTokenFactory = await this.getFactory("LQTYToken")

    const lqtyStaking = await this.loadOrDeploy(lqtyStakingFactory, 'lqtyStaking', deploymentState)
    const lockupContractFactory = await this.loadOrDeploy(lockupContractFactory_Factory, 'lockupContractFactory', deploymentState)
    const communityIssuance = await this.loadOrDeploy(communityIssuanceFactory, 'communityIssuance', deploymentState)

    // Deploy LQTY Token, passing Community Issuance and Factory addresses to the constructor
    const lqtyTokenParams = [
      communityIssuance.address,
      lqtyStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress,
      multisigAddress
    ]
    const lqtyToken = await this.loadOrDeploy(
      lqtyTokenFactory,
      'lqtyToken',
      deploymentState,
      lqtyTokenParams
    )

    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('No Etherscan Url defined, skipping verification')
    } else {
      await this.verifyContract('lqtyStaking', deploymentState)
      await this.verifyContract('lockupContractFactory', deploymentState)
      await this.verifyContract('communityIssuance', deploymentState)
      await this.verifyContract('lqtyToken', deploymentState, lqtyTokenParams)
    }

    const LQTYContracts = {
      lqtyStaking,
      lockupContractFactory,
      communityIssuance,
      lqtyToken
    }
    return LQTYContracts
  }

  async deployUnipoolMainnet(deploymentState) {
    const unipoolFactory = await this.getFactory("Unipool")
    const unipool = await this.loadOrDeploy(unipoolFactory, 'unipool', deploymentState)

    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('No Etherscan Url defined, skipping verification')
    } else {
      await this.verifyContract('unipool', deploymentState)
    }

    return unipool
  }

  async deployMultiTroveGetterMainnet(liquityCore, deploymentState) {
    const multiTroveGetterFactory = await this.getFactory("MultiTroveGetter")
    const multiTroveGetterParams = [
      liquityCore.troveManager.address,
      liquityCore.sortedTroves.address
    ]
    const multiTroveGetter = await this.loadOrDeploy(
      multiTroveGetterFactory,
      'multiTroveGetter',
      deploymentState,
      multiTroveGetterParams
    )

    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('No Etherscan Url defined, skipping verification')
    } else {
      await this.verifyContract('multiTroveGetter', deploymentState, multiTroveGetterParams)
    }

    return multiTroveGetter
  }
  // --- Connector methods ---

  async isOwnershipRenounced(contract) {
    const owner = await contract.owner()
    return owner == ZERO_ADDRESS
  }
  
  // Connect contracts to their dependencies
  async connectCoreContractsMainnet(contracts, LQTYContracts, chainlinkProxyAddress) {
    const gasPrice = this.configParams.GAS_PRICE
    
    // Set ChainlinkAggregatorProxy and TellorCaller in the PriceFeed
    await this.isOwnershipRenounced(contracts.priceFeed) ||
      await this.sendAndWaitForTransaction(contracts.priceFeed.setAddresses(chainlinkProxyAddress, contracts.gmuOracle.address, {gasPrice}))
    
    await this.sendAndWaitForTransaction(contracts.governance.setPriceFeed(contracts.priceFeed.address, {gasPrice}))
    await this.sendAndWaitForTransaction(contracts.governance.setStabilityFeeToken(
        contracts.mahaToken.address,
        contracts.mahaARTHPairOracle.address,
        {gasPrice}
    ))
    await this.sendAndWaitForTransaction(contracts.governance.setFund(
        contracts.ecosystemFund.address,
        {gasPrice}
    ))
    await this.sendAndWaitForTransaction(contracts.arthController.addPool(contracts.controller.address, {gasPrice}))
    
    // set TroveManager addr in SortedTroves
    await this.isOwnershipRenounced(contracts.sortedTroves) ||
      await this.sendAndWaitForTransaction(contracts.sortedTroves.setParams(
        maxBytes32,
        contracts.troveManager.address,
        contracts.borrowerOperations.address, 
	    {gasPrice}
      ))

    // set contracts in the Trove Manager
    await this.isOwnershipRenounced(contracts.troveManager) ||
      await this.sendAndWaitForTransaction(contracts.troveManager.setAddresses(
        contracts.borrowerOperations.address,
        contracts.activePool.address,
        contracts.defaultPool.address,
        contracts.stabilityPool.address,
        contracts.gasPool.address,
        contracts.collSurplusPool.address,
        contracts.lusdToken.address,
        contracts.sortedTroves.address,
        LQTYContracts.lqtyToken.address,
        contracts.governance.address,
        contracts.controller.address,
        this.configParams.externalAddrs.WETH_ERC20,
	    {gasPrice}
      ))

    // set contracts in BorrowerOperations 
    await this.isOwnershipRenounced(contracts.borrowerOperations) ||
      await this.sendAndWaitForTransaction(contracts.borrowerOperations.setAddresses(
        contracts.troveManager.address,
        contracts.activePool.address,
        contracts.defaultPool.address,
        contracts.stabilityPool.address,
        contracts.gasPool.address,
        contracts.collSurplusPool.address,
        contracts.sortedTroves.address,
        contracts.lusdToken.address,
        this.configParams.externalAddrs.WETH_ERC20,
        contracts.governance.address,
        contracts.controller.address,
	    {gasPrice}
      ))

    // set contracts in the Pools
    await this.isOwnershipRenounced(contracts.stabilityPool) ||
      await this.sendAndWaitForTransaction(contracts.stabilityPool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.troveManager.address,
        contracts.activePool.address,
        contracts.lusdToken.address,
        contracts.sortedTroves.address,
        LQTYContracts.communityIssuance.address,
        this.configParams.externalAddrs.WETH_ERC20,
        contracts.governance.address,
        contracts.controller.address,
	    {gasPrice}
      ))

    await this.isOwnershipRenounced(contracts.activePool) ||
      await this.sendAndWaitForTransaction(contracts.activePool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.troveManager.address,
        contracts.stabilityPool.address,
        contracts.defaultPool.address,
        contracts.collSurplusPool.address,
        this.configParams.externalAddrs.WETH_ERC20,
	    {gasPrice}
      ))

    await this.isOwnershipRenounced(contracts.defaultPool) ||
      await this.sendAndWaitForTransaction(contracts.defaultPool.setAddresses(
        contracts.troveManager.address,
        contracts.activePool.address,
        this.configParams.externalAddrs.WETH_ERC20,
	    {gasPrice}
      ))

    await this.isOwnershipRenounced(contracts.collSurplusPool) ||
      await this.sendAndWaitForTransaction(contracts.collSurplusPool.setAddresses(
        contracts.borrowerOperations.address,
        contracts.troveManager.address,
        contracts.activePool.address,
        this.configParams.externalAddrs.WETH_ERC20,
	    {gasPrice}
      ))

    await this.isOwnershipRenounced(contracts.gasPool) ||
      await this.sendAndWaitForTransaction(contracts.gasPool.setAddresses(
        contracts.troveManager.address,
        contracts.lusdToken.address,
        contracts.borrowerOperations.address,
        contracts.controller.address,
	    {gasPrice}
      ))

    // set contracts in HintHelpers
    await this.isOwnershipRenounced(contracts.hintHelpers) ||
      await this.sendAndWaitForTransaction(contracts.hintHelpers.setAddresses(
        contracts.sortedTroves.address,
        contracts.troveManager.address,
	    {gasPrice}
      ))
  }

  async connectLQTYContractsMainnet(LQTYContracts) {
    const gasPrice = this.configParams.GAS_PRICE
    // Set LQTYToken address in LCF
    await this.isOwnershipRenounced(LQTYContracts.lqtyStaking) ||
      await this.sendAndWaitForTransaction(LQTYContracts.lockupContractFactory.setLQTYTokenAddress(LQTYContracts.lqtyToken.address, {gasPrice}))
  }

  async connectLQTYContractsToCoreMainnet(LQTYContracts, coreContracts) {
    const gasPrice = this.configParams.GAS_PRICE
    await this.isOwnershipRenounced(LQTYContracts.lqtyStaking) ||
      await this.sendAndWaitForTransaction(LQTYContracts.lqtyStaking.setAddresses(
        LQTYContracts.lqtyToken.address,
        coreContracts.lusdToken.address,
        coreContracts.troveManager.address, 
        coreContracts.borrowerOperations.address,
        coreContracts.activePool.address,
        this.configParams.externalAddrs.WETH_ERC20,
	    {gasPrice}
      ))

    await this.isOwnershipRenounced(LQTYContracts.communityIssuance) ||
      await this.sendAndWaitForTransaction(LQTYContracts.communityIssuance.setAddresses(
        LQTYContracts.lqtyToken.address,
        coreContracts.stabilityPool.address,
	    {gasPrice}
      ))
  }

  async connectUnipoolMainnet(uniPool, LQTYContracts, LUSDWETHPairAddr, duration) {
    const gasPrice = this.configParams.GAS_PRICE
    await this.isOwnershipRenounced(uniPool) ||
      await this.sendAndWaitForTransaction(uniPool.setParams(LQTYContracts.lqtyToken.address, LUSDWETHPairAddr, duration, {gasPrice}))
  }

  // --- Verify on Ethrescan ---
  async verifyContract(name, deploymentState, constructorArguments=[]) {
    if (!deploymentState[name] || !deploymentState[name].address) {
      console.error(`  --> No deployment state for contract ${name}!!`)
      return
    }

    if (deploymentState[name].verification) {
      console.log(`Contract ${name} already verified`)
      return
    }

    try {
      await this.hre.run("verify:verify", {
        address: deploymentState[name].address,
        constructorArguments,
      })
    } catch (error) {
      // if it was already verified, it’s like a success, so let’s move forward and save it
      if (error.name != 'NomicLabsHardhatPluginError') {
        console.error(`Error verifying: ${error.name}`)
        console.error(error)
        return
      }
    }

    deploymentState[name].verification = `${this.configParams.ETHERSCAN_BASE_URL}/${deploymentState[name].address}#code`

    this.saveDeployment(deploymentState)
  }

  // --- Helpers ---

  async logContractObjects (contracts) {
    console.log(`Contract objects addresses:`)
    for ( const contractName of Object.keys(contracts)) {
      console.log(`${contractName}: ${contracts[contractName].address}`);
    }
  }
}

module.exports = MainnetDeploymentHelper
