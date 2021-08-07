const fs = require('fs')

const EcosystemFund = artifacts.require('./EcosystemFund.sol')
const SortedTroves = artifacts.require("./SortedTroves.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const LUSDToken = artifacts.require("./LUSDToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const GasPool = artifacts.require("./GasPool.sol")
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")
const HintHelpers = artifacts.require("./HintHelpers.sol")
const ARTHController = artifacts.require("ARTHController")
const Controller = artifacts.require("Controller")
const Governance = artifacts.require("Governance")
const MahaToken = artifacts.require("MockMaha")
const MockUniswapOracle = artifacts.require("MockUniswapOracle")
const MultiTroveGetter = artifacts.require("MultiTroveGetter")

const WETH = artifacts.require("./WETH.sol")
const LQTYStaking = artifacts.require("./LQTYStaking.sol")
const LQTYToken = artifacts.require("./LQTYToken.sol")
const LockupContractFactory = artifacts.require("./LockupContractFactory.sol")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")

const maxBytes32 = '0x' + 'f'.repeat(64)

class DeploymentHelper {
  deploymentState = {}

  constructor() {
    this.deploymentState = {}
  }

  async deployLiquityCore(deployer, timelock) {
    return this.deployLiquityCoreHardhat(deployer, timelock);
  }

  async deployLQTYContracts(bountyAddress, lpRewardsAddress, multisigAddress) {
    return this.deployLQTYContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress);
  } 

  saveDeployment(contract, address, abi) {
    this.deploymentState[contract] = {
      address,
      abi
    }

    const deploymentStateJSON = JSON.stringify(this.deploymentState, null, 2)
    fs.writeFileSync('./output/development.json', deploymentStateJSON)
  }

  async deployLiquityCoreHardhat(deployer, timelock) {
    fs.existsSync('./output/development.json') && fs.unlinkSync('./output/development.json');
    const weth = await WETH.new()
    this.saveDeployment("WMATIC", weth.address, 'IWETH')
    this.saveDeployment("WETH_WRAPPER", weth.address, 'IWETH')

    const priceFeedTestnet = await PriceFeedTestnet.new()
    this.saveDeployment("PriceFeed", priceFeedTestnet.address, 'PriceFeed')

    const sortedTroves = await SortedTroves.new()
    this.saveDeployment("SortedTroves", sortedTroves.address, 'SortedTroves')

    const troveManager = await TroveManager.new()
    this.saveDeployment("TroveManager", troveManager.address, 'TroveManager')

    const activePool = await ActivePool.new()
    this.saveDeployment("ActivePool", activePool.address, 'ActivePool')

    const stabilityPool = await StabilityPool.new()
    this.saveDeployment("StabilityPool", stabilityPool.address, 'StabilityPool')

    const gasPool = await GasPool.new()
    this.saveDeployment("GasPool", gasPool.address, 'GasPool')

    const defaultPool = await DefaultPool.new()
    this.saveDeployment("DefaultPool", defaultPool.address, 'DefaultPool')

    const collSurplusPool = await CollSurplusPool.new()
    this.saveDeployment("CollSurplusPool", collSurplusPool.address, 'CollSurplusPool')

    const borrowerOperations = await BorrowerOperations.new()
    this.saveDeployment("BorrowerOperations", borrowerOperations.address, 'BorrowerOperations')

    const hintHelpers = await HintHelpers.new()
    this.saveDeployment("HintHelpers", hintHelpers.address, 'HintHelpers')

    const lusdToken = await LUSDToken.new()
    this.saveDeployment("LUSDToken", lusdToken.address, 'LUSDToken')

    const governance = await Governance.new(troveManager.address, borrowerOperations.address)
    this.saveDeployment("Governance", governance.address, 'Governance')

    const mahaToken = await MahaToken.new()
    this.saveDeployment("MahaToken", mahaToken.address, 'MahaToken')

    const ecosystemFund = await EcosystemFund.new()
    this.saveDeployment("EcosystemFund", ecosystemFund.address, 'EcosystemFund')

    const mahaMockUniswapOracle = await MockUniswapOracle.new()
    this.saveDeployment("UniswapPairOracle_ARTH_MAHA", mahaMockUniswapOracle.address, 'UniswapPairOracle')

    const multiTroveGetter = await MultiTroveGetter.new(troveManager.address, sortedTroves.address);
    this.saveDeployment("MultiTroveGetter", multiTroveGetter.address, 'MultiTroveGetter')

    const arthController = await ARTHController.new(
        lusdToken.address, 
        mahaToken.address,
        deployer,
        timelock
    )
    this.saveDeployment("ARTHController", arthController.address, 'ARTHController')

    const controller = await Controller.new(
        troveManager.address,
        stabilityPool.address,
        borrowerOperations.address,
        governance.address,
        lusdToken.address,
        gasPool.address
    )
    this.saveDeployment("Controller", controller.address, 'Controller')

    const coreContracts = {
      ecosystemFund,
      governance,
      arthController,
      controller,
      priceFeedTestnet,
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
      weth,
      mahaToken,
      mahaMockUniswapOracle,
      multiTroveGetter
    }

    return coreContracts
  }

  async deployLQTYContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress) {
    const lqtyStaking = await LQTYStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuance.new()

    LQTYStaking.setAsDeployed(lqtyStaking)
    LockupContractFactory.setAsDeployed(lockupContractFactory)
    CommunityIssuance.setAsDeployed(communityIssuance)

    // Deploy LQTY Token, passing Community Issuance and Factory addresses to the constructor 
    const lqtyToken = await LQTYToken.new(
      communityIssuance.address, 
      lqtyStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress,
      multisigAddress
    )
    this.saveDeployment("LQTYToken", lqtyToken.address, 'LQTYToken')

    LQTYToken.setAsDeployed(lqtyToken)

    const LQTYContracts = {
      lqtyStaking,
      lockupContractFactory,
      communityIssuance,
      lqtyToken
    }
    return LQTYContracts
  }

  // Connect contracts to their dependencies
  async connectCoreContracts(contracts, LQTYContracts) {
    await contracts.lusdToken.setArthController(contracts.arthController.address);
    await contracts.arthController.addPool(contracts.controller.address);
    await contracts.governance.setPriceFeed(contracts.priceFeedTestnet.address);
    await contracts.governance.setStabilityFeeToken(contracts.mahaToken.address, contracts.mahaMockUniswapOracle.address)
    await contracts.governance.setFund(contracts.ecosystemFund.address)

    // set TroveManager addr in SortedTroves
    await contracts.sortedTroves.setParams(
      maxBytes32,
      contracts.troveManager.address,
      contracts.borrowerOperations.address
    )


    // set contracts in the Trove Manager
    await contracts.troveManager.setAddresses(
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
      contracts.weth.address
    )

    // set contracts in BorrowerOperations 
    await contracts.borrowerOperations.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.sortedTroves.address,
      contracts.lusdToken.address,
      contracts.weth.address,
      contracts.governance.address,
      contracts.controller.address
    )

    // set contracts in the Pools
    await contracts.stabilityPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.lusdToken.address,
      contracts.sortedTroves.address,
      LQTYContracts.communityIssuance.address,
      contracts.weth.address,
      contracts.governance.address,
      contracts.controller.address
    )

    await contracts.activePool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.defaultPool.address,
      contracts.collSurplusPool.address,
      contracts.weth.address,
    )

    await contracts.defaultPool.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.weth.address
    )

    await contracts.collSurplusPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.weth.address
    )

    await contracts.gasPool.setAddresses(
        contracts.troveManager.address,
        contracts.lusdToken.address,
        contracts.borrowerOperations.address,
        contracts.controller.address
    )

    // set contracts in HintHelpers
    await contracts.hintHelpers.setAddresses(
      contracts.sortedTroves.address,
      contracts.troveManager.address
    )
  }

  async connectLQTYContracts(LQTYContracts) {
    // Set LQTYToken address in LCF
    await LQTYContracts.lockupContractFactory.setLQTYTokenAddress(LQTYContracts.lqtyToken.address)
  }

  async connectLQTYContractsToCore(LQTYContracts, coreContracts) {
    await LQTYContracts.lqtyStaking.setAddresses(
      LQTYContracts.lqtyToken.address,
      coreContracts.lusdToken.address,
      coreContracts.troveManager.address, 
      coreContracts.borrowerOperations.address,
      coreContracts.activePool.address,
      coreContracts.weth.address
    )
  
    await LQTYContracts.communityIssuance.setAddresses(
      LQTYContracts.lqtyToken.address,
      coreContracts.stabilityPool.address
    )
  }
}

module.exports = DeploymentHelper
