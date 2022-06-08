const fs = require('fs')
const { BigNumber } = require('ethers')
const { network, ethers } = require('hardhat');

const maxBytes32 = '0x' + 'f'.repeat(64)
const minBytes32 = '0x' + '0'.repeat(64)
const ZERO_ADDRESS = '0x' + '0'.repeat(40)

class TestnetDeploymentHelper {
  constructor(configParams, deployerWallet) {
    this.deployments = {}
    this.hre = require("hardhat")
    this.configParams = configParams
    this.deployerWallet = deployerWallet
  }

  async loadAllContractFactories() {
    this.gmuOracleFactory = await this.getFactory("GMUOracle")
    this.mockAggregatorFactory = await this.getFactory("MockAggregator")
    this.mockPairOracle = await this.getFactory("MockUniswapOracle")
    this.mockTokenFactory = await this.getFactory("ERC20Mock")
    this.gasPoolFactory = await this.getFactory("GasPool")
    this.lusdTokenFactory = await this.getFactory("ARTHValuecoin")
    this.mahaTokenFactory = await this.getFactory("MockMaha")
    this.priceFeedFactory = await this.getFactory("PriceFeedTestnet")
    this.activePoolFactory = await this.getFactory("ActivePool")
    this.governanceFactory = await this.getFactory('Governance')
    this.defaultPoolFactory = await this.getFactory("DefaultPool")
    this.hintHelpersFactory = await this.getFactory("HintHelpers")
    this.sortedTrovesFactory = await this.getFactory("SortedTroves")
    this.troveManagerFactory = await this.getFactory("TroveManager")
    this.ecosystemFundFactory = await this.getFactory("EcosystemFund")
    this.stabilityPoolFactory = await this.getFactory("StabilityPool")
    this.collSurplusPoolFactory = await this.getFactory("CollSurplusPool")
    this.multiTroveGetterFactory = await this.getFactory("MultiTroveGetter")
    this.communityIssuanceFactory = await this.getFactory("CommunityIssuance")
    this.borrowerOperationsFactory = await this.getFactory("BorrowerOperations")
    this.incentivePoolFactory = await this.getFactory("IncentivePool");
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

  async loadOrDeploy(factory, name, abiName, deploymentState, params=[], proxyImplementationFactory=null) {
    if (deploymentState[name] && deploymentState[name].address) {
      console.log(`- Using previously deployed ${name} contract at address ${deploymentState[name].address}`)
      return new ethers.Contract(
        deploymentState[name].address,
        proxyImplementationFactory ? proxyImplementationFactory.interface : factory.interface,
        this.deployerWallet
      );
    }

    console.log(`- Deploying ${name}...`)
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
    return proxyImplementationFactory
      ? new ethers.Contract(
        contract.address,
        proxyImplementationFactory.interface,
        this.deployerWallet
      )
      : contract
  }

  async deploy(deploymentState) {
    if (this.isMainnet()) throw Error('ERROR: !!! Wrong network !!!')

    for (const token of this.configParams.COLLATERLAS) {
        console.log()
        console.log(`------ Deploying contracts for ${token} collateral ------`)
        const coreContracts = await this.deployLiquityCore(deploymentState, token)
        console.log(`- Done deploying ARTH contracts`)
        const LQTYContracts = await this.deployLQTYContractsMainnet(deploymentState, token)
        console.log(`- Done deploying LQTY contracts`)
        await this.connectCoreContracts(coreContracts, LQTYContracts, token)
        console.log(`- Done connecting ARTH contracts`)
        await this.connectLQTYContractsToCoreMainnet(LQTYContracts, coreContracts, token)
        console.log(`- Done connecting ARTH & LQTY contracts`)
        console.log(`------ Done deploying contracts for ${token} collateral ------`)
        console.log()
    }
  }

  async deployLiquityCore(deploymentState, token) {
    const mockTokenParams =  [
      token,
      token,
      this.configParams.DEPLOYER,
      BigNumber.from(1).pow(18)
    ];
    const mockToken = token === 'MAHA'
      ? await this.loadOrDeploy(
        this.mahaTokenFactory,
        `MahaToken`,
        'MockMaha',
        deploymentState
      )
      : await this.loadOrDeploy(
        this.mockTokenFactory,
        token,
        'ERC20Mock',
        deploymentState,
        mockTokenParams
      )

    const arth = await this.loadOrDeploy(
      this.lusdTokenFactory,
      `ARTHStablecoin`,
      'LiquityLUSDToken',
      deploymentState
    )

    const maha = await this.loadOrDeploy(
      this.mahaTokenFactory,
      `MahaToken`,
      'MockMaha',
      deploymentState
    )

    const ecosystemFund = await this.loadOrDeploy(
      this.ecosystemFundFactory,
      'EcosystemFund',
      'EcosystemFund',
      deploymentState
    )

    const mahaARTHPairOracle = await this.loadOrDeploy(
      this.mockPairOracle,
      'UniswapPairOracle_ARTH_MAHA',
      'MockUniswapOracle',
      deploymentState
    )
      
    const mockAggregator = await this.loadOrDeploy(
      this.mockAggregatorFactory,
      `${token}MockAgrregator`,
      `MockAgrregator`,
      deploymentState
    )
    
    const gmuOracle = await this.loadOrDeploy(
      this.gmuOracleFactory,
      `GMUOracle`,
      'GMUOracle',
      deploymentState,
      [2e6]
    )

    const mockPriceFeedPairOracle = await this.loadOrDeploy(
      this.mockPairOracle,
      `${token}MockPairOracle`,
      'MockUniswapOracle',
      deploymentState
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
        this.configParams.DEPLOYER,
        troveManager.address,
        borrowerOperations.address,
        priceFeed.address,
        ecosystemFund.address,
        BigNumber.from(0)
    ]
    const governance = await this.loadOrDeploy(
        this.governanceFactory,
        `${token}Governance`,
        'Governance',
        deploymentState,
        governanceParams
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

    const incentivePoolParams = [
      this.configParams.DEPLOYER,
      maha.address,
      troveManager.address,
      30 * 24 * 60 * 60,
      this.configParams.DEPLOYER
    ]
    const incentivePool = await this.loadOrDeploy(
      this.incentivePoolFactory,
      `${token}IncentivePool`,
      'IncentivePool',
      deploymentState,
      incentivePoolParams
    )

    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('- No Etherscan Url defined, skipping verification')
    } else {
      await this.verifyContract(`${token}MockAgrregator`, deploymentState)
      await this.verifyContract('GMUOracle', deploymentState, [2e6])
      await this.verifyContract(`EcosystemFund`, deploymentState)
      await this.verifyContract(`${token}MockPairOracle`, deploymentState)
      await this.verifyContract(`UniswapPairOracle_ARTH_MAHA`, deploymentState)
      await this.verifyContract(`${token}`, deploymentState, mockTokenParams)
      await this.verifyContract(`ARTHStablecoin`, deploymentState)
      await this.verifyContract(`MahaToken`, deploymentState)
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
      await this.verifyContract(`${token}Governance`, deploymentState, governanceParams)
      await this.verifyContract(`${token}MultiTroveGetter`, deploymentState, multiTroveGetterParams)
      await this.verifyContract(`${token}IncentivePool`, deploymentState, incentivePoolParams)
    }

    return {
      incentivePool,
      mockPriceFeedPairOracle,
      gmuOracle,
      mockAggregator,
      ecosystemFund,
      mahaARTHPairOracle,
      arth,
      maha,
      mockToken,
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
      multiTroveGetter,
      priceFeed
    }
  }

  async deployLQTYContractsMainnet(deploymentState, token) {
    const communityIssuance = await this.loadOrDeploy(
        this.communityIssuanceFactory,
        `${token}CommunityIssuance`,
        `CommunityIssuance`,
        deploymentState
    )

    if (!this.configParams.ETHERSCAN_BASE_URL) {
      console.log('- No Etherscan Url defined, skipping verification')
    } else {
      await this.verifyContract(`${token}CommunityIssuance`, deploymentState)
    }

    return {
      communityIssuance,
    }
  }

  // --- Connector methods ---

  async isOwnershipRenounced(contract) {
    const owner = await contract.owner()
    return owner == ZERO_ADDRESS
  }

  async connectCoreContracts(ARTHContracts, LQTYContracts, token) {
    const gasPrice = this.configParams.GAS_PRICE

    await this.sendAndWaitForTransaction(
      ARTHContracts.mockAggregator.setLatestRoundId(3, { gasPrice }),
    )
    await this.sendAndWaitForTransaction(
      ARTHContracts.mockAggregator.setPrevRoundId(2, { gasPrice }),
    )
    await this.sendAndWaitForTransaction(
      ARTHContracts.mockAggregator.setPrice(BigNumber.from(10).pow(8), { gasPrice }),
    )
    await this.sendAndWaitForTransaction(
      ARTHContracts.mockAggregator.setPrevPrice(BigNumber.from(10).pow(8), { gasPrice }),
    )
    await this.sendAndWaitForTransaction(
      ARTHContracts.mockAggregator.setUpdateTime(Math.floor(Date.now() / 1000), { gasPrice }),
    )
    await this.sendAndWaitForTransaction(
      ARTHContracts.mockAggregator.setPrevUpdateTime(Math.floor(Date.now() / 1000), { gasPrice }),
    )

    await this.sendAndWaitForTransaction(ARTHContracts.governance.setStabilityFeeToken(
        ARTHContracts.maha.address,
        ARTHContracts.mahaARTHPairOracle.address,
        {gasPrice}
    ))

    await this.sendAndWaitForTransaction(ARTHContracts.arth.toggleBorrowerOperations(
     ARTHContracts.borrowerOperations.address,
     { gasPrice } 
    ))

    await this.sendAndWaitForTransaction(ARTHContracts.arth.toggleTroveManager(
      ARTHContracts.troveManager.address,
      { gasPrice } 
     ))

    await this.sendAndWaitForTransaction(ARTHContracts.arth.toggleStabilityPool(
      ARTHContracts.stabilityPool.address,
      { gasPrice } 
     ))

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
        ARTHContracts.arth.address,
        ARTHContracts.sortedTroves.address,
        ARTHContracts.governance.address,
        ARTHContracts.mockToken.address,
        {gasPrice}
      ))
 
    await this.sendAndWaitForTransaction(ARTHContracts.maha.mint(
        ARTHContracts.incentivePool.address,
        BigNumber.from(10).pow(18).mul(1e6),
        {gasPrice}
      ));
    await this.sendAndWaitForTransaction(ARTHContracts.incentivePool.notifyRewardAmount(
        BigNumber.from(10).pow(18).mul(1e6),
        {gasPrice}
      ));

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
        ARTHContracts.arth.address,
        ARTHContracts.mockToken.address,
        ARTHContracts.governance.address,
        ARTHContracts.incentivePool.address,
        {gasPrice}
      ))

    // Set contracts in StabilityPool.
    await this.isOwnershipRenounced(ARTHContracts.stabilityPool) ||
      await this.sendAndWaitForTransaction(ARTHContracts.stabilityPool.setAddresses(
        ARTHContracts.borrowerOperations.address,
        ARTHContracts.troveManager.address,
        ARTHContracts.activePool.address,
        ARTHContracts.arth.address,
        ARTHContracts.sortedTroves.address,
        ARTHContracts.mockToken.address,
        ARTHContracts.governance.address,
        LQTYContracts.communityIssuance.address,
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
        ARTHContracts.governance.address,
        ARTHContracts.mockToken.address,
        {gasPrice}
      ))

    // Set contracts in DefaultPool.
    await this.isOwnershipRenounced(ARTHContracts.defaultPool) ||
      await this.sendAndWaitForTransaction(ARTHContracts.defaultPool.setAddresses(
        ARTHContracts.troveManager.address,
        ARTHContracts.activePool.address,
        ARTHContracts.mockToken.address,
        {gasPrice}
      ))

    // Set contracts in CollSurplusPool.
    await this.isOwnershipRenounced(ARTHContracts.collSurplusPool) ||
      await this.sendAndWaitForTransaction(ARTHContracts.collSurplusPool.setAddresses(
        ARTHContracts.borrowerOperations.address,
        ARTHContracts.troveManager.address,
        ARTHContracts.activePool.address,
        ARTHContracts.mockToken.address,
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

  async connectLQTYContractsToCoreMainnet(LQTYContracts, ARTHContracts, token) {
    const gasPrice = this.configParams.GAS_PRICE

    await this.sendAndWaitForTransaction(ARTHContracts.maha.mint(
      LQTYContracts.communityIssuance.address,
      BigNumber.from(10).pow(18).mul(1e6),
      {gasPrice}
    ));

    await this.isOwnershipRenounced(LQTYContracts.communityIssuance) ||
      await this.sendAndWaitForTransaction(LQTYContracts.communityIssuance.setAddresses(
        ARTHContracts.maha.address,
        ARTHContracts.stabilityPool.address,
        30 * 24 * 60 * 60,
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

module.exports = TestnetDeploymentHelper
