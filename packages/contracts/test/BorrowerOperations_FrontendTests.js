const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const NonPayable = artifacts.require('NonPayable.sol')
const TroveManagerTester = artifacts.require("TroveManagerTester")
const LUSDTokenTester = artifacts.require("./LUSDTokenTester")
const WETH = artifacts.require("./WETH")
const Controller = artifacts.require("Controller")
const Governance = artifacts.require("Governance")
const ARTHController = artifacts.require("ARTHController")
const BigNumber = require("ethers").BigNumber

const th = testHelpers.TestHelper
const ZERO_ADDR = th.ZERO_ADDRESS
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const assertRevert = th.assertRevert

/* NOTE: Some of the borrowing tests do not test for specific LUSD fee values. They only test that the
 * fees are non-zero when they should occur, and that they decay over time.
 *
 * Specific LUSD fee values will depend on the final fee schedule used, and the final choice for
 *  the parameter MINUTE_DECAY_FACTOR in the TroveManager, which is still TBD based on economic
 * modelling.
 * 
 */

contract('BorrowerOperations', async accounts => {

  const [
    owner, alice, bob, carol, dennis, whale,
    A, B, C, D, E, F, G, H,
    // defaulter_1, defaulter_2,
    frontEnd_1, frontEnd_2, frontEnd_3] = accounts;

    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  // const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]

  let priceFeed
  let lusdToken
  let sortedTroves
  let troveManager
  let activePool
  let defaultPool
  let borrowerOperations
  let lqtyStaking
  let lqtyToken
  let weth
  let contracts
  let controller
  let ecosystemFund

  const getOpenTroveLUSDAmount = async (totalDebt) => th.getOpenTroveLUSDAmount(contracts, totalDebt)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
  const openTrove = async (params) => th.openTrove(contracts, params)
  const getTroveEntireColl = async (trove) => th.getTroveEntireColl(contracts, trove)
  const getTroveEntireDebt = async (trove) => th.getTroveEntireDebt(contracts, trove)
  const getTroveStake = async (trove) => th.getTroveStake(contracts, trove)
  
  let LUSD_GAS_COMPENSATION
  let MIN_NET_DEBT
  let BORROWING_FEE_FLOOR

  const testCorpus = ({ withProxy = false }) => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore(owner, owner)
      contracts.borrowerOperations = await BorrowerOperationsTester.new()
      contracts.troveManager = await TroveManagerTester.new()
      contracts.lusdToken = await LUSDTokenTester.new()
      contracts.arthController = await ARTHController.new(
        contracts.lusdToken.address,
        contracts.mahaToken.address,
        owner,
        owner
      )
      contracts.governance = await Governance.new(contracts.troveManager.address, contracts.borrowerOperations.address)
      contracts.weth = await WETH.new()
      contracts.controller = await Controller.new(
        contracts.troveManager.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address,
        contracts.governance.address,
        contracts.lusdToken.address,
        contracts.gasPool.address
    )
      // contracts = await deploymentHelper.deployLUSDTokenTester(contracts)
      const LQTYContracts = await deploymentHelper.deployLQTYTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)

      await deploymentHelper.connectLQTYContracts(LQTYContracts)
      await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
      await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

      if (withProxy) {
        const users = [alice, bob, carol, dennis, whale, A, B, C, D, E]
        await deploymentHelper.deployProxyScripts(contracts, LQTYContracts, owner, users)
      }

      priceFeed = contracts.priceFeedTestnet
      lusdToken = contracts.lusdToken
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      activePool = contracts.activePool
      stabilityPool = contracts.stabilityPool
      defaultPool = contracts.defaultPool
      borrowerOperations = contracts.borrowerOperations
      hintHelpers = contracts.hintHelpers
      weth = contracts.weth
      controller = contracts.controller
      ecosystemFund = contracts.ecosystemFund
    
      lqtyStaking = LQTYContracts.lqtyStaking
      lqtyToken = LQTYContracts.lqtyToken
      communityIssuance = LQTYContracts.communityIssuance
      lockupContractFactory = LQTYContracts.lockupContractFactory

      LUSD_GAS_COMPENSATION = await borrowerOperations.LUSD_GAS_COMPENSATION()
      MIN_NET_DEBT = await borrowerOperations.MIN_NET_DEBT()
      BORROWING_FEE_FLOOR = await borrowerOperations.BORROWING_FEE_FLOOR()

      for (const account of [
        owner, alice, bob, carol, dennis, whale,
        A, B, C, D, E, F, G, H,
        // defaulter_1, defaulter_2,
        frontEnd_1, frontEnd_2, frontEnd_3
      ]) {
        await lusdToken.approve(controller.address, dec(1000000000000, 18), {from: account}) 
      }

      await borrowerOperations.registerFrontEnd({from: frontEnd_1});
      await borrowerOperations.registerFrontEnd({from: frontEnd_2});
      await borrowerOperations.registerFrontEnd({from: frontEnd_3});
    })

    it("addColl(): reverts when top-up would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode(price))
      assert.isTrue((await troveManager.getCurrentICR(alice, price)).lt(toBN(dec(110, 16))))

      const collTopUp = 1  // 1 wei top up

      await weth.deposit({ from: alice, value: collTopUp })
      await weth.approve(borrowerOperations.address, collTopUp, { from: alice })

     await assertRevert(borrowerOperations.addColl(collTopUp, alice, alice, { from: alice }), 
     "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
     assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
    })

    it("addColl(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
      const { collateral: aliceColl } = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const activePool_ETH_Before = await activePool.getETH()
      const activePool_RawEther_Before = await weth.balanceOf(activePool.address)

      assert.isTrue(activePool_ETH_Before.eq(aliceColl))
      assert.isTrue(activePool_RawEther_Before.eq(aliceColl))

      await weth.deposit({from: alice, value: dec(1, 'ether')})
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: alice })
      await borrowerOperations.addColl(dec(1, 'ether') , alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const activePool_ETH_After = await activePool.getETH()
        const activePool_RawEther_After = await weth.balanceOf(activePool.address)
      assert.isTrue(activePool_ETH_After.eq(aliceColl.add(toBN(dec(1, 'ether')))))
      assert.isTrue(activePool_RawEther_After.eq(aliceColl.add(toBN(dec(1, 'ether')))))
    })

    it("addColl(), active Trove: adds the correct collateral amount to the Trove", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      
      const alice_Trove_Before = await troveManager.Troves(alice)
      const coll_before = alice_Trove_Before[1]
      const status_Before = alice_Trove_Before[3]

      // check status before
      assert.equal(status_Before, 1)

      // Alice adds second collateral
      await weth.deposit({ from: alice, value: dec(1, 'ether') })
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: alice })
      await borrowerOperations.addColl(dec(1, 'ether'), alice, alice, { from: alice})
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const alice_Trove_After = await troveManager.Troves(alice)
      const coll_After = alice_Trove_After[1]
      const status_After = alice_Trove_After[3]

      // check coll increases by correct amount,and status remains active
      assert.isTrue(coll_After.eq(coll_before.add(toBN(dec(1, 'ether')))))
      assert.equal(status_After, 1)
    }) 

    it("addColl(), active Trove: Trove is in sortedList before and after", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // check Alice is in list before
      const aliceTroveInList_Before = await sortedTroves.contains(alice)
      const listIsEmpty_Before = await sortedTroves.isEmpty()
      assert.equal(aliceTroveInList_Before, true)
      assert.equal(listIsEmpty_Before, false)

      await weth.deposit({ from: alice, value: dec(1, 'ether') })
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: alice })
      await borrowerOperations.addColl(dec(1, 'ether'), alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      
      // check Alice is still in list after
      const aliceTroveInList_After = await sortedTroves.contains(alice)
      const listIsEmpty_After = await sortedTroves.isEmpty()
      assert.equal(aliceTroveInList_After, true)
      assert.equal(listIsEmpty_After, false)
    })

    it("addColl(), active Trove: updates the stake and updates the total stakes", async () => {
      //  Alice creates initial Trove with 1 ether
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const alice_Trove_Before = await troveManager.Troves(alice)
      const alice_Stake_Before = alice_Trove_Before[2]
      const totalStakes_Before = (await troveManager.totalStakes())

      assert.isTrue(totalStakes_Before.eq(alice_Stake_Before))

      // Alice tops up Trove collateral with 2 ether
      await weth.deposit({ from: alice, value: dec(2, 'ether') })
      await weth.approve(borrowerOperations.address, dec(2, 'ether'), { from: alice })
      await borrowerOperations.addColl(dec(2, 'ether') , alice, alice, { from: alice})
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // Check stake and total stakes get updated
      const alice_Trove_After = await troveManager.Troves(alice)
      const alice_Stake_After = alice_Trove_After[2]
      const totalStakes_After = (await troveManager.totalStakes())

      assert.isTrue(alice_Stake_After.eq(alice_Stake_Before.add(toBN(dec(2, 'ether')))))
      assert.isTrue(totalStakes_After.eq(totalStakes_Before.add(toBN(dec(2, 'ether')))))
    })

    it("addColl(), active Trove: applies pending rewards and updates user's L_ETH, L_LUSDDebt snapshots", async () => {
      // --- SETUP ---
      const { collateral: aliceCollBefore, totalDebt: aliceDebtBefore } = await openTrove({ extraLUSDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const { collateral: bobCollBefore, totalDebt: bobDebtBefore } = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
      assert.equal((await troveManager.Troves(carol)).frontEndTag, ZERO_ADDR)

      // --- TEST ---

      // price drops to 1ETH:100LUSD, reducing Carol's ICR below MCR
      await priceFeed.setPrice('100000000000000000000');

      // Liquidate Carol's Trove,
      const tx = await troveManager.liquidate(carol, { from: owner });

      assert.isFalse(await sortedTroves.contains(carol))

      const L_ETH = await troveManager.L_ETH()
      const L_LUSDDebt = await troveManager.L_LUSDDebt()

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(alice)
      const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
      const alice_LUSDDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

      const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bob)
      const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
      const bob_LUSDDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_LUSDDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_LUSDDebtRewardSnapshot_Before, 0)

      const alicePendingETHReward = await troveManager.getPendingETHReward(alice)
      const bobPendingETHReward = await troveManager.getPendingETHReward(bob)
      const alicePendingLUSDDebtReward = await troveManager.getPendingLUSDDebtReward(alice)
      const bobPendingLUSDDebtReward = await troveManager.getPendingLUSDDebtReward(bob)
      for (reward of [alicePendingETHReward, bobPendingETHReward, alicePendingLUSDDebtReward, bobPendingLUSDDebtReward]) {
        assert.isTrue(reward.gt(toBN('0')))
      }

      // Alice and Bob top up their Troves
      const aliceTopUp = toBN(dec(5, 'ether'))
      const bobTopUp = toBN(dec(1, 'ether'))

      await weth.deposit({ from: alice, value: aliceTopUp })
      await weth.approve(borrowerOperations.address, aliceTopUp, { from: alice })
      await weth.deposit({ from: bob, value: bobTopUp })
      await weth.approve(borrowerOperations.address, bobTopUp, { from: bob })

      await borrowerOperations.addColl(aliceTopUp, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await borrowerOperations.addColl(bobTopUp, bob, bob, { from: bob })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      // Check that both alice and Bob have had pending rewards applied in addition to their top-ups. 
      const aliceNewColl = await getTroveEntireColl(alice)
      const aliceNewDebt = await getTroveEntireDebt(alice)
      const bobNewColl = await getTroveEntireColl(bob)
      const bobNewDebt = await getTroveEntireDebt(bob)

      assert.isTrue(aliceNewColl.eq(aliceCollBefore.add(alicePendingETHReward).add(aliceTopUp)))
      assert.isTrue(aliceNewDebt.eq(aliceDebtBefore.add(alicePendingLUSDDebtReward)))
      assert.isTrue(bobNewColl.eq(bobCollBefore.add(bobPendingETHReward).add(bobTopUp)))
      assert.isTrue(bobNewDebt.eq(bobDebtBefore.add(bobPendingLUSDDebtReward)))

      /* Check that both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
       to the latest values of L_ETH and L_LUSDDebt */
      const alice_rewardSnapshot_After = await troveManager.rewardSnapshots(alice)
      const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
      const alice_LUSDDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

      const bob_rewardSnapshot_After = await troveManager.rewardSnapshots(bob)
      const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
      const bob_LUSDDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

      assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(alice_LUSDDebtRewardSnapshot_After, L_LUSDDebt), 100)
      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(bob_LUSDDebtRewardSnapshot_After, L_LUSDDebt), 100)
    })

    // it("addColl(), active Trove: adds the right corrected stake after liquidations have occured", async () => {
    //  // TODO - check stake updates for addColl/withdrawColl/adustTrove ---

    //   // --- SETUP ---
    //   // A,B,C add 15/5/5 ETH, withdraw 100/100/900 LUSD
    //   await borrowerOperations.openTrove(th._100pct, dec(100, 18), alice, alice, { from: alice, value: dec(15, 'ether') })
    //   await borrowerOperations.openTrove(th._100pct, dec(100, 18), bob, bob, { from: bob, value: dec(4, 'ether') })
    //   await borrowerOperations.openTrove(th._100pct, dec(900, 18), carol, carol, { from: carol, value: dec(5, 'ether') })

    //   await borrowerOperations.openTrove(th._100pct, 0, dennis, dennis, { from: dennis, value: dec(1, 'ether') })
    //   // --- TEST ---

    //   // price drops to 1ETH:100LUSD, reducing Carol's ICR below MCR
    //   await priceFeed.setPrice('100000000000000000000');

    //   // close Carol's Trove, liquidating her 5 ether and 900LUSD.
    //   await troveManager.liquidate(carol, { from: owner });

    //   // dennis tops up his trove by 1 ETH
    //   await borrowerOperations.addColl(dennis, dennis, { from: dennis, value: dec(1, 'ether') })

    //   /* Check that Dennis's recorded stake is the right corrected stake, less than his collateral. A corrected 
    //   stake is given by the formula: 

    //   s = totalStakesSnapshot / totalCollateralSnapshot 

    //   where snapshots are the values immediately after the last liquidation.  After Carol's liquidation, 
    //   the ETH from her Trove has now become the totalPendingETHReward. So:

    //   totalStakes = (alice_Stake + bob_Stake + dennis_orig_stake ) = (15 + 4 + 1) =  20 ETH.
    //   totalCollateral = (alice_Collateral + bob_Collateral + dennis_orig_coll + totalPendingETHReward) = (15 + 4 + 1 + 5)  = 25 ETH.

    //   Therefore, as Dennis adds 1 ether collateral, his corrected stake should be:  s = 2 * (20 / 25 ) = 1.6 ETH */
    //   const dennis_Trove = await troveManager.Troves(dennis)

    //   const dennis_Stake = dennis_Trove[2]
    //   console.log(dennis_Stake.toString())

    //   assert.isAtMost(th.getDifference(dennis_Stake), 100)
    // })

    it("addColl(), reverts if trove is non-existent or closed", async () => {
      // A, B open troves
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      // Carol attempts to add collateral to her non-existent trove
      try {
        await weth.deposit({ from: bob, value: dec(1, 'ether') })
        await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: bob })
        const txCarol = await borrowerOperations.addColl(dec(1, 'ether'), carol, carol, { from: carol})
        assert.equal((await troveManager.Troves(carol)).frontEndTag, ZERO_ADDR)
        assert.isFalse(txCarol.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
        assert.include(error.message, "Trove does not exist or is closed")
      }

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Bob gets liquidated
      await troveManager.liquidate(bob)

      assert.isFalse(await sortedTroves.contains(bob))

      // Bob attempts to add collateral to his closed trove
      try {
        await weth.deposit({ from: bob, value: dec(1, 'ether') })
        await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: bob })
        const txBob = await borrowerOperations.addColl(dec(1, 'ether') , bob, bob, { from: bob})
        assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
        assert.isFalse(txBob.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
        assert.include(error.message, "Trove does not exist or is closed")
      }
    })

    it('addColl(): can add collateral in Recovery Mode', async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const aliceCollBefore = await getTroveEntireColl(alice)
      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice('105000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const collTopUp = toBN(dec(1, 'ether'))
      await weth.deposit({ from: alice, value: collTopUp })
      await weth.approve(borrowerOperations.address, collTopUp, { from: alice })
      await borrowerOperations.addColl(collTopUp, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // Check Alice's collateral
      const aliceCollAfter = (await troveManager.Troves(alice))[1]
      assert.isTrue(aliceCollAfter.eq(aliceCollBefore.add(collTopUp)))
    })

    // --- withdrawColl() ---

    it("withdrawColl(): reverts when withdrawal would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode(price))
      assert.isTrue((await troveManager.getCurrentICR(alice, price)).lt(toBN(dec(110, 16))))

      const collWithdrawal = 1  // 1 wei withdrawal

     await assertRevert(borrowerOperations.withdrawColl(1, alice, alice, { from: alice }), 
      "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
    })

    // reverts when calling address does not have active trove  
    it("withdrawColl(): reverts when calling address does not have active trove", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      // Bob successfully withdraws some coll
      const txBob = await borrowerOperations.withdrawColl(dec(100, 'finney'), bob, bob, { from: bob })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
      assert.isTrue(txBob.receipt.status)

      // Carol with no active trove attempts to withdraw
      try {
        const txCarol = await borrowerOperations.withdrawColl(dec(1, 'ether'), carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts when system is in Recovery Mode", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Withdrawal possible when recoveryMode == false
      const txAlice = await borrowerOperations.withdrawColl(1000, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      assert.isTrue(txAlice.receipt.status)

      await priceFeed.setPrice('105000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))

      //Check withdrawal impossible when recoveryMode == true
      try {
        const txBob = await borrowerOperations.withdrawColl(1000, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts when requested ETH withdrawal is > the trove's collateral", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
      assert.equal((await troveManager.Troves(carol)).frontEndTag, ZERO_ADDR)

      const carolColl = await getTroveEntireColl(carol)
      const bobColl = await getTroveEntireColl(bob)
      // Carol withdraws exactly all her collateral
      await assertRevert(
        borrowerOperations.withdrawColl(carolColl, carol, carol, { from: carol }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )

      // Bob attempts to withdraw 1 wei more than his collateral
      try {
        const txBob = await borrowerOperations.withdrawColl(bobColl.add(toBN(1)), bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts when withdrawal would bring the user's ICR < MCR", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)

      await openTrove({ ICR: toBN(dec(11, 17)), extraParams: { from: bob } }) // 110% ICR
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      // Bob attempts to withdraws 1 wei, Which would leave him with < 110% ICR.

      try {
        const txBob = await borrowerOperations.withdrawColl(1, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts if system is in Recovery Mode", async () => {
      // --- SETUP ---

      // A and B open troves at 150% ICR
      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')

      // --- TEST ---

      // price drops to 1ETH:150LUSD, reducing TCR below 150%
      await priceFeed.setPrice('150000000000000000000');

      //Alice tries to withdraw collateral during Recovery Mode
      try {
        const txData = await borrowerOperations.withdrawColl('1', alice, alice, { from: alice })
        assert.isFalse(txData.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })

    it("withdrawColl(): doesn’t allow a user to completely withdraw all collateral from their Trove (due to gas compensation)", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const aliceColl = (await troveManager.getEntireDebtAndColl(alice))[1]

      // Check Trove is active
      const alice_Trove_Before = await troveManager.Troves(alice)
      const status_Before = alice_Trove_Before[3]
      assert.equal(status_Before, 1)
      assert.isTrue(await sortedTroves.contains(alice))

      // Alice attempts to withdraw all collateral
      await assertRevert(
        borrowerOperations.withdrawColl(aliceColl, alice, alice, { from: alice }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )
    })

    it("withdrawColl(): leaves the Trove active when the user withdraws less than all the collateral", async () => {
      // Open Trove 
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // Check Trove is active
      const alice_Trove_Before = await troveManager.Troves(alice)
      const status_Before = alice_Trove_Before[3]
      assert.equal(status_Before, 1)
      assert.isTrue(await sortedTroves.contains(alice))

      // Withdraw some collateral
      await borrowerOperations.withdrawColl(dec(100, 'finney'), alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // Check Trove is still active
      const alice_Trove_After = await troveManager.Troves(alice)
      const status_After = alice_Trove_After[3]
      assert.equal(status_After, 1)
      assert.isTrue(await sortedTroves.contains(alice))
    })

    it("withdrawColl(): reduces the Trove's collateral by the correct amount", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const aliceCollBefore = await getTroveEntireColl(alice)

      // Alice withdraws 1 ether
      await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // Check 1 ether remaining
      const alice_Trove_After = await troveManager.Troves(alice)
      const aliceCollAfter = await getTroveEntireColl(alice)

      assert.isTrue(aliceCollAfter.eq(aliceCollBefore.sub(toBN(dec(1, 'ether')))))
    })

    it("withdrawColl(): reduces ActivePool ETH and raw ether by correct amount", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const aliceCollBefore = await getTroveEntireColl(alice)

      // check before
      const activePool_ETH_before = await activePool.getETH()
      const activePool_RawEther_before = await weth.balanceOf(activePool.address)

      await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // check after
      const activePool_ETH_After = await activePool.getETH()
      const activePool_RawEther_After = await weth.balanceOf(activePool.address)
      assert.isTrue(activePool_ETH_After.eq(activePool_ETH_before.sub(toBN(dec(1, 'ether')))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_RawEther_before.sub(toBN(dec(1, 'ether')))))
    })

    it("withdrawColl(): updates the stake and updates the total stakes", async () => {
      //  Alice creates initial Trove with 2 ether
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice, value: toBN(dec(5, 'ether')) } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const aliceColl = await getTroveEntireColl(alice)
      assert.isTrue(aliceColl.gt(toBN('0')))

      const alice_Trove_Before = await troveManager.Troves(alice)
      const alice_Stake_Before = alice_Trove_Before[2]
      const totalStakes_Before = (await troveManager.totalStakes())

      assert.isTrue(alice_Stake_Before.eq(aliceColl))
      assert.isTrue(totalStakes_Before.eq(aliceColl))

      // Alice withdraws 1 ether
      await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // Check stake and total stakes get updated
      const alice_Trove_After = await troveManager.Troves(alice)
      const alice_Stake_After = alice_Trove_After[2]
      const totalStakes_After = (await troveManager.totalStakes())

      assert.isTrue(alice_Stake_After.eq(alice_Stake_Before.sub(toBN(dec(1, 'ether')))))
      assert.isTrue(totalStakes_After.eq(totalStakes_Before.sub(toBN(dec(1, 'ether')))))
    })

    it("withdrawColl(): sends the correct amount of ETH to the user", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice, value: dec(2, 'ether') } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const alice_ETHBalance_Before = await weth.balanceOf(alice)
      await borrowerOperations.withdrawColl(dec(1, 'ether'), alice, alice, { from: alice, gasPrice: 0 })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const alice_ETHBalance_After = await weth.balanceOf(alice)
      const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

      assert.isTrue(balanceDiff.eq(toBN(dec(1, 'ether'))))
    })

    it("withdrawColl(): applies pending rewards and updates user's L_ETH, L_LUSDDebt snapshots", async () => {
      // --- SETUP ---
      // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)

      await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: alice, value: toBN(dec(100, 'ether')) } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      await openTrove({ ICR: toBN(dec(3, 18)), extraParams: { from: bob, value: toBN(dec(100, 'ether')) } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: carol, value: toBN(dec(10, 'ether')) } })
      assert.equal((await troveManager.Troves(carol)).frontEndTag, ZERO_ADDR)

      const aliceCollBefore = await getTroveEntireColl(alice)
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      const bobCollBefore = await getTroveEntireColl(bob)
      const bobDebtBefore = await getTroveEntireDebt(bob)

      // --- TEST ---

      // price drops to 1ETH:100LUSD, reducing Carol's ICR below MCR
      await priceFeed.setPrice('100000000000000000000');

      // close Carol's Trove, liquidating her 1 ether and 180LUSD.
      await troveManager.liquidate(carol, { from: owner });

      const L_ETH = await troveManager.L_ETH()
      const L_LUSDDebt = await troveManager.L_LUSDDebt()

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(alice)
      const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
      const alice_LUSDDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

      const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bob)
      const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
      const bob_LUSDDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_LUSDDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_LUSDDebtRewardSnapshot_Before, 0)

      // Check A and B have pending rewards
      const pendingCollReward_A = await troveManager.getPendingETHReward(alice)
      const pendingDebtReward_A = await troveManager.getPendingLUSDDebtReward(alice)
      const pendingCollReward_B = await troveManager.getPendingETHReward(bob)
      const pendingDebtReward_B = await troveManager.getPendingLUSDDebtReward(bob)
      for (reward of [pendingCollReward_A, pendingDebtReward_A, pendingCollReward_B, pendingDebtReward_B]) {
        assert.isTrue(reward.gt(toBN('0')))
      }

      // Alice and Bob withdraw from their Troves
      const aliceCollWithdrawal = toBN(dec(5, 'ether'))
      const bobCollWithdrawal = toBN(dec(1, 'ether'))

      await borrowerOperations.withdrawColl(aliceCollWithdrawal, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      await borrowerOperations.withdrawColl(bobCollWithdrawal, bob, bob, { from: bob })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      // Check that both alice and Bob have had pending rewards applied in addition to their top-ups. 
      const aliceCollAfter = await getTroveEntireColl(alice)
      const aliceDebtAfter = await getTroveEntireDebt(alice)
      const bobCollAfter = await getTroveEntireColl(bob)
      const bobDebtAfter = await getTroveEntireDebt(bob)

      // Check rewards have been applied to troves
      th.assertIsApproximatelyEqual(aliceCollAfter, aliceCollBefore.add(pendingCollReward_A).sub(aliceCollWithdrawal), 10000)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.add(pendingDebtReward_A), 10000)
      th.assertIsApproximatelyEqual(bobCollAfter, bobCollBefore.add(pendingCollReward_B).sub(bobCollWithdrawal), 10000)
      th.assertIsApproximatelyEqual(bobDebtAfter, bobDebtBefore.add(pendingDebtReward_B), 10000)

      /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
       to the latest values of L_ETH and L_LUSDDebt */
      const alice_rewardSnapshot_After = await troveManager.rewardSnapshots(alice)
      const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
      const alice_LUSDDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

      const bob_rewardSnapshot_After = await troveManager.rewardSnapshots(bob)
      const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
      const bob_LUSDDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

      assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(alice_LUSDDebtRewardSnapshot_After, L_LUSDDebt), 100)
      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(bob_LUSDDebtRewardSnapshot_After, L_LUSDDebt), 100)
    })

    // --- withdrawLUSD() ---

    it("withdrawLUSD(): reverts when withdrawal would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      const txAlice = await openTrove({ ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      let ecosystemFundBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), ecosystemFundBN.toString(), 10)

      const txBob = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_2, extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
      const txBobFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txBob.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBobFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), txBobFeeBN.div(2).toString(), 10)

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode(price))
      assert.isTrue((await troveManager.getCurrentICR(alice, price)).lt(toBN(dec(110, 16))))

      const LUSDwithdrawal = 1  // withdraw 1 wei LUSD

     await assertRevert(borrowerOperations.withdrawLUSD(th._100pct, LUSDwithdrawal, alice, alice, { from: alice }), 
      "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), txBobFeeBN.div(2).toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), txAliceFeeBN.div(2).toString(), 10)
    })

    it("withdrawLUSD(): decays a non-zero base rate", async () => {
      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let frontEnd1BN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      frontEnd1BN = frontEnd1BN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_2)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      let frontEnd2BN = txBFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), frontEnd2BN.toString(), 10)

      const txD = await openTrove({ extraLUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      frontEnd2BN = frontEnd2BN.add(txDFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), frontEnd2BN.toString(), 10)

      const txE = await openTrove({ extraLUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_3, extraParams: { from: E } })
      assert.equal((await troveManager.Troves(E)).frontEndTag, frontEnd_3)
      const txEFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txE.tx))
      ecosystemFundBN = ecosystemFundBN.add(txEFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_3)).toString(), txEFeeBN.div(2).toString(), 10)

      const A_LUSDBal = await lusdToken.balanceOf(A)

      // Artificially set base rate to 5%
      await troveManager.setBaseRate(dec(5, 16))

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws LUSD
      const ttx = await borrowerOperations.withdrawLUSD(th._100pct, dec(1, 18), A, A, { from: D })
      const ttxE1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(ttx))
      ecosystemFundBN = ecosystemFundBN.add(ttxE1FeeBN.div(2))
      frontEnd2BN = frontEnd2BN.add(ttxE1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), frontEnd2BN.toString(), 10)

      // Check baseRate has decreased
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E withdraws LUSD
      const txE1 = await borrowerOperations.withdrawLUSD(th._100pct, dec(1, 18), A, A, { from: E })
      assert.equal((await troveManager.Troves(E)).frontEndTag, frontEnd_3)
      const txE1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txE1))
      ecosystemFundBN = ecosystemFundBN.add(txE1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_3)).toString(), txEFeeBN.div(2).add(txE1FeeBN.div(2)).toString(), 10)

      const baseRate_3 = await troveManager.baseRate()
      assert.isTrue(baseRate_3.lt(baseRate_2))
    })

    it("withdrawLUSD(): reverts if max fee > 100%", async () => {
      const txA = await openTrove({ extraLUSDAmount: toBN(dec(10, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      let ecosystemFundBN = txAFeeBN.div(2)
      let frontEnd1BN = txAFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(20, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      frontEnd1BN = frontEnd1BN.add(txBFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)
      
      const txC = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_1)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      frontEnd1BN = frontEnd1BN.add(txCFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)
      
      const txD = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_1)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      frontEnd1BN = frontEnd1BN.add(txDFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)
      
      await assertRevert(borrowerOperations.withdrawLUSD(dec(2, 18), dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)
      await assertRevert(borrowerOperations.withdrawLUSD('1000000000000000001', dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)
    })

    it("withdrawLUSD(): reverts if max fee < 0.5% in Normal mode", async () => {
      const txA = await openTrove({ extraLUSDAmount: toBN(dec(10, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      let ecosystemFundBN = txAFeeBN.div(2)
      let frontEnd1BN = txAFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)
      
      const txB = await openTrove({ extraLUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      frontEnd1BN = frontEnd1BN.add(txBFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)
     
      const txC = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_1)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      frontEnd1BN = frontEnd1BN.add(txCFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)

      const txD = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_1)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      frontEnd1BN = frontEnd1BN.add(txDFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)

      await assertRevert(borrowerOperations.withdrawLUSD(0, dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)

      await assertRevert(borrowerOperations.withdrawLUSD(1, dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)

      await assertRevert(borrowerOperations.withdrawLUSD('4999999999999999', dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)
    })

    it("withdrawLUSD(): reverts if fee exceeds max fee percentage", async () => {
      const txA = await openTrove({ extraLUSDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      let ecosystemFundBN = txAFeeBN.div(2)
      let frontEnd1BN = txAFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      frontEnd1BN = frontEnd1BN.add(txBFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(70, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_1)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      frontEnd1BN = frontEnd1BN.add(txCFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)

      const txD = await openTrove({ extraLUSDAmount: toBN(dec(80, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_1)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      frontEnd1BN = frontEnd1BN.add(txDFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)

      const txE = await openTrove({ extraLUSDAmount: toBN(dec(180, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: E } })
      assert.equal((await troveManager.Troves(E)).frontEndTag, frontEnd_1)
      const txEFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txE.tx))
      ecosystemFundBN = ecosystemFundBN.add(txEFeeBN.div(2))
      frontEnd1BN = frontEnd1BN.add(txEFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)

      const totalSupply = await lusdToken.totalSupply()

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      let baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // 100%: 1e18,  10%: 1e17,  1%: 1e16,  0.1%: 1e15
      // 5%: 5e16
      // 0.5%: 5e15
      // actual: 0.5%, 5e15


      // LUSDFee:                  15000000558793542
      // absolute _fee:            15000000558793542
      // actual feePercentage:      5000000186264514
      // user's _maxFeePercentage: 49999999999999999

      const lessThan5pct = '49999999999999999'
      await assertRevert(borrowerOperations.withdrawLUSD(lessThan5pct, dec(3, 18), A, A, { from: A }), "Fee exceeded provided maximum")
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)

      baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      // Attempt with maxFee 1%
      await assertRevert(borrowerOperations.withdrawLUSD(dec(1, 16), dec(1, 18), A, A, { from: B }), "Fee exceeded provided maximum")
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)

      baseRate = await troveManager.baseRate()  // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      // Attempt with maxFee 3.754%
      await assertRevert(borrowerOperations.withdrawLUSD(dec(3754, 13), dec(1, 18), A, A, { from: C }), "Fee exceeded provided maximum")
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)

      baseRate = await troveManager.baseRate()  // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      // Attempt with maxFee 0.5%%
      await assertRevert(borrowerOperations.withdrawLUSD(dec(5, 15), dec(1, 18), A, A, { from: D }), "Fee exceeded provided maximum")
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), frontEnd1BN.toString(), 10)
    })

    it("withdrawLUSD(): succeeds when fee is less than max fee percentage", async () => {
      const txA  = await openTrove({ extraLUSDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      let ecosystemFundBN = txAFeeBN.div(2)
      let front1EndBN = txAFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      front1EndBN = front1EndBN.add(txBFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(70, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      let front2EndBN = txCFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const txD = await openTrove({ extraLUSDAmount: toBN(dec(80, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      front2EndBN = front2EndBN.add(txDFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const txE = await openTrove({ extraLUSDAmount: toBN(dec(180, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_3, extraParams: { from: E } })
      assert.equal((await troveManager.Troves(E)).frontEndTag, frontEnd_3)
      const txEFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txE.tx))
      ecosystemFundBN = ecosystemFundBN.add(txEFeeBN.div(2))
      let front3EndBN = txEFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_3)).toString(), front3EndBN.toString(), 10)

      const totalSupply = await lusdToken.totalSupply()

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      let baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.isTrue(baseRate.eq(toBN(dec(5, 16))))

      // Attempt with maxFee > 5%
      const moreThan5pct = '50000000000000001'
      const tx1 = await borrowerOperations.withdrawLUSD(moreThan5pct, dec(1, 18), A, A, { from: A })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      assert.isTrue(tx1.receipt.status)
      const tx1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx1))
      ecosystemFundBN = ecosystemFundBN.add(tx1FeeBN.div(2))
      front1EndBN = front1EndBN.add(tx1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // Attempt with maxFee = 5%
      const tx2 = await borrowerOperations.withdrawLUSD(dec(5, 16), dec(1, 18), A, A, { from: B })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
      assert.isTrue(tx2.receipt.status)
      const tx2FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx2))
      ecosystemFundBN = ecosystemFundBN.add(tx2FeeBN.div(2))
      front1EndBN = front1EndBN.add(tx2FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // Attempt with maxFee 10%
      const tx3 = await borrowerOperations.withdrawLUSD(dec(1, 17), dec(1, 18), A, A, { from: C })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      assert.isTrue(tx3.receipt.status)
      const tx3FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx3))
      front2EndBN = front2EndBN.add(tx3FeeBN.div(2))
      ecosystemFundBN = ecosystemFundBN.add(tx3FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      baseRate = await troveManager.baseRate() // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // Attempt with maxFee 37.659%
      const tx4 = await borrowerOperations.withdrawLUSD(dec(37659, 13), dec(1, 18), A, A, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      assert.isTrue(tx4.receipt.status)
      const tx4FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx4))
      front2EndBN = front2EndBN.add(tx4FeeBN.div(2))
      ecosystemFundBN = ecosystemFundBN.add(tx4FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Attempt with maxFee 100%
      const tx5 = await borrowerOperations.withdrawLUSD(dec(1, 18), dec(1, 18), A, A, { from: E })
      assert.equal((await troveManager.Troves(E)).frontEndTag, frontEnd_3)
      assert.isTrue(tx5.receipt.status)
      const tx5FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx5))
      front3EndBN = front3EndBN.add(tx5FeeBN.div(2))
      ecosystemFundBN = ecosystemFundBN.add(tx5FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_3)).toString(), front3EndBN.toString(), 10)
    })

    it("withdrawLUSD(): doesn't change base rate if it is already zero", async () => {
      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      
      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_2)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      let front2EndBN = txBFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      
      const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      front2EndBN = front2EndBN.add(txCFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const txD = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_1)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      front1EndBN = front1EndBN.add(txDFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txE = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: E } })
      assert.equal((await troveManager.Troves(E)).frontEndTag, frontEnd_1)
      const txEFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txE.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      front1EndBN = front1EndBN.add(txDFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws LUSD
      const tx1 = await borrowerOperations.withdrawLUSD(th._100pct, dec(37, 18), A, A, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_1)
      const tx1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx1))
      ecosystemFundBN = ecosystemFundBN.add(tx1FeeBN.div(2))
      front1EndBN = front1EndBN.add(tx1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      // Check baseRate is still 0
      const baseRate_2 = await troveManager.baseRate()
      assert.equal(baseRate_2, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens trove 
      const tx2 = await borrowerOperations.withdrawLUSD(th._100pct, dec(12, 18), A, A, { from: E })
      assert.equal((await troveManager.Troves(E)).frontEndTag, frontEnd_1)
      const tx2FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx2))
      ecosystemFundBN = ecosystemFundBN.add(tx2FeeBN.div(2))
      front1EndBN = front1EndBN.add(tx2FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const baseRate_3 = await troveManager.baseRate()
      assert.equal(baseRate_3, '0')
    })

    it("withdrawLUSD(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_2)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      let front2EndBN = txBFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      front2EndBN = front2EndBN.add(txCFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime()

      // 10 seconds pass
      th.fastForwardTime(10, web3.currentProvider)

      // Borrower C triggers a fee
      const tx1 = await borrowerOperations.withdrawLUSD(th._100pct, dec(1, 18), C, C, { from: C })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const tx1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx1))
      ecosystemFundBN = ecosystemFundBN.add(tx1FeeBN.div(2))
      front2EndBN = front2EndBN.add(tx1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

      // 60 seconds passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(60))

      // Borrower C triggers a fee
      const tx2 = await borrowerOperations.withdrawLUSD(th._100pct, dec(1, 18), C, C, { from: C })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      ecosystemFundBN = ecosystemFundBN.add(tx1FeeBN.div(2))
      front2EndBN = front2EndBN.add(tx1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
    })

    it("withdrawLUSD(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_2)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      let front2EndBN = txBFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      front2EndBN = front2EndBN.add(txCFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 30 seconds pass
      th.fastForwardTime(30, web3.currentProvider)

      // Borrower C triggers a fee, before decay interval has passed
      const tx1 = await borrowerOperations.withdrawLUSD(th._100pct, dec(1, 18), C, C, { from: C })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const tx1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx1))
      ecosystemFundBN = ecosystemFundBN.add(tx1FeeBN.div(2))
      front2EndBN = front2EndBN.add(tx1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // 30 seconds pass
      th.fastForwardTime(30, web3.currentProvider)

      // Borrower C triggers another fee
      const tx2 = await borrowerOperations.withdrawLUSD(th._100pct, dec(1, 18), C, C, { from: C })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const tx2FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx2))
      ecosystemFundBN = ecosystemFundBN.add(tx2FeeBN.div(2))
      front2EndBN = front2EndBN.add(tx2FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))
    })

    it("withdrawLUSD(): borrowing at non-zero base rate sends LUSD fee to LQTY staking contract", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 LQTY
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: multisig })
      await lqtyStaking.stake(dec(1, 18), { from: multisig })

      // Check LQTY LUSD balance before == 0
      const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
      assert.equal(lqtyStaking_LUSDBalance_Before, '0')

      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      
      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_2)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      let front2EndBN = txBFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      
      const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      front2EndBN = front2EndBN.add(txCFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      
      const txD = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      front2EndBN = front2EndBN.add(txDFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws LUSD
      const tx1 = await borrowerOperations.withdrawLUSD(th._100pct, dec(37, 18), C, C, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const tx1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx1))
      ecosystemFundBN = ecosystemFundBN.add(tx1FeeBN.div(2))
      front2EndBN = front2EndBN.add(tx1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check LQTY LUSD balance after has increased
      const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
      assert.isTrue(lqtyStaking_LUSDBalance_After.eq(lqtyStaking_LUSDBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("withdrawLUSD(): borrowing at non-zero base records the (drawn debt + fee) on the Trove struct", async () => {
        // time fast-forwards 1 year, and multisig stakes 1 LQTY
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
        await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: multisig })
        await lqtyStaking.stake(dec(1, 18), { from: multisig })

        const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
        assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
        const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
        let ecosystemFundBN = txWhaleFeeBN.div(2)
        let front1EndBN = txWhaleFeeBN.div(2)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

        const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
        const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
        ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
        front1EndBN = front1EndBN.add(txAFeeBN.div(2))
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

        const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
        const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
        ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
        front1EndBN = front1EndBN.add(txBFeeBN.div(2))
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

        const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
        assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
        const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
        ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
        let front2EndBN = txCFeeBN.div(2)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

        const txD = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
        assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
        const D_debtBefore = await getTroveEntireDebt(D)
        const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
        ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
        front2EndBN = front2EndBN.add(txDFeeBN.div(2))
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow()

        // Check baseRate is now non-zero
        const baseRate_1 = await troveManager.baseRate()
        assert.isTrue(baseRate_1.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        // D withdraws LUSD
        const withdrawal_D = toBN(dec(37, 18))
        const withdrawalTx = await borrowerOperations.withdrawLUSD(th._100pct, toBN(dec(37, 18)), D, D, { from: D })
        assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
        const feeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(withdrawalTx))
        ecosystemFundBN = ecosystemFundBN.add(feeBN.div(2))
        front2EndBN = front2EndBN.add(feeBN.div(2))
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

        const emittedFee = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(withdrawalTx))
        assert.isTrue(emittedFee.gt(toBN('0')))

        const newDebt = (await troveManager.Troves(D))[0]

        // Check debt on Trove struct equals initial debt + withdrawal + emitted fee
        th.assertIsApproximatelyEqual(newDebt, D_debtBefore.add(withdrawal_D).add(emittedFee), 10000)
      })
    }

    it("withdrawLUSD(): Borrowing at non-zero base rate increases the LQTY staking contract LUSD fees-per-unit-staked", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 LQTY
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: multisig })
      await lqtyStaking.stake(dec(1, 18), { from: multisig })

      // Check LQTY contract LUSD fees-per-unit-staked is zero
      const F_LUSD_Before = await lqtyStaking.F_LUSD()
      assert.equal(F_LUSD_Before, '0')

      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      front1EndBN = front1EndBN.add(txBFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      let front2EndBN = txCFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const txD = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      front2EndBN = front2EndBN.add(txDFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws LUSD
      const tx1 = await borrowerOperations.withdrawLUSD(th._100pct, toBN(dec(37, 18)), D, D, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const tx1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx1))
      ecosystemFundBN = ecosystemFundBN.add(tx1FeeBN.div(2))
      front2EndBN = front2EndBN.add(tx1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check LQTY contract LUSD fees-per-unit-staked has increased
      const F_LUSD_After = await lqtyStaking.F_LUSD()
      assert.isTrue(F_LUSD_After.eq(F_LUSD_Before))
    })

    it("withdrawLUSD(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 LQTY
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: multisig })
      await lqtyStaking.stake(dec(1, 18), { from: multisig })

      // Check LQTY Staking contract balance before == 0
      const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
      assert.equal(lqtyStaking_LUSDBalance_Before, '0')

      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      front1EndBN = front1EndBN.add(txBFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      
      const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      let front2EndBN = txCFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      
      const txD = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      front2EndBN = front2EndBN.add(txDFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      const D_LUSDBalanceBefore = await lusdToken.balanceOf(D)

      // D withdraws LUSD
      const D_LUSDRequest = toBN(dec(37, 18))
      const tx1 = await borrowerOperations.withdrawLUSD(th._100pct, D_LUSDRequest, D, D, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const tx1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx1))
      ecosystemFundBN = ecosystemFundBN.add(tx1FeeBN.div(2))
      front2EndBN = front2EndBN.add(tx1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check LQTY staking LUSD balance has increased
      const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
      assert.isTrue(lqtyStaking_LUSDBalance_After.eq(lqtyStaking_LUSDBalance_Before))

      // Check D's LUSD balance now equals their initial balance plus request LUSD
      const D_LUSDBalanceAfter = await lusdToken.balanceOf(D)
      assert.isTrue(D_LUSDBalanceAfter.eq(D_LUSDBalanceBefore.add(D_LUSDRequest)))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
    })
    
    it("withdrawLUSD(): Borrowing at zero base rate changes LUSD fees-per-unit-staked", async () => {
      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      
      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      front1EndBN = front1EndBN.add(txBFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      let front2EndBN = txCFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      
      const txD = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      front2EndBN = front2EndBN.add(txDFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // A artificially receives LQTY, then stakes it
      await lqtyToken.unprotectedMint(A, dec(100, 18))
      await lqtyStaking.stake(dec(100, 18), { from: A })

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // Check LQTY LUSD balance before == 0
      const F_LUSD_Before = await lqtyStaking.F_LUSD()
      assert.equal(F_LUSD_Before, '0')

      // D withdraws LUSD
      const tx1 = await borrowerOperations.withdrawLUSD(th._100pct, dec(37, 18), D, D, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const tx1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx1))
      ecosystemFundBN = ecosystemFundBN.add(tx1FeeBN.div(2))
      front2EndBN = front2EndBN.add(tx1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check LQTY LUSD balance after > 0
      const F_LUSD_After = await lqtyStaking.F_LUSD()
      assert.isTrue(F_LUSD_After.gt('0'))
    })

    it("withdrawLUSD(): Borrowing at zero base rate sends debt request to user", async () => {
      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      front1EndBN = front1EndBN.add(txBFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      let front2EndBN = txCFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      
      const txD = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      front2EndBN = front2EndBN.add(txCFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      const D_LUSDBalanceBefore = await lusdToken.balanceOf(D)

      // D withdraws LUSD
      const D_LUSDRequest = toBN(dec(37, 18))
      const tx = await borrowerOperations.withdrawLUSD(th._100pct, dec(37, 18), D, D, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front2EndBN = front2EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check D's LUSD balance now equals their requested LUSD
      const D_LUSDBalanceAfter = await lusdToken.balanceOf(D)

      // Check D's trove debt == D's LUSD balance + liquidation reserve
      assert.isTrue(D_LUSDBalanceAfter.eq(D_LUSDBalanceBefore.add(D_LUSDRequest)))
    })
    
    it("withdrawLUSD(): reverts when calling address does not have active trove", async () => {
      const txAlice = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      let ecosystemFundBN = txAliceFeeBN.div(2)
      let front1EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      
      const txBob1 = await openTrove({ ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
      const txBob1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txBob1.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBob1FeeBN.div(2))
      let front2EndBN = txBob1FeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Bob successfully withdraws LUSD
      const txBob = await borrowerOperations.withdrawLUSD(th._100pct, dec(100, 18), bob, bob, { from: bob })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
      const txBobFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txBob))
      ecosystemFundBN = ecosystemFundBN.add(txBobFeeBN.div(2))
      front2EndBN = front2EndBN.add(txBobFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      assert.isTrue(txBob.receipt.status)

      // Carol with no active trove attempts to withdraw LUSD
      try {
        const txCarol = await borrowerOperations.withdrawLUSD(th._100pct, dec(100, 18), carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
    })
    
    it("withdrawLUSD(): reverts when requested withdrawal amount is zero LUSD", async () => {
      const txAlice = await openTrove({ ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      let ecosystemFundBN = txAliceFeeBN.div(2)
      let front1EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      
      const txBob1 = await openTrove({ ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
      const txBob1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txBob1.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBob1FeeBN.div(2))
      let front2EndBN = txBob1FeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      
      // Bob successfully withdraws 1e-18 LUSD
      const txBob = await borrowerOperations.withdrawLUSD(th._100pct, 1, bob, bob, { from: bob })
      const txBobFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txBob))
      ecosystemFundBN = ecosystemFundBN.add(txBobFeeBN.div(2))
      front2EndBN = front2EndBN.add(txBobFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
      assert.isTrue(txBob.receipt.status)

      // Alice attempts to withdraw 0 LUSD
      try {
        const txAlice = await borrowerOperations.withdrawLUSD(th._100pct, 0, alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
    })

    it("withdrawLUSD(): reverts when system is in Recovery Mode", async () => {
      const txAlice1 = await openTrove({ ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txAlice1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice1.tx))
      let ecosystemFundBN = txAlice1FeeBN.div(2)
      let front1EndBN = txAlice1FeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txBob = await openTrove({ ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_1)
      const txBobFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txBob.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBobFeeBN.div(2))
      front1EndBN = front1EndBN.add(txBobFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txCarol = await openTrove({ ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: carol } })
      assert.equal((await troveManager.Troves(carol)).frontEndTag, frontEnd_2)
      const txCarolFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txCarol.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCarolFeeBN.div(2))
      let front2EndBN = txCarolFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Withdrawal possible when recoveryMode == false
      const txAlice = await borrowerOperations.withdrawLUSD(th._100pct, dec(100, 18), alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      assert.isTrue(txAlice.receipt.status)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice))
      ecosystemFundBN = ecosystemFundBN.add(txAliceFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAliceFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      await priceFeed.setPrice('50000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))

      //Check LUSD withdrawal impossible when recoveryMode == true
      try {
        const txBob = await borrowerOperations.withdrawLUSD(th._100pct, 1, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
    })

    it("withdrawLUSD(): reverts when withdrawal would bring the trove's ICR < MCR", async () => {
      const txAlice = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      let ecosystemFundBN = txAliceFeeBN.div(2)
      let front1EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txBob = await openTrove({ ICR: toBN(dec(11, 17)), frontEndTag: frontEnd_2, extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
      const txBobFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txBob.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBobFeeBN.div(2))
      let front2EndBN = txBobFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Bob tries to withdraw LUSD that would bring his ICR < MCR
      try {
        const txBob = await borrowerOperations.withdrawLUSD(th._100pct, 1, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
    })

    it("withdrawLUSD(): reverts when a withdrawal would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      // Alice and Bob creates troves with 150% ICR.  System TCR = 150%.
      const txAlice = await openTrove({ ICR: toBN(dec(15, 17)), frontEndTag: frontEnd_1, extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      let ecosystemFundBN = txAliceFeeBN.div(2)
      let front1EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txBob = await openTrove({ ICR: toBN(dec(15, 17)), frontEndTag: frontEnd_2, extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
      const txBobFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txBob.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBobFeeBN.div(2))
      let front2EndBN = txBobFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      var TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')

      // Bob attempts to withdraw 1 LUSD.
      // System TCR would be: ((3+3) * 100 ) / (200+201) = 600/401 = 149.62%, i.e. below CCR of 150%.
      try {
        const txBob = await borrowerOperations.withdrawLUSD(th._100pct, dec(1, 18), bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
    })

    it("withdrawLUSD(): reverts if system is in Recovery Mode", async () => {
      // --- SETUP ---
      const txAlice = await openTrove({ ICR: toBN(dec(15, 17)), frontEndTag: frontEnd_1, extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      let ecosystemFundBN = txAliceFeeBN.div(2)
      let front1EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txBob = await openTrove({ ICR: toBN(dec(15, 17)), frontEndTag: frontEnd_2, extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
      const txBobFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txBob.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBobFeeBN.div(2))
      let front2EndBN = txBobFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // --- TEST ---

      // price drops to 1ETH:150LUSD, reducing TCR below 150%
      await priceFeed.setPrice('150000000000000000000');
      assert.isTrue((await th.getTCR(contracts)).lt(toBN(dec(15, 17))))

      try {
        const txData = await borrowerOperations.withdrawLUSD(th._100pct, '200', alice, alice, { from: alice })
        assert.isFalse(txData.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
    })

    it("withdrawLUSD(): increases the Trove's LUSD debt by the correct amount", async () => {
      const txAlice = await openTrove({ ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      let ecosystemFundBN = txAliceFeeBN.div(2)
      let front1EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      // check before
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN(0)))

      const tx = await borrowerOperations.withdrawLUSD(th._100pct, await getNetBorrowingAmount(100), alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front1EndBN = front1EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      // check after
      const aliceDebtAfter = await getTroveEntireDebt(alice)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.add(toBN(100)))
    })

    it("withdrawLUSD(): increases LUSD debt in ActivePool by correct amount", async () => {
      const txAlice = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: alice, value: toBN(dec(100, 'ether')) } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      let ecosystemFundBN = txAliceFeeBN.div(2)
      let front1EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN(0)))

      // check before
      const activePool_LUSD_Before = await activePool.getLUSDDebt()
      assert.isTrue(activePool_LUSD_Before.eq(aliceDebtBefore))

      const tx = await borrowerOperations.withdrawLUSD(th._100pct, await getNetBorrowingAmount(dec(10000, 18)), alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front1EndBN = front1EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      // check after
      const activePool_LUSD_After = await activePool.getLUSDDebt()
      th.assertIsApproximatelyEqual(activePool_LUSD_After, activePool_LUSD_Before.add(toBN(dec(10000, 18))))
    })

    it("withdrawLUSD(): increases user LUSDToken balance by correct amount", async () => {
      const txAlice = await openTrove({ frontEndTag: frontEnd_1, extraParams: { value: toBN(dec(100, 'ether')), from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      let ecosystemFundBN = txAliceFeeBN.div(2)
      let front1EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      // check before
      const alice_LUSDTokenBalance_Before = await lusdToken.balanceOf(alice)
      assert.isTrue(alice_LUSDTokenBalance_Before.gt(toBN('0')))

      const tx = await borrowerOperations.withdrawLUSD(th._100pct, dec(10000, 18), alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front1EndBN = front1EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      // check after
      const alice_LUSDTokenBalance_After = await lusdToken.balanceOf(alice)
      assert.isTrue(alice_LUSDTokenBalance_After.eq(alice_LUSDTokenBalance_Before.add(toBN(dec(10000, 18)))))
    })

    // --- repayLUSD() ---
    it("repayLUSD(): reverts when repayment would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode(price))
      assert.isTrue((await troveManager.getCurrentICR(alice, price)).lt(toBN(dec(110, 16))))

      const LUSDRepayment = 1  // 1 wei repayment

     await assertRevert(borrowerOperations.repayLUSD(LUSDRepayment, alice, alice, { from: alice }), 
      "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("repayLUSD(): Succeeds when it would leave trove with net debt >= minimum net debt", async () => {
      // Make the LUSD request 2 wei above min net debt to correct for floor division, and make net debt = min net debt + 1 wei
      await weth.deposit({ from: A, value: dec(100, 30) });
      await weth.approve(borrowerOperations.address, dec(100, 30), { from: A});
      await borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('2'))), dec(100, 30) ,A, A, ZERO_ADDR, { from: A})
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)

      const repayTxA = await borrowerOperations.repayLUSD(1, A, A, { from: A })
      assert.isTrue(repayTxA.receipt.status)

      await weth.deposit({ from: B, value: dec(100, 30) });
      await weth.approve(borrowerOperations.address, dec(100, 30), { from: B });
      await borrowerOperations.openTrove(th._100pct, dec(20, 25), dec(100, 30),  B, B, ZERO_ADDR, { from: B })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)

      const repayTxB = await borrowerOperations.repayLUSD(dec(19, 25), B, B, { from: B })
      assert.isTrue(repayTxB.receipt.status)
    })

    it("repayLUSD(): reverts when it would leave trove with net debt < minimum net debt", async () => {
      // Make the LUSD request 2 wei above min net debt to correct for floor division, and make net debt = min net debt + 1 wei
      await weth.deposit({ from: A, value: dec(100, 30) });
      await weth.approve(borrowerOperations.address, dec(100, 30), { from: A });
      await borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('2'))), dec(100, 30), A, A, ZERO_ADDR, { from: A })
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)

      const repayTxAPromise = borrowerOperations.repayLUSD(2, A, A, { from: A })
      await assertRevert(repayTxAPromise, "BorrowerOps: Trove's net debt must be greater than minimum")
    })

    it("repayLUSD(): reverts when calling address does not have active trove", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
      // Bob successfully repays some LUSD
      const txBob = await borrowerOperations.repayLUSD(dec(10, 18), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Carol with no active trove attempts to repayLUSD
      try {
        const txCarol = await borrowerOperations.repayLUSD(dec(10, 18), carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("repayLUSD(): reverts when attempted repayment is > the debt of the trove", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
      const aliceDebt = await getTroveEntireDebt(alice)

      // Bob successfully repays some LUSD
      const txBob = await borrowerOperations.repayLUSD(dec(10, 18), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Alice attempts to repay more than her debt
      try {
        const txAlice = await borrowerOperations.repayLUSD(aliceDebt.add(toBN(dec(1, 18))), alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    //repayLUSD: reduces LUSD debt in Trove
    it("repayLUSD(): reduces the Trove's LUSD debt by the correct amount", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      await borrowerOperations.repayLUSD(aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      const aliceDebtAfter = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtAfter.gt(toBN('0')))

      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.mul(toBN(9)).div(toBN(10)))  // check 9/10 debt remaining
    })

    it("repayLUSD(): decreases LUSD debt in ActivePool by correct amount", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      // Check before
      const activePool_LUSD_Before = await activePool.getLUSDDebt()
      assert.isTrue(activePool_LUSD_Before.gt(toBN('0')))

      await borrowerOperations.repayLUSD(aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      // check after
      const activePool_LUSD_After = await activePool.getLUSDDebt()
      th.assertIsApproximatelyEqual(activePool_LUSD_After, activePool_LUSD_Before.sub(aliceDebtBefore.div(toBN(10))))
    })

    it("repayLUSD(): decreases user LUSDToken balance by correct amount", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      // check before
      const alice_LUSDTokenBalance_Before = await lusdToken.balanceOf(alice)
      assert.isTrue(alice_LUSDTokenBalance_Before.gt(toBN('0')))

      await borrowerOperations.repayLUSD(aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      // check after
      const alice_LUSDTokenBalance_After = await lusdToken.balanceOf(alice)
      th.assertIsApproximatelyEqual(alice_LUSDTokenBalance_After, alice_LUSDTokenBalance_Before.sub(aliceDebtBefore.div(toBN(10))))
    })

    it('repayLUSD(): can repay debt in Recovery Mode', async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
      const aliceDebtBefore = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice('105000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const tx = await borrowerOperations.repayLUSD(aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })
      assert.isTrue(tx.receipt.status)

      // Check Alice's debt: 110 (initial) - 50 (repaid)
      const aliceDebtAfter = await getTroveEntireDebt(alice)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.mul(toBN(9)).div(toBN(10)))
    })

    it("repayLUSD(): Reverts if borrower has insufficient LUSD balance to cover his debt repayment", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      const bobBalBefore = await lusdToken.balanceOf(B)
      assert.isTrue(bobBalBefore.gt(toBN('0')))

      // Bob transfers all but 5 of his LUSD to Carol
      await lusdToken.transfer(C, bobBalBefore.sub((toBN(dec(5, 18)))), { from: B })

      //Confirm B's LUSD balance has decreased to 5 LUSD
      const bobBalAfter = await lusdToken.balanceOf(B)

      assert.isTrue(bobBalAfter.eq(toBN(dec(5, 18))))
      
      // Bob tries to repay 6 LUSD
      const repayLUSDPromise_B = borrowerOperations.repayLUSD(toBN(dec(6, 18)), B, B, { from: B })

      await assertRevert(repayLUSDPromise_B, "Caller doesnt have enough LUSD to make repayment")
    })

    // --- adjustTrove() ---

    it("adjustTrove(): reverts when adjustment would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      const txAlice = await openTrove({ ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)

      const txBob = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_2, extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode(price))
      assert.isTrue((await troveManager.getCurrentICR(alice, price)).lt(toBN(dec(110, 16))))

      const LUSDRepayment = 1  // 1 wei repayment
      const collTopUp = 1

      await weth.deposit({ from: alice, value: collTopUp})
      await weth.approve(borrowerOperations.address, collTopUp, { from: alice})
      await assertRevert(borrowerOperations.adjustTrove(th._100pct, 0, LUSDRepayment, collTopUp, false, alice, alice, { from: alice }),
      "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("adjustTrove(): reverts if max fee < 0.5% in Normal mode", async () => {
      const txA = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), txAFeeBN.div(2).toString(), 10)

      await weth.deposit({ from: A, value: dec(2, 18) })
      await weth.approve(borrowerOperations.address, dec(2, 18), { from: A })
      await assertRevert(borrowerOperations.adjustTrove(0, 0, dec(1, 18), dec(2, 16), true, A, A, { from: A}), "Max fee percentage must be between 0.5% and 100%")
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), txAFeeBN.div(2).toString(), 10)

      await weth.deposit({ from: A, value: dec(2, 18) })
      await weth.approve(borrowerOperations.address, dec(2, 18), { from: A })
      await assertRevert(borrowerOperations.adjustTrove(1, 0, dec(1, 18), dec(2, 18), true, A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), txAFeeBN.div(2).toString(), 10)

      await weth.deposit({ from: A, value: dec(2, 18) })
      await weth.approve(borrowerOperations.address, dec(2, 18), { from: A })
      await assertRevert(borrowerOperations.adjustTrove('4999999999999999', 0, dec(1, 18), dec(2, 18), true, A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), txAFeeBN.div(2).toString(), 10)
    })

    it("adjustTrove(): allows max fee < 0.5% in Recovery mode", async () => {
      const txWhale = await openTrove({ ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale, value: toBN(dec(100, 'ether')) } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_2)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      let front2EndBN = txAFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      await priceFeed.setPrice(dec(120, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))

      await weth.deposit({ from: A, value: dec(300, 18) })
      await weth.approve(borrowerOperations.address, dec(300, 18), { from: A })
      const tx = await borrowerOperations.adjustTrove(0, 0, dec(1, 9), dec(300, 18), true, A, A, { from: A })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_2)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front2EndBN = front2EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      await priceFeed.setPrice(dec(1, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      
      await weth.deposit({ from: A, value: dec(30000, 18) })
      await weth.approve(borrowerOperations.address, dec(30000, 18), { from: A })
      const tx1 = await borrowerOperations.adjustTrove(1, 0, dec(1, 9), dec(30000, 18), true, A, A, { from: A })
      const tx1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx1))
      ecosystemFundBN = ecosystemFundBN.add(tx1FeeBN.div(2))
      front2EndBN = front2EndBN.add(tx1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      await priceFeed.setPrice(dec(1, 16))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_2)

      await weth.deposit({ from: A, value: dec(3000000, 18) })
      await weth.approve(borrowerOperations.address, dec(3000000, 18), { from: A })
      const tx2 = await borrowerOperations.adjustTrove('4999999999999999', 0, dec(1, 9), dec(3000000, 18), true, A, A, { from: A })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_2)
      const tx2FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx2))
      ecosystemFundBN = ecosystemFundBN.add(tx2FeeBN.div(2))
      front2EndBN = front2EndBN.add(tx2FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
    })
    
    it("adjustTrove(): decays a non-zero base rate", async () => {
      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      front1EndBN = front1EndBN.add(txBFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      let front2EndBN = txCFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const txD = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      front2EndBN = front2EndBN.add(txDFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const txE = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      assert.equal((await troveManager.Troves(E)).frontEndTag, frontEnd_2)
      const txEFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txE.tx))
      ecosystemFundBN = ecosystemFundBN.add(txEFeeBN.div(2))
      front2EndBN = front2EndBN.add(txEFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await weth.deposit({ from: D, value: dec(30000, 18) })
      await weth.approve(borrowerOperations.address, dec(30000, 18), { from: D })
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, dec(37, 18), 0, true, D, D, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front2EndBN = front2EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check baseRate has decreased
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E adjusts trove
      await weth.deposit({ from: D, value: dec(30000, 18) })
      await weth.approve(borrowerOperations.address, dec(30000, 18), { from: D})
      const tx1 =  await borrowerOperations.adjustTrove(th._100pct, 0, dec(37, 15), 0, true, E, E, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const tx1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx1))
      ecosystemFundBN = ecosystemFundBN.add(tx1FeeBN.div(2))
      front2EndBN = front2EndBN.add(tx1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const baseRate_3 = await troveManager.baseRate()
      assert.isTrue(baseRate_3.lt(baseRate_2))
    })

    it("adjustTrove(): doesn't decay a non-zero base rate when user issues 0 debt", async () => {
      await openTrove({ ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // D opens trove 
      await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)

      const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())
      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove with 0 debt
      await weth.deposit({ from: D, value: dec(1, 'ether')  })
      await weth.approve(borrowerOperations.address, dec(1, 'ether') , { from: D })
      await borrowerOperations.adjustTrove(th._100pct, 0, 0, dec(1, 'ether') , false, D, D, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())

      // Check baseRate has not decreased 
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.eq(baseRate_1))
    })
    
    it("adjustTrove(): doesn't change base rate if it is already zero", async () => {
      const txE = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      assert.equal((await troveManager.Troves(E)).frontEndTag, frontEnd_1)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txE.tx))
      let ecosystemFundBN = txFeeBN.div(2)
      let front1EndBN = txFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txD = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      let front2EndBN = txDFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await weth.deposit({ from: D, value: dec(1, 'ether') })
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: D })
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, dec(37, 18), 0, true, D, D, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const tx1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(tx1FeeBN.div(2))
      front2EndBN = front2EndBN.add(tx1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check baseRate is still 0
      const baseRate_2 = await troveManager.baseRate()
      assert.equal(baseRate_2, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E adjusts trove
      await weth.deposit({ from: D, value: dec(1, 'ether') })
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: D })
      const tx2 = await borrowerOperations.adjustTrove(th._100pct, 0, dec(37, 15), 0, true, E, E, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const tx2FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx2))
      ecosystemFundBN = ecosystemFundBN.add(tx2FeeBN.div(2))
      front2EndBN = front2EndBN.add(tx2FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const baseRate_3 = await troveManager.baseRate()
      assert.equal(baseRate_3, '0')
    })

    it("adjustTrove(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      
      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_2)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      let front2EndBN = txBFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      front2EndBN = front2EndBN.add(txCFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime()

      // 10 seconds pass
      th.fastForwardTime(10, web3.currentProvider)

      // Borrower C triggers a fee
      await weth.deposit({ from: C, value: dec(1, 'ether') })
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: C })
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, dec(1, 18), 0, true, C, C, { from: C })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front2EndBN = front2EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

      // 60 seconds passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(60))

      // Borrower C triggers a fee
      const tx1 = await borrowerOperations.adjustTrove(th._100pct, 0, dec(1, 18), 0, true, C, C, { from: C })
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      const tx1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx1))
      ecosystemFundBN = ecosystemFundBN.add(tx1FeeBN.div(2))
      front2EndBN = front2EndBN.add(tx1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
    })
    
    it("adjustTrove(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      front1EndBN = front1EndBN.add(txBFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      let front2EndBN = txCFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // Borrower C triggers a fee, before decay interval of 1 minute has passed
      await weth.deposit({ from: C, value: dec(1, 'ether') })
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: C })
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, dec(1, 18), 0, true, C, C, { from: C })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front2EndBN = front2EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // 1 minute passes
      th.fastForwardTime(60, web3.currentProvider)

      // Borrower C triggers another fee
      const tx1 = await borrowerOperations.adjustTrove(th._100pct, 0, dec(1, 18), 0, true, C, C, { from: C })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const tx1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx1))
      ecosystemFundBN = ecosystemFundBN.add(tx1FeeBN.div(2))
      front2EndBN = front2EndBN.add(tx1FeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))
    })

    it("adjustTrove(): borrowing at non-zero base rate sends LUSD fee to LQTY staking contract", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 LQTY
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: multisig })
      await lqtyStaking.stake(dec(1, 18), { from: multisig })

      // Check LQTY LUSD balance before == 0
      const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
      assert.equal(lqtyStaking_LUSDBalance_Before, '0')

      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_2)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      let front2EndBN = txBFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      front2EndBN = front2EndBN.add(txCFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      const tx = await openTrove({ extraLUSDAmount: toBN(dec(37, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_1)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx.tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front1EndBN = front1EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      // Check LQTY LUSD balance after has increased
      const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
      assert.isTrue(lqtyStaking_LUSDBalance_After.eq(lqtyStaking_LUSDBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("adjustTrove(): borrowing at non-zero base records the (drawn debt + fee) on the Trove struct", async () => {
        // time fast-forwards 1 year, and multisig stakes 1 LQTY
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
        await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: multisig })
        await lqtyStaking.stake(dec(1, 18), { from: multisig })

        const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
        assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
        const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
        let ecosystemFundBN = txWhaleFeeBN.div(2)
        let front1EndBN = txWhaleFeeBN.div(2)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

        const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
        const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
        ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
        front1EndBN = front1EndBN.add(txAFeeBN.div(2))
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

        const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
        const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
        ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
        front1EndBN = front1EndBN.add(txBFeeBN.div(2))
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
        
        const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
        assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
        const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
        ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
        let front2EndBN = txCFeeBN.div(2)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
        
        const txD = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
        assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
        const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
        ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
        front2EndBN = front2EndBN.add(txDFeeBN.div(2))
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

        const D_debtBefore = await getTroveEntireDebt(D)

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow()

        // Check baseRate is now non-zero
        const baseRate_1 = await troveManager.baseRate()
        assert.isTrue(baseRate_1.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        const withdrawal_D = toBN(dec(37, 18))

        // D withdraws LUSD
        const adjustmentTx = await borrowerOperations.adjustTrove(th._100pct, 0, withdrawal_D, 0, true, D, D, { from: D })
        assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
        const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(adjustmentTx))
        ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
        front2EndBN = front2EndBN.add(txFeeBN.div(2))
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
        th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

        const emittedFee = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(adjustmentTx))
        assert.isTrue(emittedFee.gt(toBN('0')))

        const D_newDebt = (await troveManager.Troves(D))[0]
    
        // Check debt on Trove struct equals initila debt plus drawn debt plus emitted fee
        assert.isTrue(D_newDebt.eq(D_debtBefore.add(withdrawal_D).add(emittedFee)))
      })
    }

    it("adjustTrove(): Borrowing at non-zero base rate increases the LQTY staking contract LUSD fees-per-unit-staked", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 LQTY
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: multisig })
      await lqtyStaking.stake(dec(1, 18), { from: multisig })

      // Check LQTY contract LUSD fees-per-unit-staked is zero
      const F_LUSD_Before = await lqtyStaking.F_LUSD()
      assert.equal(F_LUSD_Before, '0')

      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      front1EndBN = front1EndBN.add(txBFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_1)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      front1EndBN = front1EndBN.add(txCFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txD = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      let front2EndBN = txDFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, dec(37, 18), 0, true, D, D, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const feeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(feeBN.div(2))
      front2EndBN = front2EndBN.add(feeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check LQTY contract LUSD fees-per-unit-staked has increased
      const F_LUSD_After = await lqtyStaking.F_LUSD()
      assert.isTrue(F_LUSD_After.eq(F_LUSD_Before))
    })

    it("adjustTrove(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 LQTY
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: multisig })
      await lqtyStaking.stake(dec(1, 18), { from: multisig })

      // Check LQTY Staking contract balance before == 0
      const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
      assert.equal(lqtyStaking_LUSDBalance_Before, '0')

      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      
      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      front1EndBN = front1EndBN.add(txBFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      
      const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_1)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      front1EndBN = front1EndBN.add(txCFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      
      const txD = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      let front2EndBN = txDFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      const D_LUSDBalanceBefore = await lusdToken.balanceOf(D)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      const LUSDRequest_D = toBN(dec(40, 18))
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, LUSDRequest_D, 0, true, D, D, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front2EndBN = front2EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check LQTY staking LUSD balance has increased
      const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
      assert.isTrue(lqtyStaking_LUSDBalance_After.eq(lqtyStaking_LUSDBalance_Before))

      // Check D's LUSD balance has increased by their requested LUSD
      const D_LUSDBalanceAfter = await lusdToken.balanceOf(D)
      assert.isTrue(D_LUSDBalanceAfter.eq(D_LUSDBalanceBefore.add(LUSDRequest_D)))
    })

    it("adjustTrove(): Borrowing at zero base rate changes LUSD balance of LQTY staking contract", async () => {
      const txWhale = await openTrove({ ICR: toBN(dec(10, 18)), frontEndTag: frontEnd_1, extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(30, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      
      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_2)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      let front2EndBN = txBFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      
      const txC = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      front2EndBN = front2EndBN.add(txCFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      
      const txD = await openTrove({ extraLUSDAmount: toBN(dec(50, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_1)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      front1EndBN = front1EndBN.add(txDFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // Check staking LUSD balance before > 0
      const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
      assert.isTrue(lqtyStaking_LUSDBalance_Before.eq(toBN('0')))

      // D adjusts trove
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, dec(37, 18), 0, true, D, D, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_1)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front1EndBN = front1EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      // Check staking LUSD balance after > staking balance before
      const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
      assert.isTrue(lqtyStaking_LUSDBalance_After.eq(lqtyStaking_LUSDBalance_Before))
    })

    it("adjustTrove(): Borrowing at zero base rate changes LQTY staking contract LUSD fees-per-unit-staked", async () => {
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: toBN(dec(100, 'ether')) } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)),  frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      
      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      front1EndBN = front1EndBN.add(txBFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      let front2EndBN = txCFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const txD = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      front2EndBN = front2EndBN.add(txDFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // A artificially receives LQTY, then stakes it
      await lqtyToken.unprotectedMint(A, dec(100, 18))
      await lqtyStaking.stake(dec(100, 18), { from: A })

      // Check staking LUSD balance before == 0
      const F_LUSD_Before = await lqtyStaking.F_LUSD()
      assert.isTrue(F_LUSD_Before.eq(toBN('0')))

      // D adjusts trove
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, dec(37, 18), 0, true, D, D, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front2EndBN = front2EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check staking LUSD balance increases
      const F_LUSD_After = await lqtyStaking.F_LUSD()
      assert.isTrue(F_LUSD_After.eq(F_LUSD_Before))
    })

    it("adjustTrove(): Borrowing at zero base rate sends total requested LUSD to the user", async () => {
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: toBN(dec(100, 'ether')) } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, frontEnd_1)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAFeeBN.div(2))
      front1EndBN = front1EndBN.add(txAFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_1)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBFeeBN.div(2))
      front1EndBN = front1EndBN.add(txBFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, frontEnd_2)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      ecosystemFundBN = ecosystemFundBN.add(txCFeeBN.div(2))
      let front2EndBN = txCFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const txD = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, frontEnd_2)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      ecosystemFundBN = ecosystemFundBN.add(txDFeeBN.div(2))
      front2EndBN = front2EndBN.add(txDFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const D_LUSDBalBefore = await lusdToken.balanceOf(D)
      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      const DUSDBalanceBefore = await lusdToken.balanceOf(D)

      // D adjusts trove
      const LUSDRequest_D = toBN(dec(40, 18))
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, LUSDRequest_D, 0, true, D, D, { from: D })
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front2EndBN = front2EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Check D's LUSD balance increased by their requested LUSD
      const LUSDBalanceAfter = await lusdToken.balanceOf(D)
      assert.isTrue(LUSDBalanceAfter.eq(D_LUSDBalBefore.add(LUSDRequest_D)))
    })

    it("adjustTrove(): reverts when calling address has no active trove", async () => {
      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      let ecosystemFundBN = txAliceFeeBN.div(2)
      let front1EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txBob = await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
      const txBobFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txBob.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBobFeeBN.div(2))
      let front2EndBN = txBobFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // Alice coll and debt increase(+1 ETH, +50LUSD)
      await weth.deposit({ from: alice, value: dec(1, 'ether') })
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: alice })
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), dec(1, 'ether'), true, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front1EndBN = front1EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      try {
        await weth.deposit({ from: carol, value: dec(1, 'ether') })
        await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: carol })
        const txCarol = await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), dec(1, 'ether'), true, carol, carol, { from: carol, value: dec(1, 'ether') })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
    })

    it("adjustTrove(): reverts in Recovery Mode when the adjustment would reduce the TCR", async () => {
      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      let ecosystemFundBN = txAliceFeeBN.div(2)
      let front1EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txBob = await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
      const txBobFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txBob.tx))
      ecosystemFundBN = ecosystemFundBN.add(txBobFeeBN.div(2))
      let front2EndBN = txBobFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await weth.deposit({ from: alice, value: dec(1, 'ether') })
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: alice })
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), dec(1, 'ether'), true, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      assert.isTrue(tx.receipt.status)
      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front1EndBN = front1EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      assert.isTrue(await th.checkRecoveryMode(contracts))

      try { // collateral withdrawal should also fail
        const txAlice = await borrowerOperations.adjustTrove(th._100pct, dec(1, 'ether'), 0, 0, false, alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      try { // debt increase should fail
        const txBob = await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), 0, true, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      try { // debt increase that's also a collateral increase should also fail, if ICR will be worse off
        const txBob = await borrowerOperations.adjustTrove(th._100pct, 0, dec(111, 18), 0, true, bob, bob, { from: bob, value: dec(1, 'ether') })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
    })

    it("adjustTrove(): collateral withdrawal reverts in Recovery Mode", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Alice attempts an adjustment that repays half her debt BUT withdraws 1 wei collateral, and fails
      await assertRevert(borrowerOperations.adjustTrove(th._100pct, 1, dec(5000, 18), 0, false, alice, alice, { from: alice }),
        "BorrowerOps: Collateral withdrawal not permitted Recovery Mode")
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
    })

    it("adjustTrove(): debt increase that would leave ICR < 150% reverts in Recovery Mode", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)

      const CCR = await troveManager.CCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const ICR_A = await troveManager.getCurrentICR(alice, price)

      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceColl = await getTroveEntireColl(alice)
      const debtIncrease = toBN(dec(50, 18))
      const collIncrease = toBN(dec(1, 'ether'))

      // Check the new ICR would be an improvement, but less than the CCR (150%)
      const newICR = await troveManager.computeICR(aliceColl.add(collIncrease), aliceDebt.add(debtIncrease), price)

      assert.isTrue(newICR.gt(ICR_A) && newICR.lt(CCR))

      await weth.deposit({ from: alice, value: collIncrease})
      await weth.approve(borrowerOperations.address, collIncrease, { from: alice })
      await assertRevert(borrowerOperations.adjustTrove(th._100pct, 0, debtIncrease, collIncrease, true, alice, alice, { from: alice }),
        "BorrowerOps: Operation must leave trove with ICR >= CCR")
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
    })

    it("adjustTrove(): debt increase that would reduce the ICR reverts in Recovery Mode", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)

      const CCR = await troveManager.CCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(105, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))

      //--- Alice with ICR > 150% tries to reduce her ICR ---

      const ICR_A = await troveManager.getCurrentICR(alice, price)

      // Check Alice's initial ICR is above 150%
      assert.isTrue(ICR_A.gt(CCR))

      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceColl = await getTroveEntireColl(alice)
      const aliceDebtIncrease = toBN(dec(150, 18))
      const aliceCollIncrease = toBN(dec(1, 'ether'))

      const newICR_A = await troveManager.computeICR(aliceColl.add(aliceCollIncrease), aliceDebt.add(aliceDebtIncrease), price)

      // Check Alice's new ICR would reduce but still be greater than 150%
      assert.isTrue(newICR_A.lt(ICR_A) && newICR_A.gt(CCR))
    
      await weth.deposit({ from: alice, value: aliceCollIncrease })
      await weth.approve(borrowerOperations.address, aliceCollIncrease, { from: alice })
      await assertRevert(borrowerOperations.adjustTrove(th._100pct, 0, aliceDebtIncrease, aliceCollIncrease, true, alice, alice, { from: alice }),
        "BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode")
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      //--- Bob with ICR < 150% tries to reduce his ICR ---

      const ICR_B = await troveManager.getCurrentICR(bob, price)

      // Check Bob's initial ICR is below 150%
      assert.isTrue(ICR_B.lt(CCR))

      const bobDebt = await getTroveEntireDebt(bob)
      const bobColl = await getTroveEntireColl(bob)
      const bobDebtIncrease = toBN(dec(450, 18))
      const bobCollIncrease = toBN(dec(1, 'ether'))

      const newICR_B = await troveManager.computeICR(bobColl.add(bobCollIncrease), bobDebt.add(bobDebtIncrease), price)

      // Check Bob's new ICR would reduce 
      assert.isTrue(newICR_B.lt(ICR_B))

      await weth.deposit({ from: bob, value: bobCollIncrease })
      await weth.approve(borrowerOperations.address, bobCollIncrease, { from: bob })
      await assertRevert(borrowerOperations.adjustTrove(th._100pct, 0, bobDebtIncrease, bobCollIncrease, true, bob, bob, { from: bob, value: bobCollIncrease }),
      " BorrowerOps: Operation must leave trove with ICR >= CCR")
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
    })

    it("adjustTrove(): A trove with ICR < CCR in Recovery Mode can adjust their trove to ICR > CCR", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
     
      const CCR = await troveManager.CCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(100, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const ICR_A = await troveManager.getCurrentICR(alice, price)
      // Check initial ICR is below 150%
      assert.isTrue(ICR_A.lt(CCR))

      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceColl = await getTroveEntireColl(alice)
      const debtIncrease = toBN(dec(5000, 18))
      const collIncrease = toBN(dec(150, 'ether'))

      const newICR = await troveManager.computeICR(aliceColl.add(collIncrease), aliceDebt.add(debtIncrease), price)
      const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())
      const balanceFE1 = BigNumber.from((await lusdToken.balanceOf(frontEnd_1)).toString())
      const balanceFE2 = BigNumber.from((await lusdToken.balanceOf(frontEnd_2)).toString())

      // Check new ICR would be > 150%
      assert.isTrue(newICR.gt(CCR))

      await weth.deposit({ from: alice, value: collIncrease })
      await weth.approve(borrowerOperations.address, collIncrease, { from: alice })
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, debtIncrease, collIncrease, true, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      assert.isTrue(tx.receipt.status)

      const actualNewICR = await troveManager.getCurrentICR(alice, price)
      assert.isTrue(actualNewICR.gt(CCR))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_1)).toString(), balanceFE1.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_2)).toString(), balanceFE2.toString())
    })

    it("adjustTrove(): A trove with ICR > CCR in Recovery Mode can improve their ICR", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
      const CCR = await troveManager.CCR()

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(105, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))

      const initialICR = await troveManager.getCurrentICR(alice, price)
      // Check initial ICR is above 150%
      assert.isTrue(initialICR.gt(CCR))

      const aliceDebt = await getTroveEntireDebt(alice)
      const aliceColl = await getTroveEntireColl(alice)
      const debtIncrease = toBN(dec(5000, 18))
      const collIncrease = toBN(dec(150, 'ether'))

      const newICR = await troveManager.computeICR(aliceColl.add(collIncrease), aliceDebt.add(debtIncrease), price)
      const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())
      const balanceFE1 = BigNumber.from((await lusdToken.balanceOf(frontEnd_1)).toString())
      const balanceFE2 = BigNumber.from((await lusdToken.balanceOf(frontEnd_2)).toString())

      // Check new ICR would be > old ICR
      assert.isTrue(newICR.gt(initialICR))

      await weth.deposit({ from: alice, value: collIncrease })
      await weth.approve(borrowerOperations.address, collIncrease, { from: alice })
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, debtIncrease, collIncrease, true, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      assert.isTrue(tx.receipt.status)

      const actualNewICR = await troveManager.getCurrentICR(alice, price)
      assert.isTrue(actualNewICR.gt(initialICR))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_1)).toString(), balanceFE1.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_2)).toString(), balanceFE2.toString())
    })

    it("adjustTrove(): debt increase in Recovery Mode charges no fee", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(200000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      assert.isFalse(await th.checkRecoveryMode(contracts))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // B stakes LQTY
      await lqtyToken.unprotectedMint(bob, dec(100, 18))
      await lqtyStaking.stake(dec(100, 18), { from: bob })

      const lqtyStakingLUSDBalanceBefore = await lusdToken.balanceOf(lqtyStaking.address)
      assert.isTrue(lqtyStakingLUSDBalanceBefore.eq(toBN('0')))
      const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())
      const balanceFE1 = BigNumber.from((await lusdToken.balanceOf(frontEnd_1)).toString())
      const balanceFE2 = BigNumber.from((await lusdToken.balanceOf(frontEnd_2)).toString())

      await weth.deposit({ from: alice, value: dec(100, 'ether') })
      await weth.approve(borrowerOperations.address, dec(100, 'ether'), { from: alice })
      const txAlice = await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), dec(100, 'ether'), true, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      assert.isTrue(txAlice.receipt.status)

      // Check emitted fee = 0
      const emittedFee = toBN(await th.getEventArgByName(txAlice, 'LUSDBorrowingFeePaid', '_LUSDFee'))
      assert.isTrue(emittedFee.eq(toBN('0')))
      
      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Check no fee was sent to staking contract
      const lqtyStakingLUSDBalanceAfter = await lusdToken.balanceOf(lqtyStaking.address)
      assert.equal(lqtyStakingLUSDBalanceAfter.toString(), lqtyStakingLUSDBalanceBefore.toString())
      
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_1)).toString(), balanceFE1.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_2)).toString(), balanceFE2.toString())
    })

    it("adjustTrove(): reverts when change would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18))

      await openTrove({ ICR: toBN(dec(15, 17)), frontEndTag: frontEnd_1, extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      await openTrove({ ICR: toBN(dec(15, 17)), frontEndTag: frontEnd_2, extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
      
      const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())
      const balanceFE1 = BigNumber.from((await lusdToken.balanceOf(frontEnd_1)).toString())
      const balanceFE2 = BigNumber.from((await lusdToken.balanceOf(frontEnd_2)).toString())

      // Check TCR and Recovery Mode
      const TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Bob attempts an operation that would bring the TCR below the CCR
      try {
        const txBob = await borrowerOperations.adjustTrove(th._100pct, 0, dec(1, 18), 0, true, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_1)).toString(), balanceFE1.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_2)).toString(), balanceFE2.toString())
    })

    it("adjustTrove(): reverts when LUSD repaid is > debt of the trove", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const bobOpenTx = (await openTrove({ ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: bob } })).tx
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)

      const bobDebt = await getTroveEntireDebt(bob)
      assert.isTrue(bobDebt.gt(toBN('0')))

      const bobFee = toBN(await th.getEventArgByIndex(bobOpenTx, 'LUSDBorrowingFeePaid', 1))
      assert.isTrue(bobFee.gt(toBN('0')))

      // Alice transfers LUSD to bob to compensate borrowing fees
      await lusdToken.transfer(bob, bobFee, { from: alice })

      const remainingDebt = (await troveManager.getTroveDebt(bob)).sub(LUSD_GAS_COMPENSATION)
      const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())
      const balanceFE1 = BigNumber.from((await lusdToken.balanceOf(frontEnd_1)).toString())
      const balanceFE2 = BigNumber.from((await lusdToken.balanceOf(frontEnd_2)).toString())

      // Bob attempts an adjustment that would repay 1 wei more than his debt
      await weth.deposit({ from: bob, value: dec(1, 'ether') })
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: bob })
      await assertRevert(
        borrowerOperations.adjustTrove(th._100pct, 0, remainingDebt.add(toBN(1)), dec(1, 'ether'), false, bob, bob, { from: bob }),
        "revert"
      )
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_1)).toString(), balanceFE1.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_2)).toString(), balanceFE2.toString())
    })

    it("adjustTrove(): reverts when attempted ETH withdrawal is >= the trove's collateral", async () => {
      await openTrove({ ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_1, extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      await openTrove({ ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
      await openTrove({ ICR: toBN(dec(2, 18)), frontEndTag: frontEnd_2, extraParams: { from: carol } })
      assert.equal((await troveManager.Troves(carol)).frontEndTag, frontEnd_2)
     
      const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())
      const balanceFE1 = BigNumber.from((await lusdToken.balanceOf(frontEnd_1)).toString())
      const balanceFE2 = BigNumber.from((await lusdToken.balanceOf(frontEnd_2)).toString())

      const carolColl = await getTroveEntireColl(carol)

      // Carol attempts an adjustment that would withdraw 1 wei more than her ETH
      try {
        const txCarol = await borrowerOperations.adjustTrove(th._100pct, carolColl.add(toBN(1)), 0, 0, true, carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_1)).toString(), balanceFE1.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_2)).toString(), balanceFE2.toString())
    })

    it("adjustTrove(): reverts when change would cause the ICR of the trove to fall below the MCR", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(100, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      await priceFeed.setPrice(dec(100, 18))
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(11, 17)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(11, 17)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
      
      const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())
      const balanceFE1 = BigNumber.from((await lusdToken.balanceOf(frontEnd_1)).toString())
      const balanceFE2 = BigNumber.from((await lusdToken.balanceOf(frontEnd_2)).toString())

      // Bob attempts to increase debt by 100 LUSD and 1 ether, i.e. a change that constitutes a 100% ratio of coll:debt.
      // Since his ICR prior is 110%, this change would reduce his ICR below MCR.
      try {
        await weth.deposit({ from: bob, value: dec(1, 'ether') })
        await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: bob })
        const txBob = await borrowerOperations.adjustTrove(th._100pct, 0, dec(100, 18), dec(1, 18), true, bob, bob, { from: bob, value: dec(1, 'ether') })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_1)).toString(), balanceFE1.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_2)).toString(), balanceFE2.toString())
    })

    it("adjustTrove(): With 0 coll change, doesnt change borrower's coll or ActivePool coll", async () => {
      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      let ecosystemFundBN = txAliceFeeBN.div(2)
      let front1EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
    
      const aliceCollBefore = await getTroveEntireColl(alice)
      const activePoolCollBefore = await activePool.getETH()

      assert.isTrue(aliceCollBefore.gt(toBN('0')))
      assert.isTrue(aliceCollBefore.eq(activePoolCollBefore))

      // Alice adjusts trove. No coll change, and a debt increase (+50LUSD)
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), 0, true, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front1EndBN = front1EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const aliceCollAfter = await getTroveEntireColl(alice)
      const activePoolCollAfter = await activePool.getETH()

      assert.isTrue(aliceCollAfter.eq(activePoolCollAfter))
      assert.isTrue(activePoolCollAfter.eq(activePoolCollAfter))
    })

    it("adjustTrove(): With 0 debt change, doesnt change borrower's debt or ActivePool debt", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const aliceDebtBefore = await getTroveEntireDebt(alice)
      const activePoolDebtBefore = await activePool.getLUSDDebt()

      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(aliceDebtBefore.eq(activePoolDebtBefore))

      // Alice adjusts trove. Coll change, no debt change
      await weth.deposit({from: alice, value: dec(1, 'ether')})
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: alice })
      await borrowerOperations.adjustTrove(th._100pct, 0, 0, dec(1, 'ether'), false, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const aliceDebtAfter = await getTroveEntireDebt(alice)
      const activePoolDebtAfter = await activePool.getLUSDDebt()

      assert.isTrue(aliceDebtAfter.eq(aliceDebtBefore))
      assert.isTrue(activePoolDebtAfter.eq(activePoolDebtBefore))
    })

    it("adjustTrove(): updates borrower's debt and coll with an increase in both", async () => {
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAliceFeeBN.div(2))
      let front2EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))

      // Alice adjusts trove. Coll and debt increase(+1 ETH, +50LUSD)
      await weth.deposit({ from: alice, value: dec(1, 'ether') })
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: alice })
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, await getNetBorrowingAmount(dec(50, 18)), dec(1, 'ether') , true, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front1EndBN = front1EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.add(toBN(dec(50, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter, collBefore.add(toBN(dec(1, 18))), 10000)
    })

    it("adjustTrove(): updates borrower's debt and coll with a decrease in both", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))

      // Alice adjusts trove coll and debt decrease (-0.5 ETH, -50LUSD)
      await borrowerOperations.adjustTrove(th._100pct, dec(500, 'finney'), dec(50, 18), 0, false, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)

      assert.isTrue(debtAfter.eq(debtBefore.sub(toBN(dec(50, 18)))))
      assert.isTrue(collAfter.eq(collBefore.sub(toBN(dec(5, 17)))))
    })

    it("adjustTrove(): updates borrower's  debt and coll with coll increase, debt decrease", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt decrease (+0.5 ETH, -50LUSD)
      await weth.deposit({ from: alice, value: dec(500, 'finney') })
      await weth.approve(borrowerOperations.address, dec(500, 'finney'), { from: alice })
      await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), dec(500, 'finney'), false, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.sub(toBN(dec(50, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter, collBefore.add(toBN(dec(5, 17))), 10000)
    })

    it("adjustTrove(): updates borrower's debt and coll with coll decrease, debt increase", async () => {
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAliceFeeBN.div(2))
      let front2EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const debtBefore = await getTroveEntireDebt(alice)
      const collBefore = await getTroveEntireColl(alice)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt increase (0.1 ETH, 10LUSD)
      const tx = await borrowerOperations.adjustTrove(th._100pct, dec(1, 17), await getNetBorrowingAmount(dec(1, 18)), 0, true, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      const debtAfter = await getTroveEntireDebt(alice)
      const collAfter = await getTroveEntireColl(alice)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front2EndBN = front2EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.add(toBN(dec(1, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter, collBefore.sub(toBN(dec(1, 17))), 10000)
    })

    it("adjustTrove(): updates borrower's stake and totalStakes with a coll increase", async () => {
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAliceFeeBN.div(2))
      let front2EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const stakeBefore = await troveManager.getTroveStake(alice)
      const totalStakesBefore = await troveManager.totalStakes();
      assert.isTrue(stakeBefore.gt(toBN('0')))
      assert.isTrue(totalStakesBefore.gt(toBN('0')))

      // Alice adjusts trove - coll and debt increase (+1 ETH, +50 LUSD)
      await weth.deposit({ from: alice, value: dec(1, 'ether')  })
      await weth.approve(borrowerOperations.address, dec(1, 'ether') , { from: alice })
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, dec(50, 18), dec(1, 'ether') , true, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front2EndBN = front2EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const stakeAfter = await troveManager.getTroveStake(alice)
      const totalStakesAfter = await troveManager.totalStakes();

      assert.isTrue(stakeAfter.eq(stakeBefore.add(toBN(dec(1, 18)))))
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.add(toBN(dec(1, 18)))))
    })

    it("adjustTrove():  updates borrower's stake and totalStakes with a coll decrease", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const stakeBefore = await troveManager.getTroveStake(alice)
      const totalStakesBefore = await troveManager.totalStakes();
      assert.isTrue(stakeBefore.gt(toBN('0')))
      assert.isTrue(totalStakesBefore.gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove(th._100pct, dec(500, 'finney'), dec(50, 18), 0, false, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const stakeAfter = await troveManager.getTroveStake(alice)
      const totalStakesAfter = await troveManager.totalStakes();

      assert.isTrue(stakeAfter.eq(stakeBefore.sub(toBN(dec(5, 17)))))
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.sub(toBN(dec(5, 17)))))
    })

    it("adjustTrove(): changes LUSDToken balance by the requested decrease", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const alice_LUSDTokenBalance_Before = await lusdToken.balanceOf(alice)
      assert.isTrue(alice_LUSDTokenBalance_Before.gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove(th._100pct, dec(100, 'finney'), dec(10, 18), 0, false, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // check after
      const alice_LUSDTokenBalance_After = await lusdToken.balanceOf(alice)
      assert.isTrue(alice_LUSDTokenBalance_After.eq(alice_LUSDTokenBalance_Before.sub(toBN(dec(10, 18)))))
    })

    it("adjustTrove(): changes LUSDToken balance by the requested increase", async () => {
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAliceFeeBN.div(2))
      let front2EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const alice_LUSDTokenBalance_Before = await lusdToken.balanceOf(alice)
      assert.isTrue(alice_LUSDTokenBalance_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt increase
      await weth.deposit({ from: alice, value: dec(1, 'ether') })
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: alice })
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, dec(100, 18), dec(1, 'ether'), true, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front2EndBN = front2EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      // check after
      const alice_LUSDTokenBalance_After = await lusdToken.balanceOf(alice)
      assert.isTrue(alice_LUSDTokenBalance_After.eq(alice_LUSDTokenBalance_Before.add(toBN(dec(100, 18)))))
    })

    it("adjustTrove(): Changes the activePool ETH and raw ether balance by the requested decrease", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const activePool_ETH_Before = await activePool.getETH()
      const activePool_RawEther_Before = await weth.balanceOf(activePool.address)
      assert.isTrue(activePool_ETH_Before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_Before.gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove(th._100pct, dec(100, 'finney'), dec(10, 18), 0, false, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const activePool_ETH_After = await activePool.getETH()
      const activePool_RawEther_After = await weth.balanceOf(activePool.address)
      assert.isTrue(activePool_ETH_After.eq(activePool_ETH_Before.sub(toBN(dec(1, 17)))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_ETH_Before.sub(toBN(dec(1, 17)))))
    })

    it("adjustTrove(): Changes the activePool ETH and raw ether balance by the amount of ETH sent", async () => {
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAliceFeeBN.div(2))
      let front2EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)

      const activePool_ETH_Before = await activePool.getETH()
      const activePool_RawEther_Before = await weth.balanceOf(activePool.address)
      assert.isTrue(activePool_ETH_Before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt increase
      await weth.deposit({ from: alice, value: dec(1, 'ether') })
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: alice })
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, dec(100, 18), dec(1, 'ether'), true, alice, alice, { from: alice })
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front2EndBN = front2EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const activePool_ETH_After = await activePool.getETH()
      const activePool_RawEther_After = await weth.balanceOf(activePool.address)
      assert.isTrue(activePool_ETH_After.eq(activePool_ETH_Before.add(toBN(dec(1, 18)))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_ETH_Before.add(toBN(dec(1, 18)))))
    })

    it("adjustTrove(): Changes the LUSD debt in ActivePool by requested decrease", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())

      const activePool_LUSDDebt_Before = await activePool.getLUSDDebt()
      assert.isTrue(activePool_LUSDDebt_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt decrease
      await weth.deposit({ from: alice, value: dec(1, 'ether') })
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: alice })
      await borrowerOperations.adjustTrove(th._100pct, 0, dec(30, 18), dec(1, 'ether'), false, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const activePool_LUSDDebt_After = await activePool.getLUSDDebt()
      assert.isTrue(activePool_LUSDDebt_After.eq(activePool_LUSDDebt_Before.sub(toBN(dec(30, 18)))))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())
    })

    it("adjustTrove(): Changes the LUSD debt in ActivePool by requested increase", async () => {
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      let ecosystemFundBN = txWhaleFeeBN.div(2)
      let front1EndBN = txWhaleFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)

      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      ecosystemFundBN = ecosystemFundBN.add(txAliceFeeBN.div(2))
      let front2EndBN = txAliceFeeBN.div(2)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      const activePool_LUSDDebt_Before = await activePool.getLUSDDebt()
      assert.isTrue(activePool_LUSDDebt_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt increase
      await weth.deposit({ from: alice, value: dec(1, 'ether') })
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: alice })
      const tx = await borrowerOperations.adjustTrove(th._100pct, 0, await getNetBorrowingAmount(dec(100, 18)), dec(1, 'ether'), true, alice, alice, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const txFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx))
      ecosystemFundBN = ecosystemFundBN.add(txFeeBN.div(2))
      front2EndBN = front2EndBN.add(txFeeBN.div(2))
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(ecosystemFund.address)).toString(), ecosystemFundBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_2)).toString(), front2EndBN.toString(), 10)
      th.assertIsApproximatelyEqual((await lusdToken.balanceOf(frontEnd_1)).toString(), front1EndBN.toString(), 10)
      
      const activePool_LUSDDebt_After = await activePool.getLUSDDebt()
    
      th.assertIsApproximatelyEqual(activePool_LUSDDebt_After, activePool_LUSDDebt_Before.add(toBN(dec(100, 18))))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.add(txFeeBN).toString())
    })

    it("adjustTrove(): new coll = 0 and new debt = 0 is not allowed, as gas compensation still counts toward ICR", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      
      const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())
      const balanceFE1 = BigNumber.from((await lusdToken.balanceOf(frontEnd_1)).toString())
      const balanceFE2 = BigNumber.from((await lusdToken.balanceOf(frontEnd_2)).toString())

      const aliceColl = await getTroveEntireColl(alice)
      const aliceDebt = await getTroveEntireColl(alice)
      const status_Before = await troveManager.getTroveStatus(alice)
      const isInSortedList_Before = await sortedTroves.contains(alice)

      assert.equal(status_Before, 1)  // 1: Active
      assert.isTrue(isInSortedList_Before)

      await assertRevert(
        borrowerOperations.adjustTrove(th._100pct, aliceColl, aliceDebt, 0, true, alice, alice, { from: alice }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_1)).toString(), balanceFE1.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_2)).toString(), balanceFE2.toString())
    })

    it("adjustTrove(): Reverts if requested debt increase and amount is zero", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)

      const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())
      const balanceFE1 = BigNumber.from((await lusdToken.balanceOf(frontEnd_1)).toString())
      const balanceFE2 = BigNumber.from((await lusdToken.balanceOf(frontEnd_2)).toString())

      await assertRevert(borrowerOperations.adjustTrove(th._100pct, 0, 0, 0, true, alice, alice, { from: alice }),
        'BorrowerOps: Debt increase requires non-zero debtChange')
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_1)).toString(), balanceFE1.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_2)).toString(), balanceFE2.toString())
    })

    it("adjustTrove(): Reverts if requested coll withdrawal and ether is sent", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())
      const balanceFE1 = BigNumber.from((await lusdToken.balanceOf(frontEnd_1)).toString())
      const balanceFE2 = BigNumber.from((await lusdToken.balanceOf(frontEnd_2)).toString())

      await weth.deposit({ from: alice, value: dec(3, 'ether') })
      await weth.approve(borrowerOperations.address, dec(3, 'ether'), { from: alice })
      await assertRevert(borrowerOperations.adjustTrove(th._100pct, dec(1, 'ether'), dec(100, 18), dec(3, 'ether') , true, alice, alice, { from: alice }), 'BorrowerOperations: Cannot withdraw and add coll')
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_1)).toString(), balanceFE1.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_2)).toString(), balanceFE2.toString())
    })

    it("adjustTrove(): Reverts if it’s zero adjustment", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())
      const balanceFE1 = BigNumber.from((await lusdToken.balanceOf(frontEnd_1)).toString())

      await assertRevert(borrowerOperations.adjustTrove(th._100pct, 0, 0, 0, false, alice, alice, { from: alice }),
                         'BorrowerOps: There must be either a collateral change or a debt change')
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_1)).toString(), balanceFE1.toString())
    })

    it("adjustTrove(): Reverts if requested coll withdrawal is greater than trove's collateral", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_2)

      const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())
      const balanceFE1 = BigNumber.from((await lusdToken.balanceOf(frontEnd_1)).toString())
      const balanceFE2 = BigNumber.from((await lusdToken.balanceOf(frontEnd_2)).toString())

      const aliceColl = await getTroveEntireColl(alice)

      // Requested coll withdrawal > coll in the trove
      await assertRevert(borrowerOperations.adjustTrove(th._100pct, aliceColl.add(toBN(1)), 0, 0, false, alice, alice, { from: alice }))
      assert.equal((await troveManager.Troves(alice)).frontEndTag, frontEnd_1)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_1)).toString(), balanceFE1.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_2)).toString(), balanceFE2.toString())

      await assertRevert(borrowerOperations.adjustTrove(th._100pct, aliceColl.add(toBN(dec(37, 'ether'))), 0, 0, false, bob, bob, { from: bob }))
      assert.equal((await troveManager.Troves(bob)).frontEndTag, frontEnd_2)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_1)).toString(), balanceFE1.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_2)).toString(), balanceFE2.toString())
    })

    it("adjustTrove(): Reverts if borrower has insufficient LUSD balance to cover his debt repayment", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_1, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, frontEnd_1)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), frontEndTag: frontEnd_2, ICR: toBN(dec(10, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_2)
      
      const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())
      const balanceFE1 = BigNumber.from((await lusdToken.balanceOf(frontEnd_1)).toString())
      const balanceFE2 = BigNumber.from((await lusdToken.balanceOf(frontEnd_2)).toString())
    
      const bobDebt = await getTroveEntireDebt(B)

      // Bob transfers some LUSD to carol
      await lusdToken.transfer(C, dec(10, 18), { from: B })

      //Confirm B's LUSD balance is less than 50 LUSD
      const B_LUSDBal = await lusdToken.balanceOf(B)
      assert.isTrue(B_LUSDBal.lt(bobDebt))

      const repayLUSDPromise_B = borrowerOperations.adjustTrove(th._100pct, 0, bobDebt, 0, false, B, B, { from: B })
      assert.equal((await troveManager.Troves(B)).frontEndTag, frontEnd_2)

      // B attempts to repay all his debt
      await assertRevert(repayLUSDPromise_B, "revert")
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_1)).toString(), balanceFE1.toString())
      assert.equal((await lusdToken.balanceOf(frontEnd_2)).toString(), balanceFE2.toString())
    })

    // --- Internal _adjustTrove() ---

    if (!withProxy) { // no need to test this with proxies
      it("Internal _adjustTrove(): reverts when op is a withdrawal and _borrower param is not the msg.sender", async () => {
        await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
        await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: bob } })
        assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
        const balance = BigNumber.from((await lusdToken.balanceOf(ecosystemFund.address)).toString())
        const txPromise_A = borrowerOperations.callInternalAdjustLoan(alice, dec(1, 18), dec(1, 18), 0, true, alice, alice, { from: bob })
        await assertRevert(txPromise_A, "BorrowerOps: Caller must be the borrower for a withdrawal")
        const txPromise_B = borrowerOperations.callInternalAdjustLoan(bob, dec(1, 18), dec(1, 18), 0, true, alice, alice, { from: owner })
        await assertRevert(txPromise_B, "BorrowerOps: Caller must be the borrower for a withdrawal")
        const txPromise_C = borrowerOperations.callInternalAdjustLoan(carol, dec(1, 18), dec(1, 18), 0, true, alice, alice, { from: bob })
        await assertRevert(txPromise_C, "BorrowerOps: Caller must be the borrower for a withdrawal")
        assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), balance)
      })
    }

    // --- closeTrove() ---

    it("closeTrove(): reverts when it would lower the TCR below CCR", async () => {
      await openTrove({ ICR: toBN(dec(300, 16)), extraParams:{ from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await openTrove({ ICR: toBN(dec(120, 16)), extraLUSDAmount: toBN(dec(300, 18)), extraParams:{ from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      const price = await priceFeed.getPrice()
      
      // to compensate borrowing fees
      await lusdToken.transfer(alice, dec(300, 18), { from: bob })

      assert.isFalse(await troveManager.checkRecoveryMode(price))
    
      await assertRevert(
        borrowerOperations.closeTrove({ from: alice }),
        "BorrowerOps: An operation that would result in TCR < CCR is not permitted"
      )
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
    })

    it("closeTrove(): reverts when calling address does not have active trove", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      // Carol with no active trove attempts to close her trove
      try {
        const txCarol = await borrowerOperations.closeTrove({ from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("closeTrove(): reverts when system is in Recovery Mode", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(100000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
      assert.equal((await troveManager.Troves(carol)).frontEndTag, ZERO_ADDR)

      // Alice transfers her LUSD to Bob and Carol so they can cover fees
      const aliceBal = await lusdToken.balanceOf(alice)
      await lusdToken.transfer(bob, aliceBal.div(toBN(2)), { from: alice })
      await lusdToken.transfer(carol, aliceBal.div(toBN(2)), { from: alice })

      // check Recovery Mode 
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Bob successfully closes his trove
      const txBob = await borrowerOperations.closeTrove({ from: bob })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
      assert.isTrue(txBob.receipt.status)

      await priceFeed.setPrice(dec(100, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Carol attempts to close her trove during Recovery Mode
      await assertRevert(borrowerOperations.closeTrove({ from: carol }), "BorrowerOps: Operation not permitted during Recovery Mode")
      assert.equal((await troveManager.Troves(carol)).frontEndTag, ZERO_ADDR)
    })

    it("closeTrove(): reverts when trove is the only one in the system", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(100000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // Mint some tokens to Alice so she has enough to close her trove
      await lusdToken.unprotectedMint(alice, dec(100000, 18), {from: owner})

      // Check she has more LUSD than her trove debt
      const aliceBal = await lusdToken.balanceOf(alice)
      const aliceDebt = await getTroveEntireDebt(alice)
      assert.isTrue(aliceBal.gt(aliceDebt))

      // check Recovery Mode
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Alice attempts to close her trove
      await assertRevert(borrowerOperations.closeTrove({ from: alice }), "TroveManager: Only one trove in the system")
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
    })

    it("closeTrove(): reduces a Trove's collateral to zero", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      assert.equal((await troveManager.Troves(dennis)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const aliceCollBefore = await getTroveEntireColl(alice)
      const dennisLUSD = await lusdToken.balanceOf(dennis)
      assert.isTrue(aliceCollBefore.gt(toBN('0')))
      assert.isTrue(dennisLUSD.gt(toBN('0')))

      // To compensate borrowing fees
      await lusdToken.transfer(alice, dennisLUSD.div(toBN(2)), { from: dennis })

      // Alice attempts to close trove
      await borrowerOperations.closeTrove({ from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const aliceCollAfter = await getTroveEntireColl(alice)
      assert.equal(aliceCollAfter, '0')
    })

    it("closeTrove(): reduces a Trove's debt to zero", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      assert.equal((await troveManager.Troves(dennis)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const aliceDebtBefore = await getTroveEntireColl(alice)
      const dennisLUSD = await lusdToken.balanceOf(dennis)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(dennisLUSD.gt(toBN('0')))

      // To compensate borrowing fees
      await lusdToken.transfer(alice, dennisLUSD.div(toBN(2)), { from: dennis })

      // Alice attempts to close trove
      await borrowerOperations.closeTrove({ from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const aliceCollAfter = await getTroveEntireColl(alice)
      assert.equal(aliceCollAfter, '0')
    })

    it("closeTrove(): sets Trove's stake to zero", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      assert.equal((await troveManager.Troves(dennis)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const aliceStakeBefore = await getTroveStake(alice)
      assert.isTrue(aliceStakeBefore.gt(toBN('0')))

      const dennisLUSD = await lusdToken.balanceOf(dennis)
      assert.isTrue(aliceStakeBefore.gt(toBN('0')))
      assert.isTrue(dennisLUSD.gt(toBN('0')))

      // To compensate borrowing fees
      await lusdToken.transfer(alice, dennisLUSD.div(toBN(2)), { from: dennis })

      // Alice attempts to close trove
      await borrowerOperations.closeTrove({ from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const stakeAfter = ((await troveManager.Troves(alice))[2]).toString()
      assert.equal(stakeAfter, '0')
      // check withdrawal was successful
    })

    it("closeTrove(): zero's the troves reward snapshots", async () => {
      // Dennis opens trove and transfers tokens to alice
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      assert.equal((await troveManager.Troves(dennis)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Liquidate Bob
      await troveManager.liquidate(bob)
      assert.isFalse(await sortedTroves.contains(bob))

      // Price bounces back
      await priceFeed.setPrice(dec(200, 18))

      // Alice and Carol open troves
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
      assert.equal((await troveManager.Troves(carol)).frontEndTag, ZERO_ADDR)

      // Price drops ...again
      await priceFeed.setPrice(dec(100, 18))

      // Get Alice's pending reward snapshots 
      const L_ETH_A_Snapshot = (await troveManager.rewardSnapshots(alice))[0]
      const L_LUSDDebt_A_Snapshot = (await troveManager.rewardSnapshots(alice))[1]
      assert.isTrue(L_ETH_A_Snapshot.gt(toBN('0')))
      assert.isTrue(L_LUSDDebt_A_Snapshot.gt(toBN('0')))

      // Liquidate Carol
      await troveManager.liquidate(carol)
      assert.equal((await troveManager.Troves(carol)).frontEndTag, ZERO_ADDR)
      assert.isFalse(await sortedTroves.contains(carol))

      // Get Alice's pending reward snapshots after Carol's liquidation. Check above 0
      const L_ETH_Snapshot_A_AfterLiquidation = (await troveManager.rewardSnapshots(alice))[0]
      const L_LUSDDebt_Snapshot_A_AfterLiquidation = (await troveManager.rewardSnapshots(alice))[1]

      assert.isTrue(L_ETH_Snapshot_A_AfterLiquidation.gt(toBN('0')))
      assert.isTrue(L_LUSDDebt_Snapshot_A_AfterLiquidation.gt(toBN('0')))

      // to compensate borrowing fees
      await lusdToken.transfer(alice, await lusdToken.balanceOf(dennis), { from: dennis })

      await priceFeed.setPrice(dec(200, 18))

      // Alice closes trove
      await borrowerOperations.closeTrove({ from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // Check Alice's pending reward snapshots are zero
      const L_ETH_Snapshot_A_afterAliceCloses = (await troveManager.rewardSnapshots(alice))[0]
      const L_LUSDDebt_Snapshot_A_afterAliceCloses = (await troveManager.rewardSnapshots(alice))[1]

      assert.equal(L_ETH_Snapshot_A_afterAliceCloses, '0')
      assert.equal(L_LUSDDebt_Snapshot_A_afterAliceCloses, '0')
    })

    it("closeTrove(): sets trove's status to closed and removes it from sorted troves list", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      assert.equal((await troveManager.Troves(dennis)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // Check Trove is active
      const alice_Trove_Before = await troveManager.Troves(alice)
      const status_Before = alice_Trove_Before[3]

      assert.equal(status_Before, 1)
      assert.isTrue(await sortedTroves.contains(alice))

      // to compensate borrowing fees
      await lusdToken.transfer(alice, await lusdToken.balanceOf(dennis), { from: dennis })

      // Close the trove
      await borrowerOperations.closeTrove({ from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const alice_Trove_After = await troveManager.Troves(alice)
      const status_After = alice_Trove_After[3]

      assert.equal(status_After, 2)
      assert.isFalse(await sortedTroves.contains(alice))
    })

    it("closeTrove(): reduces ActivePool ETH and raw ether by correct amount", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      assert.equal((await troveManager.Troves(dennis)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const dennisColl = await getTroveEntireColl(dennis)
      const aliceColl = await getTroveEntireColl(alice)
      assert.isTrue(dennisColl.gt('0'))
      assert.isTrue(aliceColl.gt('0'))

      // Check active Pool ETH before
      const activePool_ETH_before = await activePool.getETH()
      const activePool_RawEther_before = await weth.balanceOf(activePool.address)
      assert.isTrue(activePool_ETH_before.eq(aliceColl.add(dennisColl)))
      assert.isTrue(activePool_ETH_before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_before.eq(activePool_ETH_before))

      // to compensate borrowing fees
      await lusdToken.transfer(alice, await lusdToken.balanceOf(dennis), { from: dennis })

      // Close the trove
      await borrowerOperations.closeTrove({ from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // Check after
      const activePool_ETH_After = await activePool.getETH()
      const activePool_RawEther_After = await weth.balanceOf(activePool.address)
      assert.isTrue(activePool_ETH_After.eq(dennisColl))
      assert.isTrue(activePool_RawEther_After.eq(dennisColl))
    })

    it("closeTrove(): reduces ActivePool debt by correct amount", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      assert.equal((await troveManager.Troves(dennis)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const dennisDebt = await getTroveEntireDebt(dennis)
      const aliceDebt = await getTroveEntireDebt(alice)
      assert.isTrue(dennisDebt.gt('0'))
      assert.isTrue(aliceDebt.gt('0'))

      // Check before
      const activePool_Debt_before = await activePool.getLUSDDebt()
      assert.isTrue(activePool_Debt_before.eq(aliceDebt.add(dennisDebt)))
      assert.isTrue(activePool_Debt_before.gt(toBN('0')))

      // to compensate borrowing fees
      await lusdToken.transfer(alice, await lusdToken.balanceOf(dennis), { from: dennis })

      // Close the trove
      await borrowerOperations.closeTrove({ from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // Check after
      const activePool_Debt_After = (await activePool.getLUSDDebt()).toString()
      th.assertIsApproximatelyEqual(activePool_Debt_After, dennisDebt)
    })

    it("closeTrove(): updates the the total stakes", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      assert.equal((await troveManager.Troves(dennis)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      // Get individual stakes
      const aliceStakeBefore = await getTroveStake(alice)
      const bobStakeBefore = await getTroveStake(bob)
      const dennisStakeBefore = await getTroveStake(dennis)
      assert.isTrue(aliceStakeBefore.gt('0'))
      assert.isTrue(bobStakeBefore.gt('0'))
      assert.isTrue(dennisStakeBefore.gt('0'))

      const totalStakesBefore = await troveManager.totalStakes()

      assert.isTrue(totalStakesBefore.eq(aliceStakeBefore.add(bobStakeBefore).add(dennisStakeBefore)))

      // to compensate borrowing fees
      await lusdToken.transfer(alice, await lusdToken.balanceOf(dennis), { from: dennis })

      // Alice closes trove
      await borrowerOperations.closeTrove({ from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // Check stake and total stakes get updated
      const aliceStakeAfter = await getTroveStake(alice)
      const totalStakesAfter = await troveManager.totalStakes()

      assert.equal(aliceStakeAfter, 0)
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.sub(aliceStakeBefore)))
    })

    if (!withProxy) { // TODO: wrap web3.eth.getBalance to be able to go through proxies
      it("closeTrove(): sends the correct amount of ETH to the user", async () => {
        await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
        assert.equal((await troveManager.Troves(dennis)).frontEndTag, ZERO_ADDR)
        await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
        assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

        const aliceColl = await getTroveEntireColl(alice)
        assert.isTrue(aliceColl.gt(toBN('0')))

        const alice_ETHBalance_Before = await weth.balanceOf(alice)

        // to compensate borrowing fees
        await lusdToken.transfer(alice, await lusdToken.balanceOf(dennis), { from: dennis })

        await borrowerOperations.closeTrove({ from: alice, gasPrice: 0 })
        assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

        const alice_ETHBalance_After = await weth.balanceOf(alice)
        const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

        assert.isTrue(balanceDiff.eq(aliceColl))
      })
    }

    it("closeTrove(): subtracts the debt of the closed Trove from the Borrower's LUSDToken balance", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      assert.equal((await troveManager.Troves(dennis)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const aliceDebt = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebt.gt(toBN('0')))

      // to compensate borrowing fees
      await lusdToken.transfer(alice, await lusdToken.balanceOf(dennis), { from: dennis })

      const alice_LUSDBalance_Before = await lusdToken.balanceOf(alice)
      assert.isTrue(alice_LUSDBalance_Before.gt(toBN('0')))

      // close trove
      await borrowerOperations.closeTrove({ from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // check alice LUSD balance after
      const alice_LUSDBalance_After = await lusdToken.balanceOf(alice)
      th.assertIsApproximatelyEqual(alice_LUSDBalance_After, alice_LUSDBalance_Before.sub(aliceDebt.sub(LUSD_GAS_COMPENSATION)))
    })

    it("closeTrove(): applies pending rewards", async () => {
      // --- SETUP ---
      await openTrove({ extraLUSDAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)

      const whaleDebt = await getTroveEntireDebt(whale)
      const whaleColl = await getTroveEntireColl(whale)

      await openTrove({ extraLUSDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
      assert.equal((await troveManager.Troves(carol)).frontEndTag, ZERO_ADDR)

      const carolDebt = await getTroveEntireDebt(carol)
      const carolColl = await getTroveEntireColl(carol)

      // Whale transfers to A and B to cover their fees
      await lusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await lusdToken.transfer(bob, dec(10000, 18), { from: whale })

      // --- TEST ---

      // price drops to 1ETH:100LUSD, reducing Carol's ICR below MCR
      await priceFeed.setPrice(dec(100, 18));
      const price = await priceFeed.getPrice()

      // liquidate Carol's Trove, Alice and Bob earn rewards.
      const liquidationTx = await troveManager.liquidate(carol, { from: owner });
      const [liquidatedDebt_C, liquidatedColl_C, gasComp_C] = th.getEmittedLiquidationValues(liquidationTx)

      // Dennis opens a new Trove 
      await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
      assert.equal((await troveManager.Troves(carol)).frontEndTag, ZERO_ADDR)

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(alice)
      const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
      const alice_LUSDDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

      const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bob)
      const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
      const bob_LUSDDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_LUSDDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_LUSDDebtRewardSnapshot_Before, 0)

      const defaultPool_ETH = await defaultPool.getETH()
      const defaultPool_LUSDDebt = await defaultPool.getLUSDDebt()

      // Carol's liquidated coll (1 ETH) and drawn debt should have entered the Default Pool
      assert.isAtMost(th.getDifference(defaultPool_ETH, liquidatedColl_C), 100)
      assert.isAtMost(th.getDifference(defaultPool_LUSDDebt, liquidatedDebt_C), 100)

      const pendingCollReward_A = await troveManager.getPendingETHReward(alice)
      const pendingDebtReward_A = await troveManager.getPendingLUSDDebtReward(alice)
      assert.isTrue(pendingCollReward_A.gt('0'))
      assert.isTrue(pendingDebtReward_A.gt('0'))

      // Close Alice's trove. Alice's pending rewards should be removed from the DefaultPool when she close.
      await borrowerOperations.closeTrove({ from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      const defaultPool_ETH_afterAliceCloses = await defaultPool.getETH()
      const defaultPool_LUSDDebt_afterAliceCloses = await defaultPool.getLUSDDebt()

      assert.isAtMost(th.getDifference(defaultPool_ETH_afterAliceCloses,
        defaultPool_ETH.sub(pendingCollReward_A)), 1000)
      assert.isAtMost(th.getDifference(defaultPool_LUSDDebt_afterAliceCloses,
        defaultPool_LUSDDebt.sub(pendingDebtReward_A)), 1000)

      // whale adjusts trove, pulling their rewards out of DefaultPool
      await borrowerOperations.adjustTrove(th._100pct, 0, dec(1, 18), 0, true, whale, whale, { from: whale })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)

      // Close Bob's trove. Expect DefaultPool coll and debt to drop to 0, since closing pulls his rewards out.
      await borrowerOperations.closeTrove({ from: bob })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)

      const defaultPool_ETH_afterBobCloses = await defaultPool.getETH()
      const defaultPool_LUSDDebt_afterBobCloses = await defaultPool.getLUSDDebt()

      assert.isAtMost(th.getDifference(defaultPool_ETH_afterBobCloses, 0), 100000)
      assert.isAtMost(th.getDifference(defaultPool_LUSDDebt_afterBobCloses, 0), 100000)
    })

    it("closeTrove(): reverts if borrower has insufficient LUSD balance to repay his entire debt", async () => {
      await openTrove({ extraLUSDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)

      //Confirm Bob's LUSD balance is less than his trove debt
      const B_LUSDBal = await lusdToken.balanceOf(B)
      const B_troveDebt = await getTroveEntireDebt(B)

      assert.isTrue(B_LUSDBal.lt(B_troveDebt))

      const closeTrovePromise_B = borrowerOperations.closeTrove({ from: B })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)

      // Check closing trove reverts
      await assertRevert(closeTrovePromise_B, "BorrowerOps: Caller doesnt have enough LUSD to make repayment")
    })

    // --- openTrove() ---

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("openTrove(): emits a TroveUpdated event with the correct collateral and debt", async () => {
        const txA = (await openTrove({ extraLUSDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })).tx
        assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
        const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA))
        assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.toString())
        
        const txB = (await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })).tx
        assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
        const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB))
        assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txBFeeBN.add(txAFeeBN).toString())
        
        const txC = (await openTrove({ extraLUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })).tx
        assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
        const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC))
        assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txCFeeBN.add(txBFeeBN).add(txAFeeBN).toString())

        const A_Coll = await getTroveEntireColl(A)
        const B_Coll = await getTroveEntireColl(B)
        const C_Coll = await getTroveEntireColl(C)
        const A_Debt = await getTroveEntireDebt(A)
        const B_Debt = await getTroveEntireDebt(B)
        const C_Debt = await getTroveEntireDebt(C)

        const A_emittedDebt = toBN(th.getEventArgByName(txA, "TroveUpdated", "_debt"))
        const A_emittedColl = toBN(th.getEventArgByName(txA, "TroveUpdated", "_coll"))
        const B_emittedDebt = toBN(th.getEventArgByName(txB, "TroveUpdated", "_debt"))
        const B_emittedColl = toBN(th.getEventArgByName(txB, "TroveUpdated", "_coll"))
        const C_emittedDebt = toBN(th.getEventArgByName(txC, "TroveUpdated", "_debt"))
        const C_emittedColl = toBN(th.getEventArgByName(txC, "TroveUpdated", "_coll"))

        // Check emitted debt values are correct
        assert.isTrue(A_Debt.eq(A_emittedDebt))
        assert.isTrue(B_Debt.eq(B_emittedDebt))
        assert.isTrue(C_Debt.eq(C_emittedDebt))

        // Check emitted coll values are correct
        assert.isTrue(A_Coll.eq(A_emittedColl))
        assert.isTrue(B_Coll.eq(B_emittedColl))
        assert.isTrue(C_Coll.eq(C_emittedColl))

        const baseRateBefore = await troveManager.baseRate()

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow()

        assert.isTrue((await troveManager.baseRate()).gt(baseRateBefore))

        const txD = (await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })).tx
        assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
        const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD))
        assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txCFeeBN.add(txBFeeBN).add(txAFeeBN).add(txDFeeBN).toString())

        const txE = (await openTrove({ extraLUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })).tx
        assert.equal((await troveManager.Troves(E)).frontEndTag, ZERO_ADDR)
        const txEFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txE))
        assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txEFeeBN.add(txDFeeBN).add(txCFeeBN).add(txBFeeBN).add(txAFeeBN).toString())

        const D_Coll = await getTroveEntireColl(D)
        const E_Coll = await getTroveEntireColl(E)
        const D_Debt = await getTroveEntireDebt(D)
        const E_Debt = await getTroveEntireDebt(E)

        const D_emittedDebt = toBN(th.getEventArgByName(txD, "TroveUpdated", "_debt"))
        const D_emittedColl = toBN(th.getEventArgByName(txD, "TroveUpdated", "_coll"))

        const E_emittedDebt = toBN(th.getEventArgByName(txE, "TroveUpdated", "_debt"))
        const E_emittedColl = toBN(th.getEventArgByName(txE, "TroveUpdated", "_coll"))

        // Check emitted debt values are correct
        assert.isTrue(D_Debt.eq(D_emittedDebt))
        assert.isTrue(E_Debt.eq(E_emittedDebt))

        // Check emitted coll values are correct
        assert.isTrue(D_Coll.eq(D_emittedColl))
        assert.isTrue(E_Coll.eq(E_emittedColl))
      })
    }

    it("openTrove(): Opens a trove with net debt >= minimum net debt", async () => {
      // Add 1 wei to correct for rounding error in helper function
      await weth.deposit({from: A, value: dec(100, 30)})
      await weth.approve(borrowerOperations.address, dec(100, 30) , { from: A })
      const txA = await borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(1))), dec(100, 30), A, A, ZERO_ADDR, { from: A })
      assert.isTrue(txA.receipt.status)
      assert.isTrue(await sortedTroves.contains(A))
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.toString())

      await weth.deposit({ from: C, value: dec(100, 30) })
      await weth.approve(borrowerOperations.address, dec(100, 30), { from: C })
      const txC = await borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(dec(47789898, 22)))), dec(100, 30), A, A, ZERO_ADDR, { from: C })
      assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txCFeeBN.add(txAFeeBN).toString())

      assert.isTrue(txC.receipt.status)
      assert.isTrue(await sortedTroves.contains(C))
    })

    it("openTrove(): reverts if net debt < minimum net debt", async () => {
      await weth.deposit({ from: A, value: dec(100, 30) })
      await weth.approve(borrowerOperations.address, dec(100, 30), { from: A })
      const txAPromise = borrowerOperations.openTrove(th._100pct, 0, dec(100, 30), A, A, ZERO_ADDR, { from: A })
      await assertRevert(txAPromise, "revert")
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), '0')

      await weth.deposit({ from: B, value: dec(100, 30) })
      await weth.approve(borrowerOperations.address, dec(100, 30), { from: B })
      const txBPromise = borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.sub(toBN(1))), dec(100, 30), B, B, ZERO_ADDR, { from: B  })
      await assertRevert(txBPromise, "revert")
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), '0')
      
      await weth.deposit({ from: C, value: dec(100, 30) })
      await weth.approve(borrowerOperations.address, dec(100, 30), { from: C })
      const txCPromise = borrowerOperations.openTrove(th._100pct, MIN_NET_DEBT.sub(toBN(dec(173, 18))), dec(100, 30), C, C, ZERO_ADDR, { from: C })
      await assertRevert(txCPromise, "revert")
      assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), '0')
    })

    it("openTrove(): decays a non-zero base rate", async () => {
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.toString())

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txAFeeBN).toString())

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txBFeeBN).add(txAFeeBN).toString())

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txCFeeBN).add(txBFeeBN).add(txAFeeBN).toString())

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      const txD = await openTrove({ extraLUSDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txCFeeBN).add(txBFeeBN).add(txAFeeBN).add(txDFeeBN).toString())
      
      // Check baseRate has decreased
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens trove 
      const txE = await openTrove({ extraLUSDAmount: toBN(dec(12, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      assert.equal((await troveManager.Troves(E)).frontEndTag, ZERO_ADDR)
      const txEFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txE.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txCFeeBN).add(txBFeeBN).add(txAFeeBN).add(txDFeeBN).add(txEFeeBN).toString())

      const baseRate_3 = await troveManager.baseRate()
      assert.isTrue(baseRate_3.lt(baseRate_2))
    })

    it("openTrove(): doesn't change base rate if it is already zero", async () => {
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.toString())

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txAFeeBN).toString())

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txBFeeBN).add(txAFeeBN).toString())

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txCFeeBN).add(txBFeeBN).add(txAFeeBN).toString())

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      const txD = await openTrove({ extraLUSDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txCFeeBN).add(txBFeeBN).add(txAFeeBN).add(txDFeeBN).toString())

      // Check baseRate is still 0
      const baseRate_2 = await troveManager.baseRate()
      assert.equal(baseRate_2, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens trove 
      const txE = await openTrove({ extraLUSDAmount: toBN(dec(12, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      assert.equal((await troveManager.Troves(E)).frontEndTag, ZERO_ADDR)
      const txEFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txE.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txCFeeBN).add(txBFeeBN).add(txAFeeBN).add(txDFeeBN).add(txEFeeBN).toString())
      const baseRate_3 = await troveManager.baseRate()
      assert.equal(baseRate_3, '0')
    })

    it("openTrove(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.toString())

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txAFeeBN).toString())

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txAFeeBN).add(txBFeeBN).toString())

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txAFeeBN).add(txBFeeBN).add(txCFeeBN).toString())

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime()

      // Borrower D triggers a fee
      const txD = await openTrove({ extraLUSDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txAFeeBN).add(txBFeeBN).add(txCFeeBN).add(txDFeeBN).toString())

      const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

      // 1 minute passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(3600))

      // Borrower E triggers a fee
      const txE = await openTrove({ extraLUSDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      assert.equal((await troveManager.Troves(E)).frontEndTag, ZERO_ADDR)
      const txEFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txE.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txAFeeBN).add(txBFeeBN).add(txCFeeBN).add(txDFeeBN).add(txEFeeBN).toString())
      
      const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime()

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
    })

    it("openTrove(): reverts if max fee > 100%", async () => {
      await weth.deposit({ from: A, value: dec(100, 'ether') })
      await weth.approve(borrowerOperations.address, dec(100, 'ether'), { from: A })
      await assertRevert(borrowerOperations.openTrove(dec(2, 18), dec(10000, 18), dec(100, 'ether'),  A, A, ZERO_ADDR, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), '0')

      await weth.deposit({ from: B, value: dec(100, 'ether') })
      await weth.approve(borrowerOperations.address, dec(100, 'ether'), { from: B })
      await assertRevert(borrowerOperations.openTrove('1000000000000000001', dec(20000, 18), dec(100, 'ether'), B, B, ZERO_ADDR, { from: B }), "Max fee percentage must be between 0.5% and 100%")
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), '0')
    })

    it("openTrove(): reverts if max fee < 0.5% in Normal mode", async () => {
      await weth.deposit({ from: A, value: dec(2200, 'ether') })
      await weth.approve(borrowerOperations.address, dec(2200, 'ether'), { from: A })
      await assertRevert(borrowerOperations.openTrove(0, dec(195000, 18), dec(2200, 'ether'), A, A, ZERO_ADDR, { from: A}), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.openTrove(1, dec(195000, 18), dec(2200, 'ether'), A, A, ZERO_ADDR, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), '0')
      
      await weth.deposit({ from: B, value: dec(1200, 'ether') })
      await weth.approve(borrowerOperations.address, dec(1200, 'ether'), { from: B })
      await assertRevert(borrowerOperations.openTrove('4999999999999999', dec(195000, 18), dec(1200, 'ether'), B, B, ZERO_ADDR, { from: B }), "Max fee percentage must be between 0.5% and 100%")
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(),'0')
    })

    it("openTrove(): allows max fee < 0.5% in Recovery Mode", async () => {
      await weth.deposit({ from: A, value: dec(2000, 'ether') })
      await weth.approve(borrowerOperations.address, dec(2000, 'ether'), { from: A })
      const txA = await borrowerOperations.openTrove(th._100pct, dec(195000, 18), dec(2000, 'ether'), A, A, ZERO_ADDR, { from: A })
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.toString())

      await priceFeed.setPrice(dec(100, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))

      await weth.deposit({ from: B, value: dec(3100, 'ether') })
      await weth.approve(borrowerOperations.address, dec(3100, 'ether'), { from: B })
      const txB = await borrowerOperations.openTrove(0, dec(19500, 18), dec(3100, 'ether'), B, B, ZERO_ADDR, { from: B})
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txBFeeBN.add(txAFeeBN).toString())

      await priceFeed.setPrice(dec(50, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      await weth.deposit({ from: C, value: dec(3100, 'ether') })
      await weth.approve(borrowerOperations.address, dec(3100, 'ether'), { from: C })
      const txC = await borrowerOperations.openTrove(1, dec(19500, 18), dec(3100, 'ether'), C, C, ZERO_ADDR, { from: C })
      assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txCFeeBN.add(txBFeeBN).add(txAFeeBN).toString())

      await priceFeed.setPrice(dec(25, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts))
      await weth.deposit({ from: D, value: dec(3100, 'ether') })
      await weth.approve(borrowerOperations.address, dec(3100, 'ether'), { from: D })
      const txD = await borrowerOperations.openTrove('4999999999999999', dec(19500, 18), dec(3100, 'ether'), D, D, ZERO_ADDR, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(txDFeeBN).toString())
    })

    it("openTrove(): reverts if fee exceeds max fee percentage", async () => {
      const txA = await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.toString())

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).toString())

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).toString())

      const totalSupply = await lusdToken.totalSupply()

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      //       actual fee percentage: 0.005000000186264514
      // user's max fee percentage:  0.0049999999999999999
      let borrowingRate = await troveManager.getBorrowingRate() // expect max(0.5 + 5%, 5%) rate
      assert.equal(borrowingRate, dec(5, 16))

      await weth.deposit({ from: D, value: dec(4000, 'ether') })
      await weth.approve(borrowerOperations.address, dec(4000, 'ether'), { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)

      const lessThan5pct = '49999999999999999'
      await assertRevert(borrowerOperations.openTrove(lessThan5pct, dec(30000, 18), dec(1000, 'ether'), A, A, ZERO_ADDR, { from: D }), "Fee exceeded provided maximum")
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).toString())

      borrowingRate = await troveManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))
      // Attempt with maxFee 1%
      await assertRevert(borrowerOperations.openTrove(dec(1, 16), dec(30000, 18), dec(1000, 'ether'), A, A, ZERO_ADDR, { from: D }), "Fee exceeded provided maximum")
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).toString())

      borrowingRate = await troveManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))
      // Attempt with maxFee 3.754%
      await assertRevert(borrowerOperations.openTrove(dec(3754, 13), dec(30000, 18),  dec(1000, 'ether'), A, A, ZERO_ADDR, { from: D }), "Fee exceeded provided maximum")
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).toString())

      borrowingRate = await troveManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))
      // Attempt with maxFee 1e-16%
      await assertRevert(borrowerOperations.openTrove(dec(5, 15), dec(30000, 18), dec(1000, 'ether'),  A, A, ZERO_ADDR, { from: D }), "Fee exceeded provided maximum")
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).toString())
    })

    it("openTrove(): succeeds when fee is less than max fee percentage", async () => {
      const txA = await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.toString())

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).toString())

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).toString())

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      let borrowingRate = await troveManager.getBorrowingRate() // expect min(0.5 + 5%, 5%) rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee > 5%
      const moreThan5pct = '50000000000000001'
      await weth.deposit({ from: D, value: dec(100, 'ether') })
      await weth.approve(borrowerOperations.address, dec(100, 'ether'), { from: D })
      const tx1 = await borrowerOperations.openTrove(moreThan5pct, dec(10000, 18), dec(100, 'ether'), A, A, ZERO_ADDR, { from: D })
      assert.isTrue(tx1.receipt.status)
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      const tx1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx1))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(tx1FeeBN).toString())

      borrowingRate = await troveManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee = 5%
      await weth.deposit({ from: H, value: dec(100, 'ether') })
      await weth.approve(borrowerOperations.address, dec(100, 'ether'), { from: H })
      const tx2 = await borrowerOperations.openTrove(dec(5, 16), dec(10000, 18), dec(100, 'ether'), A, A, ZERO_ADDR, { from: H })
      assert.isTrue(tx2.receipt.status)
      assert.equal((await troveManager.Troves(H)).frontEndTag, ZERO_ADDR)
      const tx2FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx2))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(tx1FeeBN).add(tx2FeeBN).toString())

      borrowingRate = await troveManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee 10%
      await weth.deposit({ from: E, value: dec(100, 'ether') })
      await weth.approve(borrowerOperations.address, dec(100, 'ether'), { from: E })
      const tx3 = await borrowerOperations.openTrove(dec(1, 17), dec(10000, 18), dec(100, 'ether') , A, A, ZERO_ADDR, { from: E })
      assert.equal((await troveManager.Troves(E)).frontEndTag, ZERO_ADDR)
      assert.isTrue(tx3.receipt.status)
      const tx3FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx3))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(tx1FeeBN).add(tx2FeeBN).add(tx3FeeBN).toString())

      borrowingRate = await troveManager.getBorrowingRate() // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee 37.659%
      await weth.deposit({ from: F, value: dec(100, 'ether') })
      await weth.approve(borrowerOperations.address, dec(100, 'ether'), { from: F })
      const tx4 = await borrowerOperations.openTrove(dec(37659, 13), dec(10000, 18), dec(100, 'ether'), A, A, ZERO_ADDR, { from: F })
      assert.isTrue(tx4.receipt.status)
      assert.equal((await troveManager.Troves(F)).frontEndTag, ZERO_ADDR)
      const tx4FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx4))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(tx1FeeBN).add(tx2FeeBN).add(tx3FeeBN).add(tx4FeeBN).toString())

      // Attempt with maxFee 100%
      await weth.deposit({ from: G, value: dec(100, 'ether') })
      await weth.approve(borrowerOperations.address, dec(100, 'ether'), { from: G })
      const tx5 = await borrowerOperations.openTrove(dec(1, 18), dec(10000, 18), dec(100, 'ether'), A, A, ZERO_ADDR, { from: G })
      assert.equal((await troveManager.Troves(G)).frontEndTag, ZERO_ADDR)
      assert.isTrue(tx5.receipt.status)
      const tx5FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(tx5))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(tx1FeeBN).add(tx2FeeBN).add(tx3FeeBN).add(tx4FeeBN).add(tx5FeeBN).toString())
    })

    it("openTrove(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.toString())

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.add(txAFeeBN).toString())

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txWhaleFeeBN).toString())
      
      const txC = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(txWhaleFeeBN).toString())

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 59 minutes pass
      th.fastForwardTime(3540, web3.currentProvider)

      // Assume Borrower also owns accounts D and E
      // Borrower triggers a fee, before decay interval has passed
      const txD = await openTrove({ extraLUSDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(txDFeeBN).add(txWhaleFeeBN).toString())

      // 1 minute pass
      th.fastForwardTime(3540, web3.currentProvider)

      // Borrower triggers another fee
      const txE = await openTrove({ extraLUSDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      assert.equal((await troveManager.Troves(E)).frontEndTag, ZERO_ADDR)
      const txEFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txE.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(txEFeeBN).add(txDFeeBN).add(txWhaleFeeBN).toString())

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await troveManager.baseRate()
      assert.isTrue(baseRate_2.lt(baseRate_1))
    })

    it("openTrove(): borrowing at non-zero base rate sends LUSD fee to LQTY staking contract", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 LQTY
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: multisig })
      await lqtyStaking.stake(dec(1, 18), { from: multisig })

      // Check LQTY LUSD balance before == 0
      const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
      assert.equal(lqtyStaking_LUSDBalance_Before, '0')

      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.toString())

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txWhaleFeeBN).toString())

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txWhaleFeeBN).toString())
      
      const txC = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(txWhaleFeeBN).toString())

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      const txD = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(txDFeeBN).add(txWhaleFeeBN).toString())

      // Check LQTY LUSD balance after has increased
      const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
      assert.isTrue(lqtyStaking_LUSDBalance_After.eq(lqtyStaking_LUSDBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("openTrove(): borrowing at non-zero base records the (drawn debt + fee  + liq. reserve) on the Trove struct", async () => {
        // time fast-forwards 1 year, and multisig stakes 1 LQTY
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
        await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: multisig })
        await lqtyStaking.stake(dec(1, 18), { from: multisig })

        const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
        const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
        assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.toString())

        const txA = await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
        const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
        assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txWhaleFeeBN).toString())

        const txB = await openTrove({ extraLUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
        const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
        assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txWhaleFeeBN).toString())

        const txC = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
        assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
        const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
        assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(txWhaleFeeBN).toString())

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow()

        // Check baseRate is now non-zero
        const baseRate_1 = await troveManager.baseRate()
        assert.isTrue(baseRate_1.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        const D_LUSDRequest = toBN(dec(20000, 18))

        // D withdraws LUSD
        await weth.deposit({ from: D, value: dec(200, 'ether') })
        await weth.approve(borrowerOperations.address, dec(200, 'ether'), { from: D })
        const openTroveTx = await borrowerOperations.openTrove(th._100pct, D_LUSDRequest, dec(200, 'ether'), ZERO_ADDR, ZERO_ADDR, ZERO_ADDR, { from: D })
        assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
        const tx1FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(openTroveTx))
        assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(txWhaleFeeBN).add(tx1FeeBN).toString())

        const emittedFee = toBN(th.getLUSDFeeFromLUSDBorrowingEvent(openTroveTx))
        assert.isTrue(toBN(emittedFee).gt(toBN('0')))

        const newDebt = (await troveManager.Troves(D))[0]

        // Check debt on Trove struct equals drawn debt plus emitted fee
        th.assertIsApproximatelyEqual(newDebt, D_LUSDRequest.add(emittedFee).add(LUSD_GAS_COMPENSATION), 100000)
      })
    }

    it("openTrove(): Borrowing at non-zero base rate increases the LQTY staking contract LUSD fees-per-unit-staked", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 LQTY
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: multisig })
      await lqtyStaking.stake(dec(1, 18), { from: multisig })

      // Check LQTY contract LUSD fees-per-unit-staked is zero
      const F_LUSD_Before = await lqtyStaking.F_LUSD()
      assert.equal(F_LUSD_Before, '0')

      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.toString())

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txWhaleFeeBN).toString())

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txWhaleFeeBN).toString())
      
      const txC = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(txWhaleFeeBN).toString())

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      const txD = await openTrove({ extraLUSDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(txWhaleFeeBN).add(txDFeeBN).toString())

      // Check LQTY contract LUSD fees-per-unit-staked has increased
      const F_LUSD_After = await lqtyStaking.F_LUSD()
      assert.isTrue(F_LUSD_After.eq(F_LUSD_Before))
    })

    it("openTrove(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 LQTY
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await lqtyToken.approve(lqtyStaking.address, dec(1, 18), { from: multisig })
      await lqtyStaking.stake(dec(1, 18), { from: multisig })

      // Check LQTY Staking contract balance before == 0
      const lqtyStaking_LUSDBalance_Before = await lusdToken.balanceOf(lqtyStaking.address)
      assert.equal(lqtyStaking_LUSDBalance_Before, '0')

      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.toString())

      const txA = await openTrove({ extraLUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txWhaleFeeBN).toString())

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txWhaleFeeBN).toString())

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(txWhaleFeeBN).toString())

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow()

      // Check baseRate is non-zero
      const baseRate_1 = await troveManager.baseRate()
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      const LUSDRequest_D = toBN(dec(40000, 18))
      await weth.deposit({from: D, value: dec(500, 'ether')})
      await weth.approve(borrowerOperations.address, dec(500, 'ether'), { from: D })
      const txD = await borrowerOperations.openTrove(th._100pct, LUSDRequest_D, dec(500, 'ether'), D, D, ZERO_ADDR, { from: D })
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(txDFeeBN).add(txWhaleFeeBN).toString())

      // Check LQTY staking LUSD balance has increased
      const lqtyStaking_LUSDBalance_After = await lusdToken.balanceOf(lqtyStaking.address)
      assert.isTrue(lqtyStaking_LUSDBalance_After.eq(lqtyStaking_LUSDBalance_Before))

      // Check D's LUSD balance now equals their requested LUSD
      const LUSDBalance_D = await lusdToken.balanceOf(D)
      assert.isTrue(LUSDRequest_D.eq(LUSDBalance_D))
    })

    it("openTrove(): Borrowing at zero base rate changes the LQTY staking contract LUSD fees-per-unit-staked", async () => {
      const txA = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.toString())

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).toString())

      const txC = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).toString())

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate()
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // Check LUSD reward per LQTY staked == 0
      const F_LUSD_Before = await lqtyStaking.F_LUSD()
      assert.equal(F_LUSD_Before, '0')

      // A stakes LQTY
      await lqtyToken.unprotectedMint(A, dec(100, 18))
      await lqtyStaking.stake(dec(100, 18), { from: A })

      // D opens trove 
      const txD = await openTrove({ extraLUSDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      assert.equal((await troveManager.Troves(D)).frontEndTag, ZERO_ADDR)
      const txDFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txD.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).add(txDFeeBN).toString())

      // Check LUSD reward per LQTY staked > 0
      const F_LUSD_After = await lqtyStaking.F_LUSD()
      assert.isTrue(F_LUSD_After.eq(toBN('0')))
    })

    it("openTrove(): Borrowing at zero base rate charges minimum fee", async () => {
      const txA = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      assert.equal((await troveManager.Troves(A)).frontEndTag, ZERO_ADDR)
      const txAFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txA.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.toString())

      const txB = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      assert.equal((await troveManager.Troves(B)).frontEndTag, ZERO_ADDR)
      const txBFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txB.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).toString())

      const LUSDRequest = toBN(dec(10000, 18))
      await weth.deposit({from: C, value: dec(100, 'ether')})
      await weth.approve(borrowerOperations.address, dec(100, 'ether'), { from: C })
      const txC = await borrowerOperations.openTrove(th._100pct, LUSDRequest, dec(100, 'ether'), ZERO_ADDR, ZERO_ADDR, ZERO_ADDR, { from: C })
      assert.equal((await troveManager.Troves(C)).frontEndTag, ZERO_ADDR)
      const _LUSDFee = toBN(th.getEventArgByName(txC, "LUSDBorrowingFeePaid", "_LUSDFee"))
      const txCFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txC))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAFeeBN.add(txBFeeBN).add(txCFeeBN).toString())

      const expectedFee = BORROWING_FEE_FLOOR.mul(toBN(LUSDRequest)).div(toBN(dec(1, 18)))
      assert.isTrue(_LUSDFee.eq(expectedFee))
    })

    it("openTrove(): reverts when system is in Recovery Mode and ICR < CCR", async () => {
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.toString())

      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      assert.isFalse(await th.checkRecoveryMode(contracts))
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.add(txWhaleFeeBN).toString())

      // price drops, and Recovery Mode kicks in
      await priceFeed.setPrice(dec(105, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Bob tries to open a trove with 149% ICR during Recovery Mode
      try {
        const txBob = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(149, 16)), extraParams: { from: alice } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.add(txWhaleFeeBN).toString())
    })

    it("openTrove(): reverts when trove ICR < MCR", async () => {
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.toString())

      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.add(txWhaleFeeBN).toString())

      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Bob attempts to open a 109% ICR trove in Normal Mode
      try {
        const txBob = (await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(109, 16)), extraParams: { from: bob } })).tx
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.add(txWhaleFeeBN).toString())

      // price drops, and Recovery Mode kicks in
      await priceFeed.setPrice(dec(105, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Bob attempts to open a 109% ICR trove in Recovery Mode
      try {
        const txBob = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(109, 16)), extraParams: { from: bob } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.add(txWhaleFeeBN).toString())
    })

    it("openTrove(): reverts when opening the trove would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18))

      // Alice creates trove with 150% ICR.  System TCR = 150%.
      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.toString())

      const TCR = await th.getTCR(contracts)
      assert.equal(TCR, dec(150, 16))

      // Bob attempts to open a trove with ICR = 149% 
      // System TCR would fall below 150%
      try {
        const txBob = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(149, 16)), extraParams: { from: bob } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.toString())
    })

    it("openTrove(): reverts if trove is already active", async () => {
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.toString())

      const txAlice=  await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.add(txWhaleFeeBN).toString())

      const txBob = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
      const txBobFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txBob.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txBobFeeBN.add(txWhaleFeeBN).add(txAliceFeeBN).toString())


      try {
        const txB_1 = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: bob } })
        assert.isFalse(txB_1.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txBobFeeBN.add(txWhaleFeeBN).add(txAliceFeeBN).toString())
      try {
        const txB_2 = await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
        assert.isFalse(txB_2.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txBobFeeBN.add(txWhaleFeeBN).add(txAliceFeeBN).toString())
    })

    it("openTrove(): Can open a trove with ICR >= CCR when system is in Recovery Mode", async () => {
      // --- SETUP ---
      //  Alice and Bob add coll and withdraw such  that the TCR is ~150%
      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.toString())
      
      const txBob = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
      const txBobFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txBob.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.add(txBobFeeBN).toString())

      const TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')

      // price drops to 1ETH:100LUSD, reducing TCR below 150%
      await priceFeed.setPrice('100000000000000000000');
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts))

      // Carol opens at 150% ICR in Recovery Mode
      const txCarol = (await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: carol } })).tx
      assert.equal((await troveManager.Troves(carol)).frontEndTag, ZERO_ADDR)
      assert.isTrue(txCarol.receipt.status)
      assert.isTrue(await sortedTroves.contains(carol))
      const txCarolFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txCarol))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.add(txBobFeeBN).add(txCarolFeeBN).toString())

      const carol_TroveStatus = await troveManager.getTroveStatus(carol)
      assert.equal(carol_TroveStatus, 1)

      const carolICR = await troveManager.getCurrentICR(carol, price)
      assert.isTrue(carolICR.gt(toBN(dec(150, 16))))
    })

    it("openTrove(): Reverts opening a trove with min debt when system is in Recovery Mode", async () => {
      // --- SETUP ---
      //  Alice and Bob add coll and withdraw such  that the TCR is ~150%
      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.toString())

      const txBob = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
      const txBobFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txBob.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.add(txBobFeeBN).toString())

      const TCR = (await th.getTCR(contracts)).toString()
      assert.equal(TCR, '1500000000000000000')

      // price drops to 1ETH:100LUSD, reducing TCR below 150%
      await priceFeed.setPrice('100000000000000000000');

      assert.isTrue(await th.checkRecoveryMode(contracts))

      await weth.deposit({from: carol, value: dec(1, 'ether')})
      await weth.approve(borrowerOperations.address, dec(1, 'ether'), { from: carol })
      await assertRevert(borrowerOperations.openTrove(th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT), dec(1, 'ether'), carol, carol, ZERO_ADDR, { from: carol }))
      assert.equal((await troveManager.Troves(carol)).frontEndTag, ZERO_ADDR)
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.add(txBobFeeBN).toString())
    })

    it("openTrove(): creates a new Trove and assigns the correct collateral and debt amount", async () => {
      const debt_Before = await getTroveEntireDebt(alice)
      const coll_Before = await getTroveEntireColl(alice)
      const status_Before = await troveManager.getTroveStatus(alice)

      // check coll and debt before
      assert.equal(debt_Before, 0)
      assert.equal(coll_Before, 0)

      // check non-existent status
      assert.equal(status_Before, 0)

      const LUSDRequest = MIN_NET_DEBT
      await weth.deposit({from: alice, value: dec(100, 'ether')})
      await weth.approve(borrowerOperations.address, dec(100, 'ether'), { from: alice })
      const txAlice = await borrowerOperations.openTrove(th._100pct, MIN_NET_DEBT, dec(100, 'ether'), carol, carol, ZERO_ADDR, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.toString())

      // Get the expected debt based on the LUSD request (adding fee and liq. reserve on top)
      const expectedDebt = LUSDRequest
        .add(await troveManager.getBorrowingFee(LUSDRequest))
        .add(LUSD_GAS_COMPENSATION)

      const debt_After = await getTroveEntireDebt(alice)
      const coll_After = await getTroveEntireColl(alice)
      const status_After = await troveManager.getTroveStatus(alice)

      // check coll and debt after
      assert.isTrue(coll_After.gt('0'))
      assert.isTrue(debt_After.gt('0'))

      assert.isTrue(debt_After.eq(expectedDebt))

      // check active status
      assert.equal(status_After, 1)
    })

    it("openTrove(): adds Trove owner to TroveOwners array", async () => {
      const TroveOwnersCount_Before = (await troveManager.getTroveOwnersCount()).toString();
      assert.equal(TroveOwnersCount_Before, '0')

      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.toString())

      const TroveOwnersCount_After = (await troveManager.getTroveOwnersCount()).toString();
      assert.equal(TroveOwnersCount_After, '1')
    })

    it("openTrove(): creates a stake and adds it to total stakes", async () => {
      const aliceStakeBefore = await getTroveStake(alice)
      const totalStakesBefore = await troveManager.totalStakes()

      assert.equal(aliceStakeBefore, '0')
      assert.equal(totalStakesBefore, '0')

      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const aliceCollAfter = await getTroveEntireColl(alice)
      const aliceStakeAfter = await getTroveStake(alice)
      assert.isTrue(aliceCollAfter.gt(toBN('0')))
      assert.isTrue(aliceStakeAfter.eq(aliceCollAfter))
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.toString())

      const totalStakesAfter = await troveManager.totalStakes()

      assert.isTrue(totalStakesAfter.eq(aliceStakeAfter))
    })

    it("openTrove(): inserts Trove to Sorted Troves list", async () => {
      // Check before
      const aliceTroveInList_Before = await sortedTroves.contains(alice)
      const listIsEmpty_Before = await sortedTroves.isEmpty()
      assert.equal(aliceTroveInList_Before, false)
      assert.equal(listIsEmpty_Before, true)

      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.toString())

      // check after
      const aliceTroveInList_After = await sortedTroves.contains(alice)
      const listIsEmpty_After = await sortedTroves.isEmpty()
      assert.equal(aliceTroveInList_After, true)
      assert.equal(listIsEmpty_After, false)
    })

    it("openTrove(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
      const activePool_ETH_Before = await activePool.getETH()
      const activePool_RawEther_Before = await weth.balanceOf(activePool.address)
      assert.equal(activePool_ETH_Before, 0)
      assert.equal(activePool_RawEther_Before, 0)

      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const aliceCollAfter = await getTroveEntireColl(alice)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.toString())

      const activePool_ETH_After = await activePool.getETH()
        const activePool_RawEther_After = await weth.balanceOf(activePool.address)
      assert.isTrue(activePool_ETH_After.eq(aliceCollAfter))
      assert.isTrue(activePool_RawEther_After.eq(aliceCollAfter))
    })

    it("openTrove(): records up-to-date initial snapshots of L_ETH and L_LUSDDebt", async () => {
      // --- SETUP ---

      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.toString())

      const txCarol = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
      assert.equal((await troveManager.Troves(carol)).frontEndTag, ZERO_ADDR)
      const txCarolFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txCarol.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.add(txCarolFeeBN).toString())

      // --- TEST ---

      // price drops to 1ETH:100LUSD, reducing Carol's ICR below MCR
      await priceFeed.setPrice(dec(100, 18));

      // close Carol's Trove, liquidating her 1 ether and 180LUSD.
      const liquidationTx = await troveManager.liquidate(carol, { from: owner });
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      /* with total stakes = 10 ether, after liquidation, L_ETH should equal 1/10 ether per-ether-staked,
       and L_LUSD should equal 18 LUSD per-ether-staked. */

      const L_ETH = await troveManager.L_ETH()
      const L_LUSD = await troveManager.L_LUSDDebt()

      assert.isTrue(L_ETH.gt(toBN('0')))
      assert.isTrue(L_LUSD.gt(toBN('0')))

      // Bob opens trove
      const txBob = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      assert.equal((await troveManager.Troves(bob)).frontEndTag, ZERO_ADDR)
      const txBobFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txBob.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.add(txCarolFeeBN).add(txBobFeeBN).toString())

      // Check Bob's snapshots of L_ETH and L_LUSD equal the respective current values
      const bob_rewardSnapshot = await troveManager.rewardSnapshots(bob)
      const bob_ETHrewardSnapshot = bob_rewardSnapshot[0]
      const bob_LUSDDebtRewardSnapshot = bob_rewardSnapshot[1]

      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot, L_ETH), 1000)
      assert.isAtMost(th.getDifference(bob_LUSDDebtRewardSnapshot, L_LUSD), 1000)
    })

    it("openTrove(): allows a user to open a Trove, then close it, then re-open it", async () => {
      // Open Troves
      const txWhale = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      assert.equal((await troveManager.Troves(whale)).frontEndTag, ZERO_ADDR)
      const txWhaleFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txWhale.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txWhaleFeeBN.toString())

      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.add(txWhaleFeeBN).toString())

      const txCarol = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })
      assert.equal((await troveManager.Troves(carol)).frontEndTag, ZERO_ADDR)
      const txCarolFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txCarol.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.add(txWhaleFeeBN).add(txCarolFeeBN).toString())

      // Check Trove is active
      const alice_Trove_1 = await troveManager.Troves(alice)
      const status_1 = alice_Trove_1[3]
      assert.equal(status_1, 1)
      assert.isTrue(await sortedTroves.contains(alice))

      // to compensate borrowing fees
      await lusdToken.transfer(alice, dec(10000, 18), { from: whale })

      // Repay and close Trove
      await borrowerOperations.closeTrove({ from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)

      // Check Trove is closed
      const alice_Trove_2 = await troveManager.Troves(alice)
      const status_2 = alice_Trove_2[3]
      assert.equal(status_2, 2)
      assert.isFalse(await sortedTroves.contains(alice))

      // Re-open Trove
      const txAlice2 = await openTrove({ extraLUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const txAlice2FeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice2.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.add(txWhaleFeeBN).add(txCarolFeeBN).add(txAlice2FeeBN).toString())

      // Check Trove is re-opened
      const alice_Trove_3 = await troveManager.Troves(alice)
      const status_3 = alice_Trove_3[3]
      assert.equal(status_3, 1)
      assert.isTrue(await sortedTroves.contains(alice))
    })

    it("openTrove(): increases the Trove's LUSD debt by the correct amount", async () => {
      // check before
      const alice_Trove_Before = await troveManager.Troves(alice)
      const debt_Before = alice_Trove_Before[0]
      assert.equal(debt_Before, 0)

      await weth.deposit({from: alice, value: dec(100, 'ether')})
      await weth.approve(borrowerOperations.address, dec(100, 'ether'), { from: alice })
      const txAlice = await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), alice, alice, ZERO_ADDR, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.toString())

      // check after
      const alice_Trove_After = await troveManager.Troves(alice)
      const debt_After = alice_Trove_After[0]
      th.assertIsApproximatelyEqual(debt_After, dec(10000, 18), 10000)
    })

    it("openTrove(): increases LUSD debt in ActivePool by the debt of the trove", async () => {
      const activePool_LUSDDebt_Before = await activePool.getLUSDDebt()
      assert.equal(activePool_LUSDDebt_Before, 0)

      const txAlice = await openTrove({ extraLUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const aliceDebt = await getTroveEntireDebt(alice)
      assert.isTrue(aliceDebt.gt(toBN('0')))
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice.tx))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.toString())

      const activePool_LUSDDebt_After = await activePool.getLUSDDebt()
      assert.isTrue(activePool_LUSDDebt_After.eq(aliceDebt))
    })

    it("openTrove(): increases user LUSDToken balance by correct amount", async () => {
      // check before
      const alice_LUSDTokenBalance_Before = await lusdToken.balanceOf(alice)
      assert.equal(alice_LUSDTokenBalance_Before, 0)

      await weth.deposit({ from: alice, value: dec(100, 'ether') })
      await weth.approve(borrowerOperations.address, dec(100, 'ether'), { from: alice })
      const txAlice = await borrowerOperations.openTrove(th._100pct, dec(10000, 18), dec(100, 'ether'), alice, alice, ZERO_ADDR, { from: alice })
      assert.equal((await troveManager.Troves(alice)).frontEndTag, ZERO_ADDR)
      const txAliceFeeBN = BigNumber.from(th.getLUSDFeeFromLUSDBorrowingEvent(txAlice))
      assert.equal((await lusdToken.balanceOf(ecosystemFund.address)).toString(), txAliceFeeBN.toString())

      // check after
      const alice_LUSDTokenBalance_After = await lusdToken.balanceOf(alice)
      assert.equal(alice_LUSDTokenBalance_After, dec(10000, 18))
    })

    //  --- getNewICRFromTroveChange - (external wrapper in Tester contract calls internal function) ---

    describe("getNewICRFromTroveChange() returns the correct ICR", async () => {


      // 0, 0
      it("collChange = 0, debtChange = 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = 0

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // 0, +ve
      it("collChange = 0, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.isAtMost(th.getDifference(newICR, '1333333333333333333'), 100)
      })

      // 0, -ve
      it("collChange = 0, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, false, price)).toString()
        assert.equal(newICR, '4000000000000000000')
      })

      // +ve, 0
      it("collChange is positive, debtChange is 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(1, 'ether')
        const debtChange = 0

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.equal(newICR, '4000000000000000000')
      })

      // -ve, 0
      it("collChange is negative, debtChange is 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(5, 17)
        const debtChange = 0

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, false, debtChange, true, price)).toString()
        assert.equal(newICR, '1000000000000000000')
      })

      // -ve, -ve
      it("collChange is negative, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(5, 17)
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, false, debtChange, false, price)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // +ve, +ve 
      it("collChange is positive, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(1, 'ether')
        const debtChange = dec(100, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // +ve, -ve
      it("collChange is positive, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(1, 'ether')
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, false, price)).toString()
        assert.equal(newICR, '8000000000000000000')
      })

      // -ve, +ve
      it("collChange is negative, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(5, 17)
        const debtChange = dec(100, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, false, debtChange, true, price)).toString()
        assert.equal(newICR, '500000000000000000')
      })
    })

    // --- getCompositeDebt ---

    it("getCompositeDebt(): returns debt + gas comp", async () => {
      const res1 = await borrowerOperations.getCompositeDebt('0')
      assert.equal(res1, LUSD_GAS_COMPENSATION.toString())

      const res2 = await borrowerOperations.getCompositeDebt(dec(90, 18))
      th.assertIsApproximatelyEqual(res2, LUSD_GAS_COMPENSATION.add(toBN(dec(90, 18))))

      const res3 = await borrowerOperations.getCompositeDebt(dec(24423422357345049, 12))
      th.assertIsApproximatelyEqual(res3, LUSD_GAS_COMPENSATION.add(toBN(dec(24423422357345049, 12))))
    })

    //  --- getNewTCRFromTroveChange  - (external wrapper in Tester contract calls internal function) ---

    describe("getNewTCRFromTroveChange() returns the correct TCR", async () => {

      // 0, 0
      it("collChange = 0, debtChange = 0", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveLUSDAmount = await getOpenTroveLUSDAmount(troveTotalDebt)

        await weth.deposit({from: alice, value: troveColl})
        await weth.approve(borrowerOperations.address, troveColl, { from: alice })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, alice, alice, ZERO_ADDR, { from: alice  })
        
        await weth.deposit({ from: bob, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: bob })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, bob, bob, ZERO_ADDR, { from: bob  })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = 0
        const debtChange = 0
        const newTCR = await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true, price)

        const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // 0, +ve
      it("collChange = 0, debtChange is positive", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveLUSDAmount = await getOpenTroveLUSDAmount(troveTotalDebt)

        await weth.deposit({ from: alice, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: alice })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, alice, alice, ZERO_ADDR, { from: alice })

        await weth.deposit({ from: bob, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: bob })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, bob, bob, ZERO_ADDR,  { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = 0
        const debtChange = dec(200, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true, price))

        const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).add(toBN(debtChange)))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // 0, -ve
      it("collChange = 0, debtChange is negative", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveLUSDAmount = await getOpenTroveLUSDAmount(troveTotalDebt)

        await weth.deposit({ from: alice, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: alice })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, alice, alice, ZERO_ADDR, { from: alice })
        
        await weth.deposit({ from: bob, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: bob })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, bob, bob, ZERO_ADDR, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()
        // --- TEST ---
        const collChange = 0
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, false, price))

        const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).sub(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // +ve, 0
      it("collChange is positive, debtChange is 0", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveLUSDAmount = await getOpenTroveLUSDAmount(troveTotalDebt)

        await weth.deposit({ from: alice, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: alice })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, alice, alice, ZERO_ADDR, { from: alice  })
        
        await weth.deposit({ from: bob, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: bob })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, bob, bob, ZERO_ADDR, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()
        // --- TEST ---
        const collChange = dec(2, 'ether')
        const debtChange = 0
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true, price))

        const expectedTCR = (troveColl.add(liquidatedColl).add(toBN(collChange))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // -ve, 0
      it("collChange is negative, debtChange is 0", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveLUSDAmount = await getOpenTroveLUSDAmount(troveTotalDebt)

        await weth.deposit({ from: alice, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: alice })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, alice, alice, ZERO_ADDR, { from: alice })
        
        await weth.deposit({ from: bob, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: bob })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, bob, bob, ZERO_ADDR, { from: bob  })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = 0
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, false, debtChange, true, price))

        const expectedTCR = (troveColl.add(liquidatedColl).sub(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // -ve, -ve
      it("collChange is negative, debtChange is negative", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveLUSDAmount = await getOpenTroveLUSDAmount(troveTotalDebt)

        await weth.deposit({ from: alice, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: alice })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, alice, alice, ZERO_ADDR, { from: alice })
        
        await weth.deposit({ from: bob, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: bob })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, bob, bob, ZERO_ADDR, { from: bob})

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, false, debtChange, false, price))

        const expectedTCR = (troveColl.add(liquidatedColl).sub(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).sub(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // +ve, +ve 
      it("collChange is positive, debtChange is positive", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveLUSDAmount = await getOpenTroveLUSDAmount(troveTotalDebt)

        await weth.deposit({ from: alice, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: alice })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, alice, alice, ZERO_ADDR, { from: alice })
        
        await weth.deposit({ from: bob, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: bob })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, bob, bob, ZERO_ADDR, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 'ether')
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, true, price))

        const expectedTCR = (troveColl.add(liquidatedColl).add(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).add(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // +ve, -ve
      it("collChange is positive, debtChange is negative", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveLUSDAmount = await getOpenTroveLUSDAmount(troveTotalDebt)

        await weth.deposit({ from: alice, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: alice })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, alice, alice, ZERO_ADDR, { from: alice })
        
        await weth.deposit({ from: bob, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: bob })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, bob, bob, ZERO_ADDR, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 'ether')
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, true, debtChange, false, price))

        const expectedTCR = (troveColl.add(liquidatedColl).add(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).sub(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // -ve, +ve
      it("collChange is negative, debtChange is positive", async () => {
        // --- SETUP --- Create a Liquity instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveLUSDAmount = await getOpenTroveLUSDAmount(troveTotalDebt)

        await weth.deposit({ from: alice, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: alice })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, alice, alice, ZERO_ADDR, { from: alice })
        
        await weth.deposit({ from: bob, value: troveColl })
        await weth.approve(borrowerOperations.address, troveColl, { from: bob })
        await borrowerOperations.openTrove(th._100pct, troveLUSDAmount, troveColl, bob, bob, ZERO_ADDR, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(bob)
        assert.isFalse(await sortedTroves.contains(bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = await getNetBorrowingAmount(dec(200, 18))
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(collChange, false, debtChange, true, price))

        const expectedTCR = (troveColl.add(liquidatedColl).sub(toBN(collChange))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).add(toBN(debtChange)))

        assert.isTrue(newTCR.eq(expectedTCR))
      })
    })

    if (!withProxy) {
      // NOTE: to be skipped since we are not using msg.value anymore and this has no other way of sending funds(imo).
      it.skip('closeTrove(): fails if owner cannot receive ETH', async () => {
        const nonPayable = await NonPayable.new(weth.address)

        // we need 2 troves to be able to close 1 and have 1 remaining in the system
        await weth.deposit({ from: alice, value: dec(1000, 18)})
        await weth.approve(borrowerOperations.address, dec(1000, 18), { from: alice})
        await borrowerOperations.openTrove(th._100pct, dec(100000, 18), dec(1000, 18), alice, alice, ZERO_ADDR, { from: alice })

        // Alice sends LUSD to NonPayable so its LUSD balance covers its debt
        await lusdToken.transfer(nonPayable.address, dec(10000, 18), {from: alice})

        // open trove from NonPayable proxy contract
        const _100pctHex = '0xde0b6b3a7640000'
        const _1e25Hex = '0xd3c21bcecceda1000000'
        await weth.deposit({ from: alice, value:  dec(10000, 'ether')})
        await weth.approve(nonPayable.address,  dec(10000, 'ether'), { from: alice})
        const openTroveData = th.getTransactionData('openTrove(uint256,uint256,uint256,address,address)', [_100pctHex, _1e25Hex, web3.utils.toHex(dec(10000, 'ether')), '0x0', '0x0'])
        await nonPayable.forward(borrowerOperations.address, openTroveData, dec(10000, 'ether'), {from: alice})
        assert.equal((await troveManager.getTroveStatus(nonPayable.address)).toString(), '1', 'NonPayable proxy should have a trove')
        assert.isFalse(await th.checkRecoveryMode(contracts), 'System should not be in Recovery Mode')
        // open trove from NonPayable proxy contract
        const closeTroveData = th.getTransactionData('closeTrove()', [])
        // weth is deposited just to bypass transferfrom in forwarding contract.
        await weth.deposit({ from: alice, value:  dec(10000, 'ether')})
        await weth.approve(nonPayable.address,  dec(10000, 'ether'), { from: alice})
        await th.assertRevert(nonPayable.forward(borrowerOperations.address, closeTroveData, dec(10000, 'ether'), {from: alice}), 'ActivePool: sending ETH failed')
      })
    }
  }

  describe('Without proxy', async () => {
    testCorpus({ withProxy: false })
  })

  // describe('With proxy', async () => {
  //   testCorpus({ withProxy: true })
  // })
})

contract('Reset chain state', async accounts => { })

/* TODO:

 1) Test SortedList re-ordering by ICR. ICR ratio
 changes with addColl, withdrawColl, withdrawLUSD, repayLUSD, etc. Can split them up and put them with
 individual functions, or give ordering it's own 'describe' block.

 2)In security phase:
 -'Negative' tests for all the above functions.
 */
