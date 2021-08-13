const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const LUSDTokenTester = artifacts.require("./LUSDTokenTester.sol")
const Governance = artifacts.require("Governance")
const Controller = artifacts.require("Controller")
const ARTHController = artifacts.require("ARTHController")

const BigNumber = require('ethers').BigNumber
const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const assertRevert = th.assertRevert
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues


/* NOTE: Some tests involving ETH redemption fees do not test for specific fee values.
 * Some only test that the fees are non-zero when they should occur.
 *
 * Specific ETH gain values will depend on the final fee schedule used, and the final choices for
 * the parameter BETA in the TroveManager, which is still TBD based on economic modelling.
 * 
 */ 
contract('TroveManager', async accounts => {

  const _18_zeros = '000000000000000000'
  const ZERO_ADDRESS = th.ZERO_ADDRESS

  const [
    owner,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4, whale,
    A, B, C, D, E] = accounts;

    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let priceFeed
  let lusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let collSurplusPool
  let defaultPool
  let borrowerOperations
  let hintHelpers
  let weth
  let contracts
  let controller

  const getOpenTroveTotalDebt = async (lusdAmount) => th.getOpenTroveTotalDebt(contracts, lusdAmount)
  const getOpenTroveLUSDAmount = async (totalDebt) => th.getOpenTroveLUSDAmount(contracts, totalDebt)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const openTrove = async (params) => th.openTrove(contracts, params)
  const withdrawLUSD = async (params) => th.withdrawLUSD(contracts, params)
  
  let MIN_NET_DEBT;
  
  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore(owner, owner)
    contracts.lusdToken = await LUSDTokenTester.new()
    contracts.arthController = await ARTHController.new(
        contracts.lusdToken.address, 
        contracts.lusdToken.address,
        owner,
        owner
    )
    contracts.governance = await Governance.new(contracts.troveManager.address, contracts.borrowerOperations.address)
    contracts.controller = await Controller.new(
        contracts.troveManager.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address,
        contracts.governance.address,
        contracts.lusdToken.address,
        contracts.gasPool.address 
    )

    const LQTYContracts = await deploymentHelper.deployLQTYContracts(bountyAddress, lpRewardsAddress, multisig)

    priceFeed = contracts.priceFeedTestnet
    lusdToken = contracts.lusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    collSurplusPool = contracts.collSurplusPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers
    weth = contracts.weth
    lqtyStaking = LQTYContracts.lqtyStaking
    lqtyToken = LQTYContracts.lqtyToken
    communityIssuance = LQTYContracts.communityIssuance
    lockupContractFactory = LQTYContracts.lockupContractFactory
    controller = contracts.controller
        
    MIN_NET_DEBT = await borrowerOperations.MIN_NET_DEBT()
    await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
    await deploymentHelper.connectLQTYContracts(LQTYContracts)
    await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

    for (const account of [
        owner,
        alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
        defaulter_1, defaulter_2, defaulter_3, defaulter_4, whale,
        A, B, C, D, E]
    ) {
        await contracts.mahaToken.mint(account, dec(1, 39), {from: account})
        await contracts.mahaToken.approve(contracts.governance.address, dec(1, 39), {from: account})
        await lusdToken.approve(controller.address, dec(10000000, 24), {from: account})
        await lusdToken.approve(borrowerOperations.address, dec(10000000, 24), {from: account})
    }
  })

  it('moveTrove(): move trove to other account correctly', async () => {
    await weth.deposit({ from: whale, value: dec(100, 30) })
    await weth.approve(borrowerOperations.address, dec(100, 30), { from: whale })
    await borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('2'))), dec(100, 30) ,ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: whale})
    
    await weth.deposit({ from: alice, value: dec(100, 30) })
    await weth.approve(borrowerOperations.address, dec(100, 30), { from: alice })
    await borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('2'))), dec(100, 30) ,ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice})
    assert.equal(await sortedTroves.contains(whale), true)
    assert.equal(await sortedTroves.contains(alice), true)

    await troveManager.moveTrove(A, {from: whale})
    assert.equal(await sortedTroves.contains(A), true)
    assert.equal(await sortedTroves.contains(whale), false)
    assert.equal(await sortedTroves.contains(alice), true)
  })

  it('moveTrove(): move trove should happen if trove is present.', async () => {    
    await weth.deposit({ from: alice, value: dec(100, 30) })
    await weth.approve(borrowerOperations.address, dec(100, 30), { from: alice })
    await borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('2'))), dec(100, 30) ,ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice})
    assert.equal(await sortedTroves.contains(whale), false)
    assert.equal(await sortedTroves.contains(alice), true)

    await assertRevert(troveManager.moveTrove(A, {from: whale}), 
    "TroveManager: Trove does not exist or is closed")
    assert.equal(await sortedTroves.contains(A), false)
    assert.equal(await sortedTroves.contains(whale), false)
    assert.equal(await sortedTroves.contains(alice), true)
  })

  it('moveTrove(): move trove should happen only if trove is present.', async () => {    
    await weth.deposit({ from: alice, value: dec(100, 30) })
    await weth.approve(borrowerOperations.address, dec(100, 30), { from: alice })
    await borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('2'))), dec(100, 30) ,ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice})
    assert.equal(await sortedTroves.contains(whale), false)
    assert.equal(await sortedTroves.contains(alice), true)

    await assertRevert(troveManager.moveTrove(A, {from: whale}), 
    "TroveManager: Trove does not exist or is closed")

    troveManager.moveTrove(B, {from: alice})
    assert.equal(await sortedTroves.contains(A), false)
    assert.equal(await sortedTroves.contains(whale), false)
    assert.equal(await sortedTroves.contains(alice), false)
    assert.equal(await sortedTroves.contains(B), true)
  })

  it('moveTrove(): move trove should happen if trove is present.', async () => {    
    await weth.deposit({ from: alice, value: dec(100, 30) })
    await weth.approve(borrowerOperations.address, dec(100, 30), { from: alice })
    await borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('2'))), dec(100, 30) ,ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice})
    assert.equal(await sortedTroves.contains(whale), false)
    assert.equal(await sortedTroves.contains(alice), true)

    await assertRevert(troveManager.moveTrove(A, {from: whale}), 
    "TroveManager: Trove does not exist or is closed")

    troveManager.moveTrove(A, {from: alice})
    assert.equal(await sortedTroves.contains(A), false)
    assert.equal(await sortedTroves.contains(whale), false)
    assert.equal(await sortedTroves.contains(alice), false)
    assert.equal(await sortedTroves.contains(A), true)
  })
})