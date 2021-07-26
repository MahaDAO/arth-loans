const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const Controller = artifacts.require("Controller")
const Governance = artifacts.require("Governance")

const { dec, toBN } = testHelpers.TestHelper
const th = testHelpers.TestHelper

contract('StabilityPool - Withdrawal of stability deposit - Reward calculations', async accounts => {

  const [owner,
    defaulter_1,
    defaulter_2,
    defaulter_3,
    defaulter_4,
    defaulter_5,
    defaulter_6,
    whale,
    // whale_2,
    alice,
    bob,
    carol,
    dennis,
    erin,
    flyn,
    graham,
    harriet,
    A,
    B,
    C,
    D,
    E,
    F
  ] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let contracts
  let weth
  let priceFeed
  let lusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  let gasPriceInWei

  const ZERO_ADDRESS = th.ZERO_ADDRESS

  const getOpenTroveLUSDAmount = async (totalDebt) => th.getOpenTroveLUSDAmount(contracts, totalDebt)

  describe("Stability Pool Withdrawal", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
    })

    beforeEach(async () => {
      contracts = await deploymentHelper.deployLiquityCore(owner, owner)
      const LQTYContracts = await deploymentHelper.deployLQTYContracts(bountyAddress, lpRewardsAddress, multisig)
      contracts.troveManager = await TroveManagerTester.new()
      contracts.governance = await Governance.new(contracts.troveManager.address, contracts.borrowerOperations.address)
      contracts.controller = await Controller.new(
        contracts.troveManager.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address,
        contracts.governance.address,
        contracts.lusdToken.address,
        contracts.gasPool.address 
    )
      // contracts = await deploymentHelper.deployLUSDToken(contracts)

      priceFeed = contracts.priceFeedTestnet
      lusdToken = contracts.lusdToken
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      activePool = contracts.activePool
      stabilityPool = contracts.stabilityPool
      defaultPool = contracts.defaultPool
      borrowerOperations = contracts.borrowerOperations
      weth = contracts.weth

      for (const account of [owner,
        defaulter_1,
        defaulter_2,
        defaulter_3,
        defaulter_4,
        defaulter_5,
        defaulter_6,
        whale,
        // whale_2,
        alice,
        bob,
        carol,
        dennis,
        erin,
        flyn,
        graham,
        harriet,
        A,
        B,
        C,
        D,
        E,
        F
      ]) {
          await lusdToken.approve(contracts.controller.address, dec(1, 39), {from: account})
      }

      await deploymentHelper.connectLQTYContracts(LQTYContracts)
      await deploymentHelper.connectCoreContracts(contracts, LQTYContracts)
      await deploymentHelper.connectLQTYContractsToCore(LQTYContracts, contracts)

      for (const account of [owner,
        defaulter_1,
        defaulter_2,
        defaulter_3,
        defaulter_4,
        defaulter_5,
        defaulter_6,
        whale,
        // whale_2,
        alice,
        bob,
        carol,
        dennis,
        erin,
        flyn,
        graham,
        harriet,
        A,
        B,
        C,
        D,
        E,
        F
      ]) {
        await weth.deposit({from: account, value: dec(100, 30)})
        await weth.approve(borrowerOperations.address, dec(100, 30), {from: account})
      }
    })

    // --- Compounding tests ---

    // --- withdrawETHGainToTrove() ---

    // --- Identical deposits, identical liquidation amounts---
    it("withdrawETHGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether') , whale, whale, ZERO_ADDRESS, { from: whale })

      // A, B, C open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol})

      // Whale transfers 10k LUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter opens trove with 200% ICR and 10k LUSD net debt
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(100, 'ether'), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });

      // Check depositors' compounded deposit is 6666.66 LUSD and ETH Gain is 33.16 ETH
      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '6666666666666666666666'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '6666666666666666666666'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '6666666666666666666666'), 10000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '33166666666666666667'), 10000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '33166666666666666667'), 10000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '33166666666666666667'), 10000)
    })

    it("withdrawETHGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two identical liquidations", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether') , whale, whale, ZERO_ADDRESS, { from: whale })

      // A, B, C open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS,  { from: alice })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol})

      // Whale transfers 10k LUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open trove with 200% ICR
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2})

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Two defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Check depositors' compounded deposit is 3333.33 LUSD and ETH Gain is 66.33 ETH
      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })
      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '3333333333333333333333'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '3333333333333333333333'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '3333333333333333333333'), 10000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '66333333333333333333'), 10000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '66333333333333333333'), 10000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '66333333333333333333'), 10000)
    })

    it("withdrawETHGainToTrove():  Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three identical liquidations", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale})

      // A, B, C open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })

      // Whale transfers 10k LUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open trove with 200% ICR
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_3, defaulter_3, ZERO_ADDRESS, { from: defaulter_3})

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });
      await troveManager.liquidate(defaulter_3, { from: owner });

      // Check depositors' compounded deposit is 0 LUSD and ETH Gain is 99.5 ETH 
      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '0'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '0'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '0'), 10000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(99500, 15)), 10000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(99500, 15)), 10000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(99500, 15)), 10000)
    })

    // --- Identical deposits, increasing liquidation amounts ---
    it("withdrawETHGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after two liquidations of increasing LUSD", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale})

      // A, B, C open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol})

      // Whale transfers 10k LUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open trove with 200% ICR
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(5000, 18)), '50000000000000000000', defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(7000, 18)), '70000000000000000000', defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2})

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Check depositors' compounded deposit
      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '6000000000000000000000'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '6000000000000000000000'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '6000000000000000000000'), 10000)

      // (0.5 + 0.7) * 99.5 / 3
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(398, 17)), 10000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(398, 17)), 10000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(398, 17)), 10000)
    })

    it("withdrawETHGainToTrove(): Depositors with equal initial deposit withdraw correct compounded deposit and ETH Gain after three liquidations of increasing LUSD", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether') , whale, whale, ZERO_ADDRESS, { from: whale})

      // A, B, C open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })

      // Whale transfers 10k LUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open trove with 200% ICR
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(5000, 18)), '50000000000000000000', defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1  })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(6000, 18)),  '60000000000000000000', defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(7000, 18)), '70000000000000000000', defaulter_3, defaulter_3, ZERO_ADDRESS, { from: defaulter_3})

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });
      await troveManager.liquidate(defaulter_3, { from: owner });

      // Check depositors' compounded deposit
      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '4000000000000000000000'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '4000000000000000000000'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '4000000000000000000000'), 10000)

      // (0.5 + 0.6 + 0.7) * 99.5 / 3
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(597, 17)), 10000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(597, 17)), 10000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(597, 17)), 10000)
    })

    // --- Increasing deposits, identical liquidation amounts ---
    it("withdrawETHGainToTrove(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after two identical liquidations", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether') , whale, whale, ZERO_ADDRESS, { from: whale})

      // A, B, C open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol})

      // Whale transfers 10k, 20k, 30k LUSD to A, B and C respectively who then deposit it to the SP
      await lusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })
      await lusdToken.transfer(bob, dec(20000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: bob })
      await lusdToken.transfer(carol, dec(30000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(30000, 18), ZERO_ADDRESS, { from: carol })

      // 2 Defaulters open trove with 200% ICR
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether') , defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(100, 'ether'), defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2, })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '6666666666666666666666'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '13333333333333333333333'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '20000000000000000000000'), 100000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '33166666666666666667'), 100000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '66333333333333333333'), 100000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(995, 17)), 100000)
    })

    it("withdrawETHGainToTrove(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three identical liquidations", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)),  dec(100000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale, })

      // A, B, C open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice,})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })

      // Whale transfers 10k, 20k, 30k LUSD to A, B and C respectively who then deposit it to the SP
      await lusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })
      await lusdToken.transfer(bob, dec(20000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: bob })
      await lusdToken.transfer(carol, dec(30000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(30000, 18), ZERO_ADDRESS, { from: carol })

      // Defaulters open trove with 200% ICR
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether') , defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2,  })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether') , defaulter_3, defaulter_3, ZERO_ADDRESS, { from: defaulter_3, })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });
      await troveManager.liquidate(defaulter_3, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '5000000000000000000000'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '10000000000000000000000'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '15000000000000000000000'), 100000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '49750000000000000000'), 100000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '149250000000000000000'), 100000)
    })

    // --- Varied deposits and varied liquidation amount ---
    it("withdrawETHGainToTrove(): Depositors with varying deposits withdraw correct compounded deposit and ETH Gain after three varying liquidations", async () => {
      // Whale opens Trove with 1m ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(1000000, 18)), dec(1000000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale })

      // A, B, C open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob,})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })

      /* Depositors provide:-
      Alice:  2000 LUSD
      Bob:  456000 LUSD
      Carol: 13100 LUSD */
      // Whale transfers LUSD to  A, B and C respectively who then deposit it to the SP
      await lusdToken.transfer(alice, dec(2000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(2000, 18), ZERO_ADDRESS, { from: alice })
      await lusdToken.transfer(bob, dec(456000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(456000, 18), ZERO_ADDRESS, { from: bob })
      await lusdToken.transfer(carol, dec(13100, 18), { from: whale })
      await stabilityPool.provideToSP(dec(13100, 18), ZERO_ADDRESS, { from: carol })

      /* Defaulters open troves
     
      Defaulter 1: 207000 LUSD & 2160 ETH
      Defaulter 2: 5000 LUSD & 50 ETH
      Defaulter 3: 46700 LUSD & 500 ETH
      */
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount('207000000000000000000000'), dec(2160, 18) , defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(5, 21)), dec(50, 'ether') , defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount('46700000000000000000000'), dec(500, 'ether'), defaulter_3, defaulter_3, ZERO_ADDRESS, { from: defaulter_3})

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });
      await troveManager.liquidate(defaulter_3, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()

      // ()
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '901719380174061000000'), 100000000000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '205592018679686000000000'), 10000000000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '5906261940140100000000'), 10000000000)

      // 2710 * 0.995 * {2000, 456000, 13100}/4711
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '11447463383570366500'), 10000000000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '2610021651454043834000'), 10000000000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '74980885162385912900'), 10000000000)
    })

    // --- Deposit enters at t > 0

    it("withdrawETHGainToTrove(): A, B, C Deposit -> 2 liquidations -> D deposits -> 1 liquidation. All deposits and liquidations = 100 LUSD.  A, B, C, D withdraw correct LUSD deposit and ETH Gain", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale })

      // A, B, C open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis })

      // Whale transfers 10k LUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open trove with 200% ICR
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1,  })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2,  })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_3, defaulter_3, ZERO_ADDRESS, { from: defaulter_3,})

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Whale transfers 10k to Dennis who then provides to SP
      await lusdToken.transfer(dennis, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: dennis })

      // Third defaulter liquidated
      await troveManager.liquidate(defaulter_3, { from: owner });

      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })
      const txD = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()
      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'ETHGainWithdrawn', '_ETH').toString()

      console.log()
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '1666666666666666666666'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '1666666666666666666666'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '1666666666666666666666'), 100000)

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString(), '5000000000000000000000'), 100000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '82916666666666666667'), 100000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '82916666666666666667'), 100000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '82916666666666666667'), 100000)

      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '49750000000000000000'), 100000)
    })

    it("withdrawETHGainToTrove(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. All deposits and liquidations = 100 LUSD.  A, B, C, D withdraw correct LUSD deposit and ETH Gain", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether') , whale, whale, ZERO_ADDRESS, { from: whale})

      // A, B, C open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis})

      // Whale transfers 10k LUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open trove with 200% ICR
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(100, 'ether'), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(100, 'ether'), defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(100, 'ether'), defaulter_3, defaulter_3, ZERO_ADDRESS, { from: defaulter_3,})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(100, 'ether'), defaulter_4, defaulter_4, ZERO_ADDRESS, { from: defaulter_4})

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Dennis opens a trove and provides to SP
      await lusdToken.transfer(dennis, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: dennis })

      // Third and fourth defaulters liquidated
      await troveManager.liquidate(defaulter_3, { from: owner });
      await troveManager.liquidate(defaulter_4, { from: owner });

      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })
      const txD = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()
      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'ETHGainWithdrawn', '_ETH').toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString(), '0'), 100000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, dec(995, 17)), 100000)
    })

    it("withdrawETHGainToTrove(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. Various deposit and liquidation vals.  A, B, C, D withdraw correct LUSD deposit and ETH Gain", async () => {
      // Whale opens Trove with 1m ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(1000000, 18)), dec(1000000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale })

      // A, B, C, D open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis })

      /* Depositors open troves and make SP deposit:
      Alice: 60000 LUSD
      Bob: 20000 LUSD
      Carol: 15000 LUSD
      */
      // Whale transfers LUSD to  A, B and C respectively who then deposit it to the SP
      await lusdToken.transfer(alice, dec(60000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(60000, 18), ZERO_ADDRESS, { from: alice })
      await lusdToken.transfer(bob, dec(20000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: bob })
      await lusdToken.transfer(carol, dec(15000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(15000, 18), ZERO_ADDRESS, { from: carol })

      /* Defaulters open troves:
      Defaulter 1:  10000 LUSD, 100 ETH
      Defaulter 2:  25000 LUSD, 250 ETH
      Defaulter 3:  5000 LUSD, 50 ETH
      Defaulter 4:  40000 LUSD, 400 ETH
      */
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(25000, 18)), '250000000000000000000', defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(5000, 18)), '50000000000000000000', defaulter_3, defaulter_3, ZERO_ADDRESS, { from: defaulter_3})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(40000, 18)), dec(400, 'ether') , defaulter_4, defaulter_4, ZERO_ADDRESS, { from: defaulter_4})

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Dennis provides 25000 LUSD
      await lusdToken.transfer(dennis, dec(25000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(25000, 18), ZERO_ADDRESS, { from: dennis })

      // Last two defaulters liquidated
      await troveManager.liquidate(defaulter_3, { from: owner });
      await troveManager.liquidate(defaulter_4, { from: owner });

      // Each depositor withdraws as much as possible
      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })
      const txD = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()
      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'ETHGainWithdrawn', '_ETH').toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '17832817337461300000000'), 100000000000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '5944272445820430000000'), 100000000000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '4458204334365320000000'), 100000000000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString(), '11764705882352900000000'), 100000000000)

      // 3.5*0.995 * {60000,20000,15000,0} / 95000 + 450*0.995 * {60000/950*{60000,20000,15000},25000} / (120000-35000)
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '419563467492260055900'), 100000000000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '139854489164086692700'), 100000000000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '104890866873065014000'), 100000000000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '131691176470588233700'), 100000000000)
    })

    // --- Depositor leaves ---

    it("withdrawETHGainToTrove(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. All deposits and liquidations = 100 LUSD.  A, B, C, D withdraw correct LUSD deposit and ETH Gain", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether') , whale, whale, ZERO_ADDRESS, { from: whale})

      // A, B, C, D open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol,})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis, })

      // Whale transfers 10k LUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol, dennis]
      for (account of depositors) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open trove with 200% ICR
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2,})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_3, defaulter_3, ZERO_ADDRESS, { from: defaulter_3, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_4, defaulter_4, ZERO_ADDRESS, { from: defaulter_4, })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txD = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis })
      await priceFeed.setPrice(dec(100, 18))

      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'ETHGainWithdrawn', '_ETH').toString()
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString(), '5000000000000000000000'), 100000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '49750000000000000000'), 100000)

      // Two more defaulters are liquidated
      await troveManager.liquidate(defaulter_3, { from: owner });
      await troveManager.liquidate(defaulter_4, { from: owner });

      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '0'), 1000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(995, 17)), 100000)
    })

    it("withdrawETHGainToTrove(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. Various deposit and liquidation vals. A, B, C, D withdraw correct LUSD deposit and ETH Gain", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale})

      // A, B, C, D open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol})
     
      /* Initial deposits:
      Alice: 20000 LUSD
      Bob: 25000 LUSD
      Carol: 12500 LUSD
      Dennis: 40000 LUSD
      */
      // Whale transfers LUSD to  A, B,C and D respectively who then deposit it to the SP
      await lusdToken.transfer(alice, dec(20000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: alice })
      await lusdToken.transfer(bob, dec(25000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(25000, 18), ZERO_ADDRESS, { from: bob })
      await lusdToken.transfer(carol, dec(12500, 18), { from: whale })
      await stabilityPool.provideToSP(dec(12500, 18), ZERO_ADDRESS, { from: carol })
      await lusdToken.transfer(dennis, dec(40000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(40000, 18), ZERO_ADDRESS, { from: dennis })

      /* Defaulters open troves:
      Defaulter 1: 10000 LUSD
      Defaulter 2: 20000 LUSD
      Defaulter 3: 30000 LUSD
      Defaulter 4: 5000 LUSD
      */
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(20000, 18)), dec(200, 'ether'), defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(30000, 18)),  dec(300, 'ether') , defaulter_3, defaulter_3, ZERO_ADDRESS, { from: defaulter_3})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(5000, 18)),  '50000000000000000000' , defaulter_4, defaulter_4, ZERO_ADDRESS, { from: defaulter_4})

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txD = await stabilityPool.withdrawFromSP(dec(40000, 18), { from: dennis })
      await priceFeed.setPrice(dec(100, 18))

      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'ETHGainWithdrawn', '_ETH').toString()
      assert.isAtMost(th.getDifference((await lusdToken.balanceOf(dennis)).toString(), '27692307692307700000000'), 100000000000)
      // 300*0.995 * 40000/97500
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '122461538461538466100'), 100000000000)

      // Two more defaulters are liquidated
      await troveManager.liquidate(defaulter_3, { from: owner });
      await troveManager.liquidate(defaulter_4, { from: owner });

      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '1672240802675590000000'), 10000000000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '2090301003344480000000'), 100000000000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '1045150501672240000000'), 100000000000)

      // 300*0.995 * {20000,25000,12500}/97500 + 350*0.995 * {20000,25000,12500}/57500
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '182361204013377919900'), 100000000000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '227951505016722411000'), 100000000000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '113975752508361205500'), 100000000000)
    })

    // --- One deposit enters at t > 0, and another leaves later ---
    it("withdrawETHGainToTrove(): A, B, D deposit -> 2 liquidations -> C makes deposit -> 1 liquidation -> D withdraws -> 1 liquidation. All deposits: 100 LUSD. Liquidations: 100,100,100,50.  A, B, C, D withdraw correct LUSD deposit and ETH Gain", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether') , whale, whale, ZERO_ADDRESS, { from: whale})

      // A, B, C, D open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol})
   
      // Whale transfers 10k LUSD to A, B and D who then deposit it to the SP
      const depositors = [alice, bob, dennis]
      for (account of depositors) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether') , defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(100, 'ether'), defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(100, 'ether'), defaulter_3, defaulter_3, ZERO_ADDRESS, { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(5000, 18)), '50000000000000000000', defaulter_4, defaulter_4, ZERO_ADDRESS, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Carol makes deposit
      await lusdToken.transfer(carol, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: carol })

      await troveManager.liquidate(defaulter_3, { from: owner });

      // Dennis withdraws his deposit and ETH gain
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txD = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: dennis })
      await priceFeed.setPrice(dec(100, 18))

      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'ETHGainWithdrawn', '_ETH').toString()
      assert.isAtMost(th.getDifference((await lusdToken.balanceOf(dennis)).toString(), '1666666666666666666666'), 100000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '82916666666666666667'), 100000)

      await troveManager.liquidate(defaulter_4, { from: owner });

      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '666666666666666666666'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '666666666666666666666'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '2000000000000000000000'), 100000)

      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, '92866666666666666667'), 100000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '92866666666666666667'), 100000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '79600000000000000000'), 100000)
    })

    // --- Tests for full offset - Pool empties to 0 ---

    // A, B deposit 10000
    // L1 cancels 20000, 200
    // C, D deposit 10000
    // L2 cancels 10000,100

    // A, B withdraw 0LUSD & 100e
    // C, D withdraw 5000LUSD  & 500e
    it("withdrawETHGainToTrove(): Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)),  dec(100000, 'ether') , whale, whale, ZERO_ADDRESS, { from: whale })

      // A, B, C, D open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis,  })

      // Whale transfers 10k LUSD to A, B who then deposit it to the SP
      const depositors = [alice, bob]
      for (account of depositors) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // 2 Defaulters open trove with 200% ICR
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(20000, 18)), dec(200, 'ether'), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated. 20000 LUSD fully offset with pool.
      await troveManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis each deposit 10000 LUSD
      const depositors_2 = [carol, dennis]
      for (account of depositors_2) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 2 liquidated. 10000 LUSD offset
      await troveManager.liquidate(defaulter_2, { from: owner });

      // await borrowerOperations.openTrove(th._100pct, dec(1, 18), account, account, { from: erin, value: dec(2, 'ether') })
      // await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: erin })

      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })
      const txD = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis })

      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()
      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'ETHGainWithdrawn', '_ETH').toString()

      // Expect Alice And Bob's compounded deposit to be 0 LUSD
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '0'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '0'), 10000)

      // Expect Alice and Bob's ETH Gain to be 100 ETH
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), 100000)

      // Expect Carol And Dennis' compounded deposit to be 50 LUSD
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '5000000000000000000000'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString(), '5000000000000000000000'), 100000)

      // Expect Carol and and Dennis ETH Gain to be 50 ETH
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '49750000000000000000'), 100000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '49750000000000000000'), 100000)
    })

    // A, B deposit 10000
    // L1 cancels 10000, 1
    // L2 10000, 200 empties Pool
    // C, D deposit 10000
    // L3 cancels 10000, 1 
    // L2 20000, 200 empties Pool
    it("withdrawETHGainToTrove(): Pool-emptying liquidation increases epoch by one, resets scaleFactor to 0, and resets P to 1e18", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether') , whale, whale, ZERO_ADDRESS, { from: whale})

      // A, B, C, D open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis })

      // Whale transfers 10k LUSD to A, B who then deposit it to the SP
      const depositors = [alice, bob]
      for (account of depositors) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // 4 Defaulters open trove with 200% ICR
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_3, defaulter_3, ZERO_ADDRESS, { from: defaulter_3})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_4, defaulter_4, ZERO_ADDRESS, { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      const epoch_0 = (await stabilityPool.currentEpoch()).toString()
      const scale_0 = (await stabilityPool.currentScale()).toString()
      const P_0 = (await stabilityPool.P()).toString()

      assert.equal(epoch_0, '0')
      assert.equal(scale_0, '0')
      assert.equal(P_0, dec(1, 18))

      // Defaulter 1 liquidated. 10--0 LUSD fully offset, Pool remains non-zero
      await troveManager.liquidate(defaulter_1, { from: owner });

      //Check epoch, scale and sum
      const epoch_1 = (await stabilityPool.currentEpoch()).toString()
      const scale_1 = (await stabilityPool.currentScale()).toString()
      const P_1 = (await stabilityPool.P()).toString()

      assert.equal(epoch_1, '0')
      assert.equal(scale_1, '0')
      assert.isAtMost(th.getDifference(P_1, dec(5, 17)), 1000)

      // Defaulter 2 liquidated. 1--00 LUSD, empties pool
      await troveManager.liquidate(defaulter_2, { from: owner });

      //Check epoch, scale and sum
      const epoch_2 = (await stabilityPool.currentEpoch()).toString()
      const scale_2 = (await stabilityPool.currentScale()).toString()
      const P_2 = (await stabilityPool.P()).toString()

      assert.equal(epoch_2, '1')
      assert.equal(scale_2, '0')
      assert.equal(P_2, dec(1, 18))

      // Carol, Dennis each deposit 10000 LUSD
      const depositors_2 = [carol, dennis]
      for (account of depositors) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 3 liquidated. 10000 LUSD fully offset, Pool remains non-zero
      await troveManager.liquidate(defaulter_3, { from: owner });

      //Check epoch, scale and sum
      const epoch_3 = (await stabilityPool.currentEpoch()).toString()
      const scale_3 = (await stabilityPool.currentScale()).toString()
      const P_3 = (await stabilityPool.P()).toString()

      assert.equal(epoch_3, '1')
      assert.equal(scale_3, '0')
      assert.isAtMost(th.getDifference(P_3, dec(5, 17)), 1000)

      // Defaulter 4 liquidated. 10000 LUSD, empties pool
      await troveManager.liquidate(defaulter_4, { from: owner });

      //Check epoch, scale and sum
      const epoch_4 = (await stabilityPool.currentEpoch()).toString()
      const scale_4 = (await stabilityPool.currentScale()).toString()
      const P_4 = (await stabilityPool.P()).toString()

      assert.equal(epoch_4, '2')
      assert.equal(scale_4, '0')
      assert.equal(P_4, dec(1, 18))
    })


    // A, B deposit 10000
    // L1 cancels 20000, 200
    // C, D, E deposit 10000, 20000, 30000
    // L2 cancels 10000,100 

    // A, B withdraw 0 LUSD & 100e
    // C, D withdraw 5000 LUSD  & 50e
    it("withdrawETHGainToTrove(): Depositors withdraw correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale })

      // A, B, C, D open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice,  })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis,  })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: erin})

      // Whale transfers 10k LUSD to A, B who then deposit it to the SP
      const depositors = [alice, bob]
      for (account of depositors) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // 2 Defaulters open trove with 200% ICR
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(20000, 18)), dec(200, 'ether') , defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether'), defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated. 20000 LUSD fully offset with pool.
      await troveManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis, Erin each deposit 10000, 20000, 30000 LUSD respectively
      await lusdToken.transfer(carol, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: carol })

      await lusdToken.transfer(dennis, dec(20000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: dennis })

      await lusdToken.transfer(erin, dec(30000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(30000, 18), ZERO_ADDRESS, { from: erin })

      // Defaulter 2 liquidated. 10000 LUSD offset
      await troveManager.liquidate(defaulter_2, { from: owner });

      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })
      const txD = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis })
      const txE = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: erin })

      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()
      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'ETHGainWithdrawn', '_ETH').toString()
      const erin_ETHWithdrawn = th.getEventArgByName(txE, 'ETHGainWithdrawn', '_ETH').toString()

      // Expect Alice And Bob's compounded deposit to be 0 LUSD
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '0'), 10000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '0'), 10000)

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '8333333333333333333333'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString(), '16666666666666666666666'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(erin)).toString(), '25000000000000000000000'), 100000)

      //Expect Alice and Bob's ETH Gain to be 1 ETH
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), 100000)

      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '16583333333333333333'), 100000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '33166666666666666667'), 100000)
      assert.isAtMost(th.getDifference(erin_ETHWithdrawn, '49750000000000000000'), 100000)
    })

    // A deposits 10000
    // L1, L2, L3 liquidated with 10000 LUSD each
    // A withdraws all
    // Expect A to withdraw 0 deposit and ether only from reward L1
    it("withdrawETHGainToTrove(): single deposit fully offset. After subsequent liquidations, depositor withdraws 0 deposit and *only* the ETH Gain from one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale })

      // A, B, C, D open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol,  })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis,})

      await lusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1,2,3 withdraw 10000 LUSD
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether') , defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether') , defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(100, 'ether') , defaulter_3, defaulter_3, ZERO_ADDRESS, { from: defaulter_3,})

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1, 2  and 3 liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });
      await troveManager.liquidate(defaulter_3, { from: owner });

      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()

      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), 0), 100000)
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), 100000)
    })

    //--- Serial full offsets ---

    // A,B deposit 10000 LUSD
    // L1 cancels 20000 LUSD, 2E
    // B,C deposits 10000 LUSD
    // L2 cancels 20000 LUSD, 2E
    // E,F deposit 10000 LUSD
    // L3 cancels 20000, 200E
    // G,H deposits 10000
    // L4 cancels 20000, 200E

    // Expect all depositors withdraw 0 LUSD and 100 ETH

    it("withdrawETHGainToTrove(): Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale })

      // A, B, C, D, E, F, G, H open troves
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob,  })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: erin, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: flyn,})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: harriet, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: graham })

      // 4 Defaulters open trove with 200% ICR
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(20000, 18)), dec(200, 'ether') , defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(20000, 18)), dec(200, 'ether') , defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(20000, 18)), dec(200, 'ether') , defaulter_3, defaulter_3, ZERO_ADDRESS, { from: defaulter_3, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(20000, 18)), dec(200, 'ether') , defaulter_4, defaulter_4, ZERO_ADDRESS, { from: defaulter_4, })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Alice, Bob each deposit 10k LUSD
      const depositors_1 = [alice, bob]
      for (account of depositors_1) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 1 liquidated. 20k LUSD fully offset with pool.
      await troveManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis each deposit 10000 LUSD
      const depositors_2 = [carol, dennis]
      for (account of depositors_2) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 2 liquidated. 10000 LUSD offset
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Erin, Flyn each deposit 10000 LUSD
      const depositors_3 = [erin, flyn]
      for (account of depositors_3) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 3 liquidated. 10000 LUSD offset
      await troveManager.liquidate(defaulter_3, { from: owner });

      // Graham, Harriet each deposit 10000 LUSD
      const depositors_4 = [graham, harriet]
      for (account of depositors_4) {
        await lusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 4 liquidated. 10k LUSD offset
      await troveManager.liquidate(defaulter_4, { from: owner });

      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })
      const txD = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis })
      const txE = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: erin })
      const txF = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: flyn })
      const txG = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: graham })
      const txH = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: harriet })

      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()
      const dennis_ETHWithdrawn = th.getEventArgByName(txD, 'ETHGainWithdrawn', '_ETH').toString()
      const erin_ETHWithdrawn = th.getEventArgByName(txE, 'ETHGainWithdrawn', '_ETH').toString()
      const flyn_ETHWithdrawn = th.getEventArgByName(txF, 'ETHGainWithdrawn', '_ETH').toString()
      const graham_ETHWithdrawn = th.getEventArgByName(txG, 'ETHGainWithdrawn', '_ETH').toString()
      const harriet_ETHWithdrawn = th.getEventArgByName(txH, 'ETHGainWithdrawn', '_ETH').toString()

      // Expect all deposits to be 0 LUSD
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(alice)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(erin)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(flyn)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(graham)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(harriet)).toString(), '0'), 100000)

      /* Expect all ETH gains to be 100 ETH:  Since each liquidation of empties the pool, depositors
      should only earn ETH from the single liquidation that cancelled with their deposit */
      assert.isAtMost(th.getDifference(alice_ETHWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(erin_ETHWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(flyn_ETHWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(graham_ETHWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(harriet_ETHWithdrawn, dec(995, 17)), 100000)

      const finalEpoch = (await stabilityPool.currentEpoch()).toString()
      assert.equal(finalEpoch, 4)
    })

    // --- Scale factor tests ---

     // A deposits 10000
    // L1 brings P close to boundary, i.e. 9e-9: liquidate 9999.99991
    // A withdraws all
    // B deposits 10000
    // L2 of 9900 LUSD, should bring P slightly past boundary i.e. 1e-9 -> 1e-10

    // expect d(B) = d0(B)/100
    // expect correct ETH gain, i.e. all of the reward
    it("withdrawETHGainToTrove(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale })

      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob})

      await lusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 withdraws 'almost' 10000 LUSD:  9999.99991 LUSD
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount('9999999910000000000000'), dec(100, 'ether'), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })

      assert.equal(await stabilityPool.currentScale(), '0')

      // Defaulter 2 withdraws 9900 LUSD
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(9900, 18)), dec(60, 'ether'), defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2})

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P reduced to 9e9.
      await troveManager.liquidate(defaulter_1, { from: owner });
      assert.equal((await stabilityPool.P()).toString(), dec(9, 9))

      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      await priceFeed.setPrice(dec(100, 18))

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = await th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()

      await lusdToken.transfer(bob, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: bob })

      // Defaulter 2 liquidated.  9900 LUSD liquidated. P altered by a factor of 1-(9900/10000) = 0.01.  Scale changed.
      await troveManager.liquidate(defaulter_2, { from: owner });

      assert.equal(await stabilityPool.currentScale(), '1')

      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const bob_ETHWithdrawn = await th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()

      // Expect Bob to retain 1% of initial deposit (100 LUSD) and all the liquidated ETH (60 ether)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), '100000000000000000000'), 100000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '59700000000000000000'), 100000)
      
    })

    // A deposits 10000
    // L1 brings P close to boundary, i.e. 9e-9: liquidate 9999.99991 LUSD
    // A withdraws all
    // B, C, D deposit 10000, 20000, 30000
    // L2 of 59400, should bring P slightly past boundary i.e. 1e-9 -> 1e-10

    // expect d(B) = d0(B)/100
    // expect correct ETH gain, i.e. all of the reward
    it("withdrawETHGainToTrove(): Several deposits of varying amounts span one scale factor change. Depositors withdraw correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether') ,  whale, whale, ZERO_ADDRESS, { from: whale})

      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol,  })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis, })
      
      await lusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 withdraws 'almost' 10k LUSD.
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount('9999999910000000000000'),  dec(100, 'ether'), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })

      // Defaulter 2 withdraws 59400 LUSD
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount('59400000000000000000000'), dec(330, 'ether') , defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2})

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P reduced to 9e9
      await troveManager.liquidate(defaulter_1, { from: owner });
      assert.equal((await stabilityPool.P()).toString(), dec(9, 9))

      assert.equal(await stabilityPool.currentScale(), '0')

      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      await priceFeed.setPrice(dec(100, 18))

      //B, C, D deposit to Stability Pool
      await lusdToken.transfer(bob, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: bob })

      await lusdToken.transfer(carol, dec(20000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: carol })

      await lusdToken.transfer(dennis, dec(30000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(30000, 18), ZERO_ADDRESS, { from: dennis })

      // 54000 LUSD liquidated.  P altered by a factor of 1-(59400/60000) = 0.01. Scale changed.
      const txL2 = await troveManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)

      assert.equal(await stabilityPool.currentScale(), '1')

      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })
      const txD = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis })

      /* Expect depositors to retain 1% of their initial deposit, and an ETH gain 
      in proportion to their initial deposit:
     
      Bob:  1000 LUSD, 55 Ether
      Carol:  2000 LUSD, 110 Ether
      Dennis:  3000 LUSD, 165 Ether
     
      Total: 6000 LUSD, 300 Ether
      */
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), dec(100, 18)), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), dec(200, 18)), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString(), dec(300, 18)), 100000)

      const bob_ETHWithdrawn = await th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = await th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()
      const dennis_ETHWithdrawn = await th.getEventArgByName(txD, 'ETHGainWithdrawn', '_ETH').toString()

      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, '54725000000000000000'), 100000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, '109450000000000000000'), 100000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, '164175000000000000000'), 100000)
    })

    // Deposit's ETH reward spans one scale change - deposit reduced by correct amount

    // A make deposit 10000 LUSD
    // L1 brings P to 1e-5*P. L1:  9999.9000000000000000 LUSD
    // A withdraws
    // B makes deposit 10000 LUSD
    // L2 decreases P again by 1e-5, over the scale boundary: 9999.9000000000000000 (near to the 10000 LUSD total deposits)
    // B withdraws
    // expect d(B) = d0(B) * 1e-5
    // expect B gets entire ETH gain from L2
    it("withdrawETHGainToTrove(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)),  dec(100000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale })

      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice,})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob,  })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol, })
      
      await lusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 and default 2 each withdraw 9999.999999999 LUSD
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(99999, 17)), dec(100, 'ether') , defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(99999, 17)), dec(100, 'ether') , defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2 })

      // price drops by 50%: defaulter 1 ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P updated to  to 1e13
      const txL1 = await troveManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 13))  // P decreases. P = 1e(18-5) = 1e13
      assert.equal(await stabilityPool.currentScale(), '0')

      // Alice withdraws
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      await priceFeed.setPrice(dec(100, 18))

      // Bob deposits 10k LUSD
      await lusdToken.transfer(bob, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: bob })

      // Defaulter 2 liquidated
      const txL2 = await troveManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 17))  // Scale changes and P changes. P = 1e(13-5+9) = 1e17
      assert.equal(await stabilityPool.currentScale(), '1')

      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const bob_ETHWithdrawn = await th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()

      // Bob should withdraw 1e-5 of initial deposit: 0.1 LUSD and the full ETH gain of 100 ether
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), dec(1, 17)), 100000)
      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), 100000000000)
    })

    // A make deposit 10000 LUSD
    // L1 brings P to 1e-5*P. L1:  9999.9000000000000000 LUSD
    // A withdraws
    // B,C D make deposit 10000, 20000, 30000
    // L2 decreases P again by 1e-5, over boundary. L2: 59999.4000000000000000  (near to the 60000 LUSD total deposits)
    // B withdraws
    // expect d(B) = d0(B) * 1e-5
    // expect B gets entire ETH gain from L2
    it("withdrawETHGainToTrove(): Several deposits of varying amounts span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)),  dec(100000, 'ether') , whale, whale, ZERO_ADDRESS, { from: whale})

      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice,})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob,  })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol,})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis })
      
      await lusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 and default 2 withdraw up to debt of 9999.9 LUSD and 59999.4 LUSD
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount('9999900000000000000000'),  dec(100, 'ether'), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount('59999400000000000000000'), dec(600, 'ether'), defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2, })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await troveManager.liquidate(defaulter_1, { from: owner });
      assert.equal(await stabilityPool.P(), dec(1, 13))  // P decreases. P = 1e(18-5) = 1e13
      assert.equal(await stabilityPool.currentScale(), '0')

      // Alice withdraws
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txA = await stabilityPool.withdrawFromSP(dec(100, 18), { from: alice })
      await priceFeed.setPrice(dec(100, 18))

      // B, C, D deposit 10000, 20000, 30000 LUSD
      await lusdToken.transfer(bob, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: bob })

      await lusdToken.transfer(carol, dec(20000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: carol })

      await lusdToken.transfer(dennis, dec(30000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(30000, 18), ZERO_ADDRESS, { from: dennis })

      // Defaulter 2 liquidated
      const txL2 = await troveManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 17))  // P decreases. P = 1e(13-5+9) = 1e17
      assert.equal(await stabilityPool.currentScale(), '1')

      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const bob_ETHWithdrawn = await th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()

      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })
      const carol_ETHWithdrawn = await th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()

      const txD = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis })
      const dennis_ETHWithdrawn = await th.getEventArgByName(txD, 'ETHGainWithdrawn', '_ETH').toString()

      // {B, C, D} should have a compounded deposit of {0.1, 0.2, 0.3} LUSD
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(bob)).toString(), dec(1, 17)), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(carol)).toString(), dec(2, 17)), 100000)
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString(), dec(3, 17)), 100000)

      assert.isAtMost(th.getDifference(bob_ETHWithdrawn, dec(995, 17)), 10000000000)
      assert.isAtMost(th.getDifference(carol_ETHWithdrawn, dec(1990, 17)), 100000000000)
      assert.isAtMost(th.getDifference(dennis_ETHWithdrawn, dec(2985, 17)), 100000000000)
    })

    // A make deposit 10000 LUSD
    // L1 brings P to (~1e-10)*P. L1: 9999.9999999000000000 LUSD
    // Expect A to withdraw 0 deposit
    it("withdrawETHGainToTrove(): Deposit that decreases to less than 1e-9 of it's original value is reduced to 0", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale })

      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether') , ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol,  })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)), dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis,})
      
      // Defaulters 1 withdraws 9999.9999999 LUSD
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount('9999999999900000000000'),  dec(100, 'ether'), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })

      // Price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      await lusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 liquidated. P -> (~1e-10)*P
      const txL1 = await troveManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)

      const aliceDeposit = (await stabilityPool.getCompoundedLUSDDeposit(alice)).toString()
      console.log(`alice deposit: ${aliceDeposit}`)
      assert.equal(aliceDeposit, 0)
    })

    // --- Serial scale changes ---

    /* A make deposit 10000 LUSD
    L1 brings P to 0.0001P. L1:  9999.900000000000000000 LUSD, 1 ETH
    B makes deposit 9999.9, brings SP to 10k
    L2 decreases P by(~1e-5)P. L2:  9999.900000000000000000 LUSD, 1 ETH
    C makes deposit 9999.9, brings SP to 10k
    L3 decreases P by(~1e-5)P. L3:  9999.900000000000000000 LUSD, 1 ETH
    D makes deposit 9999.9, brings SP to 10k
    L4 decreases P by(~1e-5)P. L4:  9999.900000000000000000 LUSD, 1 ETH
    expect A, B, C, D each withdraw ~100 Ether
    */
    it("withdrawETHGainToTrove(): Several deposits of 10000 LUSD span one scale factor change. Depositors withdraws correct compounded deposit and ETH Gain after one liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale })

      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: alice})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: bob, })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: carol,  })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis, })
      
      // Defaulters 1-4 each withdraw 9999.9 LUSD
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount('9999900000000000000000'), dec(100, 'ether'), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount('9999900000000000000000'), dec(100, 'ether'), defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2,  })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount('9999900000000000000000'), dec(100, 'ether') , defaulter_3, defaulter_3, ZERO_ADDRESS, { from: defaulter_3,})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount('9999900000000000000000'), dec(100, 'ether') , defaulter_4, defaulter_4, ZERO_ADDRESS, { from: defaulter_4,  })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      await lusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 liquidated. 
      const txL1 = await troveManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 13)) // P decreases to 1e(18-5) = 1e13
      assert.equal(await stabilityPool.currentScale(), '0')

      // B deposits 9999.9 LUSD
      await lusdToken.transfer(bob, dec(99999, 17), { from: whale })
      await stabilityPool.provideToSP(dec(99999, 17), ZERO_ADDRESS, { from: bob })

      // Defaulter 2 liquidated
      const txL2 = await troveManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 17)) // Scale changes and P changes to 1e(13-5+9) = 1e17
      assert.equal(await stabilityPool.currentScale(), '1')

      // C deposits 9999.9 LUSD
      await lusdToken.transfer(carol, dec(99999, 17), { from: whale })
      await stabilityPool.provideToSP(dec(99999, 17), ZERO_ADDRESS, { from: carol })

      // Defaulter 3 liquidated
      const txL3 = await troveManager.liquidate(defaulter_3, { from: owner });
      assert.isTrue(txL3.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 12)) // P decreases to 1e(17-5) = 1e12
      assert.equal(await stabilityPool.currentScale(), '1')

      // D deposits 9999.9 LUSD
      await lusdToken.transfer(dennis, dec(99999, 17), { from: whale })
      await stabilityPool.provideToSP(dec(99999, 17), ZERO_ADDRESS, { from: dennis })

      // Defaulter 4 liquidated
      const txL4 = await troveManager.liquidate(defaulter_4, { from: owner });
      assert.isTrue(txL4.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 16)) // Scale changes and P changes to 1e(12-5+9) = 1e16
      assert.equal(await stabilityPool.currentScale(), '2')

      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: carol })
      const txD = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: dennis })

      const alice_ETHWithdrawn = await th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH').toString()
      const bob_ETHWithdrawn = await th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH').toString()
      const carol_ETHWithdrawn = await th.getEventArgByName(txC, 'ETHGainWithdrawn', '_ETH').toString()
      const dennis_ETHWithdrawn = await th.getEventArgByName(txD, 'ETHGainWithdrawn', '_ETH').toString()

      // A, B, C should retain 0 - their deposits have been completely used up
      assert.equal(await stabilityPool.getCompoundedLUSDDeposit(alice), '0')
      assert.equal(await stabilityPool.getCompoundedLUSDDeposit(alice), '0')
      assert.equal(await stabilityPool.getCompoundedLUSDDeposit(alice), '0')
      // D should retain around 0.9999 LUSD, since his deposit of 9999.9 was reduced by a factor of 1e-5
      assert.isAtMost(th.getDifference((await stabilityPool.getCompoundedLUSDDeposit(dennis)).toString(), dec(99999, 12)), 100000)

      // 99.5 ETH is offset at each L, 0.5 goes to gas comp
      // Each depositor gets ETH rewards of around 99.5 ETH. 1e17 error tolerance
      assert.isTrue(toBN(alice_ETHWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))))
      assert.isTrue(toBN(bob_ETHWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))))
      assert.isTrue(toBN(carol_ETHWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))))
      assert.isTrue(toBN(dennis_ETHWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))))
    })

    it("withdrawETHGainToTrove(): 2 depositors can withdraw after each receiving half of a pool-emptying liquidation", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)),  dec(100000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale})

      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: A})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: B })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: C })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: D })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: E})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(10000, 18)),  dec(10000, 'ether'), ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, { from: F })
      
      // Defaulters 1-3 each withdraw 24100, 24300, 24500 LUSD (inc gas comp)
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(24100, 18)), dec(200, 'ether') , defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1,})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(24300, 18)), dec(200, 'ether') , defaulter_2, defaulter_2, ZERO_ADDRESS, { from: defaulter_2,})
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(24500, 18)), dec(200, 'ether') , defaulter_3, defaulter_3, ZERO_ADDRESS, { from: defaulter_3, })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // A, B provide 10k LUSD 
      await lusdToken.transfer(A, dec(10000, 18), { from: whale })
      await lusdToken.transfer(B, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: A })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: B })

      // Defaulter 1 liquidated. SP emptied
      const txL1 = await troveManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)

      // Check compounded deposits
      const A_deposit = await stabilityPool.getCompoundedLUSDDeposit(A)
      const B_deposit = await stabilityPool.getCompoundedLUSDDeposit(B)
      // console.log(`A_deposit: ${A_deposit}`)
      // console.log(`B_deposit: ${B_deposit}`)
      assert.equal(A_deposit, '0')
      assert.equal(B_deposit, '0')

      // Check SP tracker is zero
      const LUSDinSP_1 = await stabilityPool.getTotalLUSDDeposits()
      // console.log(`LUSDinSP_1: ${LUSDinSP_1}`)
      assert.equal(LUSDinSP_1, '0')

      // Check SP LUSD balance is zero
      const SPLUSDBalance_1 = await lusdToken.balanceOf(stabilityPool.address)
      // console.log(`SPLUSDBalance_1: ${SPLUSDBalance_1}`)
      assert.equal(SPLUSDBalance_1, '0')

      // Attempt withdrawals
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: A })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: B })
      await priceFeed.setPrice(dec(100, 18))

      assert.isTrue(txA.receipt.status)
      assert.isTrue(txB.receipt.status)

      // ==========

      // C, D provide 10k LUSD 
      await lusdToken.transfer(C, dec(10000, 18), { from: whale })
      await lusdToken.transfer(D, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: C })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: D })

      // Defaulter 2 liquidated.  SP emptied
      const txL2 = await troveManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)

      // Check compounded deposits
      const C_deposit = await stabilityPool.getCompoundedLUSDDeposit(C)
      const D_deposit = await stabilityPool.getCompoundedLUSDDeposit(D)
      // console.log(`A_deposit: ${C_deposit}`)
      // console.log(`B_deposit: ${D_deposit}`)
      assert.equal(C_deposit, '0')
      assert.equal(D_deposit, '0')

      // Check SP tracker is zero
      const LUSDinSP_2 = await stabilityPool.getTotalLUSDDeposits()
      // console.log(`LUSDinSP_2: ${LUSDinSP_2}`)
      assert.equal(LUSDinSP_2, '0')

      // Check SP LUSD balance is zero
      const SPLUSDBalance_2 = await lusdToken.balanceOf(stabilityPool.address)
      // console.log(`SPLUSDBalance_2: ${SPLUSDBalance_2}`)
      assert.equal(SPLUSDBalance_2, '0')

      // Attempt withdrawals
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txC = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: C })
      const txD = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: D })
      await priceFeed.setPrice(dec(100, 18))

      assert.isTrue(txC.receipt.status)
      assert.isTrue(txD.receipt.status)

      // ============

      // E, F provide 10k LUSD 
      await lusdToken.transfer(E, dec(10000, 18), { from: whale })
      await lusdToken.transfer(F, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: E })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: F })

      // Defaulter 3 liquidated. SP emptied
      const txL3 = await troveManager.liquidate(defaulter_3, { from: owner });
      assert.isTrue(txL3.receipt.status)

      // Check compounded deposits
      const E_deposit = await stabilityPool.getCompoundedLUSDDeposit(E)
      const F_deposit = await stabilityPool.getCompoundedLUSDDeposit(F)
      // console.log(`E_deposit: ${E_deposit}`)
      // console.log(`F_deposit: ${F_deposit}`)
      assert.equal(E_deposit, '0')
      assert.equal(F_deposit, '0')

      // Check SP tracker is zero
      const LUSDinSP_3 = await stabilityPool.getTotalLUSDDeposits()
      assert.equal(LUSDinSP_3, '0')

      // Check SP LUSD balance is zero
      const SPLUSDBalance_3 = await lusdToken.balanceOf(stabilityPool.address)
      // console.log(`SPLUSDBalance_3: ${SPLUSDBalance_3}`)
      assert.equal(SPLUSDBalance_3, '0')

      // Attempt withdrawals
      const txE = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: E })
      const txF = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: F })
      assert.isTrue(txE.receipt.status)
      assert.isTrue(txF.receipt.status)
    })

    // --- Extreme values, confirm no overflows ---

    it("withdrawETHGainToTrove(): Large liquidated coll/debt, deposits and ETH price", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)),  dec(100000, 'ether'), whale, whale, ZERO_ADDRESS, { from: whale })

      // ETH:USD price is $2 billion per ETH
      await priceFeed.setPrice(dec(2, 27));

      const depositors = [alice, bob]
      for (account of depositors) {
        await borrowerOperations.openTrove(th._100pct, dec(1, 36), dec(2, 27), account, account, ZERO_ADDRESS, { from: account })
        await stabilityPool.provideToSP(dec(1, 36), ZERO_ADDRESS, { from: account })
      }

      // Defaulter opens trove with 200% ICR
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(1, 36)),  dec(1, 27), defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })

      // ETH:USD price drops to $1 billion per ETH
      await priceFeed.setPrice(dec(1, 27));

      // Defaulter liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });

      const txA = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txB = await stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })

      // Grab the ETH gain from the emitted event in the tx log
      const alice_ETHWithdrawn = th.getEventArgByName(txA, 'ETHGainWithdrawn', '_ETH')
      const bob_ETHWithdrawn = th.getEventArgByName(txB, 'ETHGainWithdrawn', '_ETH')

      // Check LUSD balances
      const aliceLUSDBalance = await stabilityPool.getCompoundedLUSDDeposit(alice)
      const aliceExpectedLUSDBalance = web3.utils.toBN(dec(5, 35))
      const aliceLUSDBalDiff = aliceLUSDBalance.sub(aliceExpectedLUSDBalance).abs()

      assert.isTrue(aliceLUSDBalDiff.lte(toBN(dec(1, 18)))) // error tolerance of 1e18

      const bobLUSDBalance = await stabilityPool.getCompoundedLUSDDeposit(bob)
      const bobExpectedLUSDBalance = toBN(dec(5, 35))
      const bobLUSDBalDiff = bobLUSDBalance.sub(bobExpectedLUSDBalance).abs()

      assert.isTrue(bobLUSDBalDiff.lte(toBN(dec(1, 18))))

      // Check ETH gains
      const aliceExpectedETHGain = toBN(dec(4975, 23))
      const aliceETHDiff = aliceExpectedETHGain.sub(toBN(alice_ETHWithdrawn))

      assert.isTrue(aliceETHDiff.lte(toBN(dec(1, 18))))

      const bobExpectedETHGain = toBN(dec(4975, 23))
      const bobETHDiff = bobExpectedETHGain.sub(toBN(bob_ETHWithdrawn))

      assert.isTrue(bobETHDiff.lte(toBN(dec(1, 18))))
    })

    it("withdrawETHGainToTrove(): Small liquidated coll/debt, large deposits and ETH price", async () => {
      // Whale opens Trove with 100k ETH
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(100000, 18)), dec(100000, 'ether') , whale, whale, ZERO_ADDRESS, { from: whale})

      // ETH:USD price is $2 billion per ETH
      await priceFeed.setPrice(dec(2, 27));
      const price = await priceFeed.getPrice()

      const depositors = [alice, bob]
      for (account of depositors) {
        await borrowerOperations.openTrove(th._100pct, dec(1, 38),  dec(2, 29), account, account, ZERO_ADDRESS, { from: account })
        await stabilityPool.provideToSP(dec(1, 38), ZERO_ADDRESS, { from: account })
      }

      // Defaulter opens trove with 50e-7 ETH and  5000 LUSD. 200% ICR
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveLUSDAmount(dec(5000, 18)), '5000000000000' , defaulter_1, defaulter_1, ZERO_ADDRESS, { from: defaulter_1 })
      
      // ETH:USD price drops to $1 billion per ETH
      await priceFeed.setPrice(dec(1, 27));

      // Defaulter liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });

      const txAPromise = stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: alice })
      const txBPromise = stabilityPool.withdrawETHGainToTrove(ZERO_ADDRESS, ZERO_ADDRESS, { from: bob })

      // Expect ETH gain per depositor of ~1e11 wei to be rounded to 0 by the ETHGainedPerUnitStaked calculation (e / D), where D is ~1e36.
      await th.assertRevert(txAPromise, 'StabilityPool: caller must have non-zero ETH Gain')
      await th.assertRevert(txBPromise, 'StabilityPool: caller must have non-zero ETH Gain')

      const aliceLUSDBalance = await stabilityPool.getCompoundedLUSDDeposit(alice)
      // const aliceLUSDBalance = await lusdToken.balanceOf(alice)
      const aliceExpectedLUSDBalance = toBN('99999999999999997500000000000000000000')
      const aliceLUSDBalDiff = aliceLUSDBalance.sub(aliceExpectedLUSDBalance).abs()

      assert.isTrue(aliceLUSDBalDiff.lte(toBN(dec(1, 18))))

      const bobLUSDBalance = await stabilityPool.getCompoundedLUSDDeposit(bob)
      const bobExpectedLUSDBalance = toBN('99999999999999997500000000000000000000')
      const bobLUSDBalDiff = bobLUSDBalance.sub(bobExpectedLUSDBalance).abs()

      assert.isTrue(bobLUSDBalDiff.lte(toBN('100000000000000000000')))
    })
  })
})

contract('Reset chain state', async accounts => { })
