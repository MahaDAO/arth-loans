const deploymentHelper = require("../utils/deploymentHelpers.js")

contract('Deployment script - Sets correct contract addresses dependencies after deployment', async accounts => {
  const [owner] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)
  
  let priceFeed
  let lusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations
  let lqtyStaking
  let lqtyToken
  let communityIssuance
  let lockupContractFactory
  let governance
  let controller
  let gasPool

  before(async () => {
    const coreContracts = await deploymentHelper.deployLiquityCore(owner, owner)
    const LQTYContracts = await deploymentHelper.deployLQTYContracts(bountyAddress, lpRewardsAddress, multisig)

    gasPool = coreContracts.gasPool
    controller = coreContracts.controller
    governance = coreContracts.governance
    priceFeed = coreContracts.priceFeedTestnet
    lusdToken = coreContracts.lusdToken
    sortedTroves = coreContracts.sortedTroves
    troveManager = coreContracts.troveManager
    activePool = coreContracts.activePool
    stabilityPool = coreContracts.stabilityPool
    defaultPool = coreContracts.defaultPool
    functionCaller = coreContracts.functionCaller
    borrowerOperations = coreContracts.borrowerOperations

    lqtyStaking = LQTYContracts.lqtyStaking
    lqtyToken = LQTYContracts.lqtyToken
    communityIssuance = LQTYContracts.communityIssuance
    lockupContractFactory = LQTYContracts.lockupContractFactory

    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, coreContracts)
  })

  it('Sets the correct Governance address in TroveManager', async () => {
    const governanceAddress = governance.address

    const recordedGovernanceAddress = await troveManager.governance()

    assert.equal(governanceAddress, recordedGovernanceAddress)
  })

  it('Sets the correct Controller address in TroveManager', async () => {
    const address = controller.address

    const recordedAddress = await troveManager.coreController()

    assert.equal(address, recordedAddress)
  })

  it('Sets the correct troveManager address in governance', async () => {
    const address = troveManager.address

    const recordedAddress = await controller.troveManagerAddress()
    assert.equal(address, recordedAddress)
  })


  it('Sets the correct PriceFeed address in Governance', async () => {
    const priceFeedAddress = priceFeed.address

    const recordedPriceFeedAddress = await governance.getPriceFeed()

    assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  })

  it('Sets the correct LUSDToken address in TroveManager', async () => {
    const lusdTokenAddress = lusdToken.address

    const recordedClvTokenAddress = await troveManager.lusdToken()

    assert.equal(lusdTokenAddress, recordedClvTokenAddress)
  })

  it('Sets the correct SortedTroves address in TroveManager', async () => {
    const sortedTrovesAddress = sortedTroves.address

    const recordedSortedTrovesAddress = await troveManager.sortedTroves()

    assert.equal(sortedTrovesAddress, recordedSortedTrovesAddress)
  })

  it('Sets the correct BorrowerOperations address in TroveManager', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await troveManager.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // ActivePool in TroveM
  it('Sets the correct ActivePool address in TroveManager', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddresss = await troveManager.activePool()

    assert.equal(activePoolAddress, recordedActivePoolAddresss)
  })

  // DefaultPool in TroveM
  it('Sets the correct DefaultPool address in TroveManager', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddresss = await troveManager.defaultPool()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddresss)
  })

  // StabilityPool in TroveM
  it('Sets the correct StabilityPool address in TroveManager', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddresss = await troveManager.stabilityPool()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddresss)
  })

  // LQTY Staking in TroveM
  it('Sets the correct LQTYStaking address in TroveManager', async () => {
    const lqtyStakingAddress = lqtyStaking.address

    const recordedLQTYStakingAddress = await troveManager.lqtyStaking()
    assert.equal(lqtyStakingAddress, recordedLQTYStakingAddress)
  })

  // Active Pool

  it('Sets the correct StabilityPool address in ActivePool', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await activePool.stabilityPoolAddress()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })

  it('Sets the correct DefaultPool address in ActivePool', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await activePool.defaultPoolAddress()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  it('Sets the correct BorrowerOperations address in ActivePool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await activePool.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct TroveManager address in ActivePool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await activePool.troveManagerAddress()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // Stability Pool

  it('Sets the correct ActivePool address in StabilityPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await stabilityPool.activePool()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('Sets the correct BorrowerOperations address in StabilityPool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await stabilityPool.borrowerOperations()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct governance address in StabilityPool', async () => {
    const address = governance.address

    const recordedAddress = await stabilityPool.governance()

    assert.equal(address, recordedAddress)
  })

  it('Sets the correct controller address in StabilityPool', async () => {
    const address = controller.address

    const recordedAddress = await stabilityPool.coreController()

    assert.equal(address, recordedAddress)
  })

  it('Sets the correct LUSDToken address in StabilityPool', async () => {
    const lusdTokenAddress = lusdToken.address

    const recordedClvTokenAddress = await stabilityPool.lusdToken()

    assert.equal(lusdTokenAddress, recordedClvTokenAddress)
  })

  it('Sets the correct TroveManager address in StabilityPool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await stabilityPool.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // Gas Pool
  it('Sets the correct controller address in GasPool', async () => {
    const address = controller.address

    const recordedAddress = await gasPool.coreController()
    assert.equal(address, recordedAddress)
  })

  it('Sets the correct trovemanager address in GasPool', async () => {
    const address = troveManager.address

    const recordedAddress = await gasPool.troveManager()
    assert.equal(address, recordedAddress)
  })

  it('Sets the correct borrower operations address in GasPool', async () => {
    const address = borrowerOperations.address

    const recordedAddress = await gasPool.borrowerOperationsAddress()
    assert.equal(address, recordedAddress)
  })

  it('Sets the correct TroveManager address in StabilityPool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await stabilityPool.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // Default Pool

  it('Sets the correct TroveManager address in DefaultPool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await defaultPool.troveManagerAddress()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  it('Sets the correct ActivePool address in DefaultPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await defaultPool.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('Sets the correct TroveManager address in SortedTroves', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await sortedTroves.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct BorrowerOperations address in SortedTroves', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await sortedTroves.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  //--- BorrowerOperations ---

  // TroveManager in BO
  it('Sets the correct TroveManager address in BorrowerOperations', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await borrowerOperations.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // setPriceFeed in BO
  it('Sets the correct governance address in BorrowerOperations', async () => {
    const address = governance.address

    const recordedAddress = await borrowerOperations.governance()
    assert.equal(address, recordedAddress)
  })

  it('Sets the correct controller address in BorrowerOperations', async () => {
    const address = controller.address

    const recordedAddress = await borrowerOperations.coreController()
    assert.equal(address, recordedAddress)
  })

  // setSortedTroves in BO
  it('Sets the correct SortedTroves address in BorrowerOperations', async () => {
    const sortedTrovesAddress = sortedTroves.address

    const recordedSortedTrovesAddress = await borrowerOperations.sortedTroves()
    assert.equal(sortedTrovesAddress, recordedSortedTrovesAddress)
  })

  // setActivePool in BO
  it('Sets the correct ActivePool address in BorrowerOperations', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await borrowerOperations.activePool()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  // setDefaultPool in BO
  it('Sets the correct DefaultPool address in BorrowerOperations', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await borrowerOperations.defaultPool()
    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  // LQTY Staking in BO
  it('Sets the correct LQTYStaking address in BorrowerOperations', async () => {
    const lqtyStakingAddress = lqtyStaking.address

    const recordedLQTYStakingAddress = await borrowerOperations.lqtyStakingAddress()
    assert.equal(lqtyStakingAddress, recordedLQTYStakingAddress)
  })

  // LQTY Staking in BO
  it('Sets the correct troveManager address in controller', async () => {
    const address = troveManager.address

    const recordedAddress = await controller.troveManagerAddress()
    assert.equal(address, recordedAddress)
  })

  it('Sets the correct governance address in controller', async () => {
    const address = governance.address

    const recordedAddress = await controller.governance()
    assert.equal(address, recordedAddress)
  })

  it('Sets the correct LUSD address in controller', async () => {
    const address = lusdToken.address

    const recordedAddress = await controller.lusdToken()
    assert.equal(address, recordedAddress)
  })

  it('Sets the correct stability pool address in controller', async () => {
    const address = stabilityPool.address

    const recordedAddress = await controller.stabilityPoolAddress()
    assert.equal(address, recordedAddress)
  })

  it('Sets the correct borrowerOperations address in controller', async () => {
    const address = borrowerOperations.address

    const recordedAddress = await controller.borrowerOperationsAddress()
    assert.equal(address, recordedAddress)
  })

  it('Sets the correct gas pool address in controller', async () => {
    const address = gasPool.address

    const recordedAddress = await controller.gasPoolAddress()
    assert.equal(address, recordedAddress)
  })

  // --- LQTY Staking ---

  // Sets LQTYToken in LQTYStaking
  it('Sets the correct LQTYToken address in LQTYStaking', async () => {
    const lqtyTokenAddress = lqtyToken.address

    const recordedLQTYTokenAddress = await lqtyStaking.lqtyToken()
    assert.equal(lqtyTokenAddress, recordedLQTYTokenAddress)
  })

  // Sets ActivePool in LQTYStaking
  it('Sets the correct ActivePool address in LQTYStaking', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await lqtyStaking.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  // Sets LUSDToken in LQTYStaking
  it('Sets the correct ActivePool address in LQTYStaking', async () => {
    const lusdTokenAddress = lusdToken.address

    const recordedLUSDTokenAddress = await lqtyStaking.lusdToken()
    assert.equal(lusdTokenAddress, recordedLUSDTokenAddress)
  })

  // Sets TroveManager in LQTYStaking
  it('Sets the correct ActivePool address in LQTYStaking', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await lqtyStaking.troveManagerAddress()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // Sets BorrowerOperations in LQTYStaking
  it('Sets the correct BorrowerOperations address in LQTYStaking', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await lqtyStaking.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // ---  LQTYToken ---

  // Sets CI in LQTYToken
  it('Sets the correct CommunityIssuance address in LQTYToken', async () => {
    const communityIssuanceAddress = communityIssuance.address

    const recordedcommunityIssuanceAddress = await lqtyToken.communityIssuanceAddress()
    assert.equal(communityIssuanceAddress, recordedcommunityIssuanceAddress)
  })

  // Sets LQTYStaking in LQTYToken
  it('Sets the correct LQTYStaking address in LQTYToken', async () => {
    const lqtyStakingAddress = lqtyStaking.address

    const recordedLQTYStakingAddress =  await lqtyToken.lqtyStakingAddress()
    assert.equal(lqtyStakingAddress, recordedLQTYStakingAddress)
  })

  // Sets LCF in LQTYToken
  it('Sets the correct LockupContractFactory address in LQTYToken', async () => {
    const LCFAddress = lockupContractFactory.address

    const recordedLCFAddress =  await lqtyToken.lockupContractFactory()
    assert.equal(LCFAddress, recordedLCFAddress)
  })

  // --- LCF  ---

  // Sets LQTYToken in LockupContractFactory
  it('Sets the correct LQTYToken address in LockupContractFactory', async () => {
    const lqtyTokenAddress = lqtyToken.address

    const recordedLQTYTokenAddress = await lockupContractFactory.lqtyTokenAddress()
    assert.equal(lqtyTokenAddress, recordedLQTYTokenAddress)
  })

  // --- CI ---

  // Sets LQTYToken in CommunityIssuance
  it('Sets the correct LQTYToken address in CommunityIssuance', async () => {
    const lqtyTokenAddress = lqtyToken.address

    const recordedLQTYTokenAddress = await communityIssuance.lqtyToken()
    assert.equal(lqtyTokenAddress, recordedLQTYTokenAddress)
  })

  it('Sets the correct StabilityPool address in CommunityIssuance', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await communityIssuance.stabilityPoolAddress()
    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })
})
