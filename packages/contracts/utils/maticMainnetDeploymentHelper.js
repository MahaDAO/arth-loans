const fs = require('fs')
const { BigNumber } = require('ethers')
const { network, ethers } = require('hardhat');

const maxBytes32 = '0x' + 'f'.repeat(64)
const ZERO_ADDRESS = '0x' + '0'.repeat(40)

class MainnetDeploymentHelper {
  constructor(configParams, deployerWallet) {
    this.deployments = {}
    this.hre = require("hardhat")
    this.configParams = configParams
    this.deployerWallet = deployerWallet
  }

  async loadAllContractFactories() {
    this.gasPoolFactory = await this.getFactory("GasPool")
    this.unipoolFactory = await this.getFactory("Unipool")
    this.lusdTokenFactory = await this.getFactory("LUSDToken")
    this.mahaTokenFactory = await this.getFactory("MahaToken")
    this.priceFeedFactory = await this.getFactory("PriceFeed")
    this.gmuOracleFactory = await this.getFactory("GMUOracle")
    this.lqtyTokenFactory = await this.getFactory("LQTYToken")
    this.activePoolFactory = await this.getFactory("ActivePool")
    this.governanceFactory = await this.getFactory('Governance')
    this.activePoolFactory = await this.getFactory("ActivePool")
    this.lqtyStakingFactory = await this.getFactory('LQTYStaking')
    this.defaultPoolFactory = await this.getFactory("DefaultPool")
    this.hintHelpersFactory = await this.getFactory("HintHelpers")
    this.coreControllerFactory = await this.getFactory("Controller")
    this.sortedTrovesFactory = await this.getFactory("SortedTroves")
    this.troveManagerFactory = await this.getFactory("TroveManager")
    this.ecosystemFundFactory = await this.getFactory("EcosystemFund")
    this.stabilityPoolFactory = await this.getFactory("StabilityPool")
    this.arthControllerFactory = await this.getFactory("ARTHController")
    this.collSurplusPoolFactory = await this.getFactory("CollSurplusPool")
    this.multiTroveGetterFactory = await this.getFactory("MultiTroveGetter")
    this.communityIssuanceFactory = await this.getFactory("CommunityIssuance")
    this.borrowerOperationsFactory = await this.getFactory("BorrowerOperations")
    this.lockupContractFactoryFactory = await this.getFactory('LockupContractFactory')
  }

  isMainnet() {
    return this.configParams.NETWORK_NAME == 'mainnet' ||
      this.configParams.NETWORK_NAME == 'matic' ||
      this.configParams.NETWORK_NAME == 'bsc' ||
      network.name == 'matic' ||
      network.name == 'mainnet' ||
      network.name == 'bsc'
  }

  loadPreviousDeployment() {
    let previousDeployment = {}

    if (fs.existsSync(this.configParams.OUTPUT_FILE)) {
        console.log()
        console.log(`------  Loading previous deployment ------ `)
        previousDeployment = require('../' + this.configParams.OUTPUT_FILE)
        console.log(`------  Done loading previous deployment ------ `)
        console.log()
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

  async loadOrDeploy(factory, name, abiName, deploymentState, params=[]) {
    if (deploymentState[name] && deploymentState[name].address) {
      console.log(`- Using previously deployed ${name} contract at address ${deploymentState[name].address}`)
      return new ethers.Contract(
        deploymentState[name].address,
        factory.interface,
        this.deployerWallet
      );
    }

    const contract = await factory.deploy(...params, {gasPrice: this.configParams.GAS_PRICE})
    await this.deployerWallet.provider.waitForTransaction(
        contract.deployTransaction.hash,
        this.configParams.TX_CONFIRMATIONS
    )

    deploymentState[name] = {
      abi: abiName || name,
      address: contract.address,
      txHash: contract.deployTransaction.hash
    }

    this.saveDeployment(deploymentState)
    return contract
  }

  async deploy(deploymentState) {
    if (!this.isMainnet()) throw Error('ERROR: !!! Wrong network !!!')

    for (const token of this.configParams.COLLATERLAS) {
        console.log()
        console.log(`------ Deploying contracts for ${token} collateral ------`)
        const coreContracts = await this.deployLiquityCore(deploymentState, token)
        console.log(`- Done deploying ARTH contracts`)
        const LQTYContracts = await this.deployLQTYContractsMainnet(deploymentState, token)
        console.log(`- Done deploying LQTY contracts`)
        await this.connectCoreContracts(coreContracts, LQTYContracts, token)
        console.log(`- Done connecting ARTH contracts`)
        await this.connectLQTYContractsMainnet(LQTYContracts)
        console.log(`- Done connecting LQTY contracts`)
        await this.connectLQTYContractsToCoreMainnet(LQTYContracts, coreContracts, token)
        console.log(`- Done connecting ARTH & LQTY contracts`)
        console.log(`------ Done deploying contracts for ${token} collateral ------`)
        console.log()
    }
  }

  async deployLiquityCore(deploymentState, token) {
    const arthController = await this.loadOrDeploy(
        this.arthControllerFactory,
        'ARTHController',
        'ARTHController',
        deploymentState,
        [
          this.configParams.EXTERNAL_ADDRS.ARTH,
          this.configParams.EXTERNAL_ADDRS.MahaToken,
          this.configParams.DEPLOYER_ADDRS.DEPLOYER,
          this.configParams.DEPLOYER_ADDRS.TIMELOCK
        ]
    )


    const priceFeed = await this.loadOrDeploy(
        this.priceFeedFactory,
        `${token}PriceFeed`,
        'PriceFeed',
        deploymentState
    )

    const sortedTroves = await this.loadOrDeploy(
        this.sortedTrovesFactory,
        `${token}SortedTroves`,
        'SortedTroves',
        deploymentState
    )

    const troveManager = await this.loadOrDeploy(
        this.troveManagerFactory,
        `${token}TroveManager`,
        'TroveManager',
        deploymentState
    )

    const activePool = await this.loadOrDeploy(
        this.activePoolFactory,
        `${token}ActivePool`,
        'ActivePool',
        deploymentState
    )

    const stabilityPool = await this.loadOrDeploy(
        this.stabilityPoolFactory,
        `${token}StabilityPool`,
        'StabilityPool',
        deploymentState
    )

    const gasPool = await this.loadOrDeploy(
        this.gasPoolFactory,
        `${token}GasPool`,
        'GasPool',
        deploymentState
    )

    const defaultPool = await this.loadOrDeploy(
        this.defaultPoolFactory,
        `${token}DefaultPool`,
        'DefaultPool',
        deploymentState
    )

    const collSurplusPool = await this.loadOrDeploy(
        this.collSurplusPoolFactory,
        `${token}CollSurplusPool`,
        'CollSurplusPool',
        deploymentState
    )

    const borrowerOperations = await this.loadOrDeploy(
        this.borrowerOperationsFactory,
        `${token}BorrowerOperations`,
        'BorrowerOperations',
        deploymentState
    )

    const hintHelpers = await this.loadOrDeploy(
        this.hintHelpersFactory,
        `${token}HintHelpers`,
        'HintHelpers',
        deploymentState
    )

    const governanceParams = [
        troveManager.address,
        borrowerOperations.address
    ]
    const governance = await this.loadOrDeploy(
        this.governanceFactory,
        `${token}Governance`,
        'Governance',
        deploymentState,
        governanceParams
    )

    const controllerParams = [
        troveManager.address,
        stabilityPool.address,
        borrowerOperations.address,
        governance.address,
        this.configParams.EXTERNAL_ADDRS.ARTH, // TODO: need to add this addr in config params.
        gasPool.address
    ]
    const controller = await this.loadOrDeploy(
        this.coreControllerFactory,
        `${token}Controller`,
        'Controller',
        deploymentState,
        controllerParams
    )

    const multiTroveGetterParams = [
      troveManager.address,
      sortedTroves.address
    ]

    const multiTroveGetter = await this.loadOrDeploy(
      this.multiTroveGetterFactory,
      `${token}MultiTroveGetter`,
      'MultiTroveGetter',
      deploymentState,
      multiTroveGetterParams
    )

    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('- No Etherscan Url defined, skipping verification')
    } else {
      await this.verifyContract('ARTHController', deploymentState, [
        this.configParams.EXTERNAL_ADDRS.ARTH,
        this.configParams.EXTERNAL_ADDRS.MahaToken,
        this.configParams.DEPLOYER_ADDRS.DEPLOYER,
        this.configParams.DEPLOYER_ADDRS.TIMELOCK
      ]);
      await this.verifyContract(`${token}SortedTroves`, deploymentState)
      await this.verifyContract(`${token}TroveManager`, deploymentState)
      await this.verifyContract(`${token}ActivePool`, deploymentState)
      await this.verifyContract(`${token}StabilityPool`, deploymentState)
      await this.verifyContract(`${token}GasPool`, deploymentState)
      await this.verifyContract(`${token}DefaultPool`, deploymentState)
      await this.verifyContract(`${token}CollSurplusPool`, deploymentState)
      await this.verifyContract(`${token}BorrowerOperations`, deploymentState)
      await this.verifyContract(`${token}HintHelpers`, deploymentState)
      await this.verifyContract(`${token}PriceFeed`, deploymentState)
      await this.verifyContract(`${token}Controller`, deploymentState, controllerParams)
      await this.verifyContract(`${token}Governance`, deploymentState, governanceParams)
      await this.verifyContract(`${token}MultiTroveGetter`, deploymentState, multiTroveGetterParams)
    }

    return {
      arthController,
      governance,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      borrowerOperations,
      hintHelpers,
      controller,
      multiTroveGetter,
      priceFeed
    }
  }

  async deployLQTYContractsMainnet(deploymentState, token) {
    const lqtyStaking = await this.loadOrDeploy(
        this.lqtyStakingFactory,
        `${token}LQTYStaking`,
        'LQTYStaking',
        deploymentState
    )
    const lockupContractFactory = await this.loadOrDeploy(
        this.lockupContractFactoryFactory,
        `${token}LockupContractFactory`,
        `LockupContractFactory`,
        deploymentState
    )
    const communityIssuance = await this.loadOrDeploy(
        this.communityIssuanceFactory,
        `${token}CommunityIssuance`,
        `CommunityIssuance`,
        deploymentState
    )

    const lqtyTokenParams = [
      communityIssuance.address,
      lqtyStaking.address,
      lockupContractFactory.address,
      this.deployerWallet.address,
      this.deployerWallet.address,
      this.deployerWallet.address,
    ]
    const lqtyToken = await this.loadOrDeploy(
      this.lqtyTokenFactory,
      `${token}LQTYToken`,
      'LQTYToken',
      deploymentState,
      lqtyTokenParams
    )

    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('- No Etherscan Url defined, skipping verification')
    } else {
      await this.verifyContract(`${token}LQTYStaking`, deploymentState)
      await this.verifyContract(`${token}LockupContractFactory`, deploymentState)
      await this.verifyContract(`${token}CommunityIssuance`, deploymentState)
      await this.verifyContract(`${token}LQTYToken`, deploymentState, lqtyTokenParams)
    }

    return {
      lqtyStaking,
      lockupContractFactory,
      communityIssuance,
      lqtyToken
    }
  }

  // --- Connector methods ---

  async isOwnershipRenounced(contract) {
    const owner = await contract.owner()
    return owner == ZERO_ADDRESS
  }

  async connectCoreContracts(ARTHContracts, LQTYContracts, token) {
    const gasPrice = this.configParams.GAS_PRICE

    await this.isOwnershipRenounced(ARTHContracts.priceFeed) ||
    await this.sendAndWaitForTransaction(ARTHContracts.priceFeed.setAddresses(
        this.configParams.PRICEFEED_CONFIGS[token].umbOracle,
        this.configParams.PRICEFEED_CONFIGS[token].chainlinkOracle,
        ARTHContracts.gmuOracle.address,
        {gasPrice})
      )


    await this.sendAndWaitForTransaction(
        ARTHContracts.governance.setPriceFeed(ARTHContracts.priceFeed.address, {gasPrice})
    )

    await this.sendAndWaitForTransaction(ARTHContracts.governance.setStabilityFeeToken(
        this.configParams.EXTERNAL_ADDRS.MahaToken,
        this.configParams.EXTERNAL_ADDRS.MAHA_ARTH_PAIR_ORACLE,
        {gasPrice}
    ))

    await this.sendAndWaitForTransaction(ARTHContracts.governance.setFund(
        this.configParams.EXTERNAL_ADDRS.ECOSYSTEMFUND,
        {gasPrice}
    ))

    // await this.sendAndWaitForTransaction(ARTHContracts.arthController.addPool(
    //     ARTHContracts.controller.address,
    //     {gasPrice}
    // ))

    // TODO: manually.
    // await this.sendAndWaitForTransaction(
    //     commonContracts.lusdToken.setArthController(commonContracts.arthController.address, {gasPrice})
    // )

    // set TroveManager addr in Sorted Troves.
    await this.isOwnershipRenounced(ARTHContracts.sortedTroves) ||
      await this.sendAndWaitForTransaction(ARTHContracts.sortedTroves.setParams(
        maxBytes32,
        ARTHContracts.troveManager.address,
        ARTHContracts.borrowerOperations.address,
        {gasPrice}
      ))

    // set TroveManager addr in TroveManager.
    await this.isOwnershipRenounced(ARTHContracts.troveManager) ||
      await this.sendAndWaitForTransaction(ARTHContracts.troveManager.setAddresses(
        ARTHContracts.borrowerOperations.address,
        ARTHContracts.activePool.address,
        ARTHContracts.defaultPool.address,
        ARTHContracts.stabilityPool.address,
        ARTHContracts.gasPool.address,
        ARTHContracts.collSurplusPool.address,
        this.configParams.EXTERNAL_ADDRS.ARTH,
        ARTHContracts.sortedTroves.address,
        ARTHContracts.governance.address,
        ARTHContracts.controller.address,
        this.configParams.EXTERNAL_ADDRS[token],
        {gasPrice}
      ))

    // Set contracts in BorrowerOperations.
    await this.isOwnershipRenounced(ARTHContracts.borrowerOperations) ||
      await this.sendAndWaitForTransaction(ARTHContracts.borrowerOperations.setAddresses(
        ARTHContracts.troveManager.address,
        ARTHContracts.activePool.address,
        ARTHContracts.defaultPool.address,
        ARTHContracts.stabilityPool.address,
        ARTHContracts.gasPool.address,
        ARTHContracts.collSurplusPool.address,
        ARTHContracts.sortedTroves.address,
        this.configParams.EXTERNAL_ADDRS.ARTH,
        this.configParams.EXTERNAL_ADDRS[token],
        ARTHContracts.governance.address,
        ARTHContracts.controller.address,
        {gasPrice}
      ))

    // Set contracts in StabilityPool.
    await this.isOwnershipRenounced(ARTHContracts.stabilityPool) ||
      await this.sendAndWaitForTransaction(ARTHContracts.stabilityPool.setAddresses(
        ARTHContracts.borrowerOperations.address,
        ARTHContracts.troveManager.address,
        ARTHContracts.activePool.address,
        this.configParams.EXTERNAL_ADDRS.ARTH,
        ARTHContracts.sortedTroves.address,
        LQTYContracts.communityIssuance.address,
        this.configParams.EXTERNAL_ADDRS[token],
        ARTHContracts.governance.address,
        ARTHContracts.controller.address,
        {gasPrice}
      ))

    // Set contracts in ActivePool.
    await this.isOwnershipRenounced(ARTHContracts.activePool) ||
      await this.sendAndWaitForTransaction(ARTHContracts.activePool.setAddresses(
        ARTHContracts.borrowerOperations.address,
        ARTHContracts.troveManager.address,
        ARTHContracts.stabilityPool.address,
        ARTHContracts.defaultPool.address,
        ARTHContracts.collSurplusPool.address,
        this.configParams.EXTERNAL_ADDRS[token],
        {gasPrice}
      ))

    // Set contracts in DefaultPool.
    await this.isOwnershipRenounced(ARTHContracts.defaultPool) ||
      await this.sendAndWaitForTransaction(ARTHContracts.defaultPool.setAddresses(
        ARTHContracts.troveManager.address,
        ARTHContracts.activePool.address,
        this.configParams.EXTERNAL_ADDRS[token],
        {gasPrice}
      ))

    // Set contracts in CollSurplusPool.
    await this.isOwnershipRenounced(ARTHContracts.collSurplusPool) ||
      await this.sendAndWaitForTransaction(ARTHContracts.collSurplusPool.setAddresses(
        ARTHContracts.borrowerOperations.address,
        ARTHContracts.troveManager.address,
        ARTHContracts.activePool.address,
        this.configParams.EXTERNAL_ADDRS[token],
        {gasPrice}
      ))

    // Set contracts in GasPool.
    await this.isOwnershipRenounced(ARTHContracts.gasPool) ||
      await this.sendAndWaitForTransaction(ARTHContracts.gasPool.setAddresses(
        ARTHContracts.troveManager.address,
        this.configParams.EXTERNAL_ADDRS.ARTH,
        ARTHContracts.borrowerOperations.address,
        ARTHContracts.controller.address,
        {gasPrice}
      ))

    // Set contracts in HintHelpers.
    await this.isOwnershipRenounced(ARTHContracts.hintHelpers) ||
      await this.sendAndWaitForTransaction(ARTHContracts.hintHelpers.setAddresses(
        ARTHContracts.sortedTroves.address,
        ARTHContracts.troveManager.address,
        {gasPrice}
      ))
  }

  async connectLQTYContractsMainnet(LQTYContracts) {
    const gasPrice = this.configParams.GAS_PRICE

    await this.isOwnershipRenounced(LQTYContracts.lqtyStaking) ||
      await this.sendAndWaitForTransaction(LQTYContracts.lockupContractFactory.setLQTYTokenAddress(
        LQTYContracts.
        lqtyToken.address,
        {gasPrice}
      ))
  }

  async connectLQTYContractsToCoreMainnet(LQTYContracts, ARTHContracts, token) {
    const gasPrice = this.configParams.GAS_PRICE

    await this.isOwnershipRenounced(LQTYContracts.lqtyStaking) ||
      await this.sendAndWaitForTransaction(LQTYContracts.lqtyStaking.setAddresses(
        LQTYContracts.lqtyToken.address,
        this.configParams.EXTERNAL_ADDRS.ARTH,
        ARTHContracts.troveManager.address,
        ARTHContracts.borrowerOperations.address,
        ARTHContracts.activePool.address,
        this.configParams.EXTERNAL_ADDRS[token],
        {gasPrice}
      ))

    await this.isOwnershipRenounced(LQTYContracts.communityIssuance) ||
      await this.sendAndWaitForTransaction(LQTYContracts.communityIssuance.setAddresses(
        LQTYContracts.lqtyToken.address,
        ARTHContracts.stabilityPool.address,
        {gasPrice}
      ))
  }

  // --- Verify on Ethrescan ---

  async verifyContract(name, deploymentState, constructorArguments=[]) {
    if (!deploymentState[name] || !deploymentState[name].address) {
      console.error(`- No deployment state for contract ${name}!!`)
      return
    }

    if (deploymentState[name].verification) {
      console.log(`- Contract ${name} already verified`)
      return
    }

    try {
      await this.hre.run("verify:verify", {
        address: deploymentState[name].address,
        constructorArguments,
      })
    } catch (error) {
      console.log(error)
      if (error.name != 'NomicLabsHardhatPluginError') {
        console.error(`- Error verifying: ${error.name}`)
        console.error(error)
        return
      }
    }

    deploymentState[name].verification = `${this.configParams.ETHERSCAN_BASE_URL}/${deploymentState[name].address}#code`
    this.saveDeployment(deploymentState)
  }

  // --- Helpers ---

  async logContractObjects (contracts) {
    console.log(`- Contract objects addresses:`)
    for ( const contractName of Object.keys(contracts)) {
      console.log(`- Contract: ${contractName}: ${contracts[contractName].address}`);
    }
  }
}

module.exports = MainnetDeploymentHelper
