const PriceFeed = artifacts.require("./PriceFeedTester.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const MockChainlink = artifacts.require("./MockAggregator.sol")
const GMUOracle = artifacts.require("./GMUOracle.sol")

const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper

const { dec, assertRevert, toBN } = th

contract('PriceFeed', async accounts => {

  const [owner, alice] = accounts;
  let priceFeedTestnet
  let priceFeed
  let gmuOracle
  let zeroAddressPriceFeed
  let mockChainlink

  const setAddresses = async () => {
    await priceFeed.setAddresses(mockChainlink.address, gmuOracle.address, { from: owner })
  }

  beforeEach(async () => {
    priceFeedTestnet = await PriceFeedTestnet.new()
    PriceFeedTestnet.setAsDeployed(priceFeedTestnet)

    priceFeed = await PriceFeed.new()
    PriceFeed.setAsDeployed(priceFeed)

    zeroAddressPriceFeed = await PriceFeed.new()
    PriceFeed.setAsDeployed(zeroAddressPriceFeed)

    mockChainlink = await MockChainlink.new()
    MockChainlink.setAsDeployed(mockChainlink)

    gmuOracle = await GMUOracle.new(1e6)
    GMUOracle.setAsDeployed(gmuOracle)

    // Set Chainlink latest and prev round Id's to non-zero
    await mockChainlink.setLatestRoundId(3)
    await mockChainlink.setPrevRoundId(2)

    // Set current and prev prices in both oracles
    await mockChainlink.setPrice(dec(100, 18))
    await mockChainlink.setPrevPrice(dec(100, 18))

    // Set mock price updateTimes in both oracles to very recent
    const now = await th.getLatestBlockTimestamp(web3)
    await mockChainlink.setUpdateTime(now)
  })

  describe('PriceFeed internal testing contract', async accounts => {
    it("fetchPrice before setPrice should return the default price", async () => {
      const price = await priceFeedTestnet.getPrice()
      assert.equal(price, dec(200, 18))
    })

    it("should be able to fetchPrice after setPrice, output of former matching input of latter", async () => {
      await priceFeedTestnet.setPrice(dec(100, 18))
      const price = await priceFeedTestnet.getPrice()
      assert.equal(price, dec(100, 18))
    })
  })

  describe('Mainnet PriceFeed setup', async accounts => {
    it("fetchPrice should fail on contract with no chainlink address set", async () => {
      try {
        const price = await zeroAddressPriceFeed.fetchPrice()
        assert.isFalse(price.receipt.status)
      } catch (err) {
        assert.include(err.message, "function call to a non-contract account")
      }
    })

    it("fetchPrice should fail on contract with no gmu address set", async () => {
      try {
        const price = await zeroAddressPriceFeed.fetchPrice()
        assert.isFalse(price.receipt.status)
      } catch (err) {
        assert.include(err.message, "function call to a non-contract account")
      }
    })

    it("setAddresses should fail whe called by nonOwner", async () => {
      await assertRevert(
        priceFeed.setAddresses(mockChainlink.address, gmuOracle.address, { from: alice }),
        "Ownable: caller is not the owner"
      )
    })

    it("setAddresses should fail after address has already been set", async () => {
      // Owner can successfully set any address
      const txOwner = await priceFeed.setAddresses(mockChainlink.address, gmuOracle.address, { from: owner })
      assert.isTrue(txOwner.receipt.status)

      await assertRevert(
        priceFeed.setAddresses(mockChainlink.address, gmuOracle.address, { from: owner }),
        "Ownable: caller is not the owner"
      )

      await assertRevert(
        priceFeed.setAddresses(mockChainlink.address, gmuOracle.address, { from: alice }),
        "Ownable: caller is not the owner"
      )
    })
  })

  describe('- Different chainlink decimal precisions and GMU/USD = 1', async () => {
    beforeEach(async () => {
        await setAddresses()
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 8 decimals", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.5e8))

        assert.equal(await priceFeed.fetchPrice.call(), '500000000000000000')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 7 decimals", async () => {
        await mockChainlink.setDecimals(7)
        await mockChainlink.setPrice(toBN(0.5e7))

        assert.equal(await priceFeed.fetchPrice.call(), '500000000000000000')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 9 decimals", async () => {
        await mockChainlink.setDecimals(9)
        await mockChainlink.setPrice(toBN(0.5e9))

        assert.equal(await priceFeed.fetchPrice.call(), '500000000000000000')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 18 decimals", async () => {
        await mockChainlink.setDecimals(18)
        await mockChainlink.setPrice(toBN(0.5e18))

        assert.equal(await priceFeed.fetchPrice.call(), '500000000000000000')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 20 decimals", async () => {
        await mockChainlink.setDecimals(20)
        await mockChainlink.setPrice(toBN(0.5e20))

        assert.equal(await priceFeed.fetchPrice.call(), '500000000000000000')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 22 decimals", async () => {
        await mockChainlink.setDecimals(22)
        await mockChainlink.setPrice(dec(5, 21))

        assert.equal(await priceFeed.fetchPrice.call(), '500000000000000000')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 8 decimals", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(dec(1, 8))

        assert.equal(await priceFeed.fetchPrice.call(), '1000000000000000000')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 7 decimals", async () => {
        await mockChainlink.setDecimals(7)
        await mockChainlink.setPrice(dec(1, 7))

        assert.equal(await priceFeed.fetchPrice.call(), '1000000000000000000')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 9 decimals", async () => {
        await mockChainlink.setDecimals(9)
        await mockChainlink.setPrice(dec(1, 9))

        assert.equal(await priceFeed.fetchPrice.call(), '1000000000000000000')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 18 decimals", async () => {
        await mockChainlink.setDecimals(18)
        await mockChainlink.setPrice(dec(1, 18))

        assert.equal(await priceFeed.fetchPrice.call(), '1000000000000000000')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 20 decimals", async () => {
        await mockChainlink.setDecimals(20)
        await mockChainlink.setPrice(dec(1, 20))

        assert.equal(await priceFeed.fetchPrice.call(), '1000000000000000000')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 22 decimals", async () => {
        await mockChainlink.setDecimals(22)
        await mockChainlink.setPrice(dec(1, 22))

        assert.equal(await priceFeed.fetchPrice.call(), '1000000000000000000')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 7 decimals", async () => {
        await mockChainlink.setDecimals(7)
        await mockChainlink.setPrice(dec(10, 7))

        assert.equal(await priceFeed.fetchPrice.call(), '10000000000000000000')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 8 decimals", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(dec(10, 8))

        assert.equal(await priceFeed.fetchPrice.call(), '10000000000000000000')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 9 decimals", async () => {
        await mockChainlink.setDecimals(9)
        await mockChainlink.setPrice(dec(10, 9))

        assert.equal(await priceFeed.fetchPrice.call(), '10000000000000000000')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 18 decimals", async () => {
        await mockChainlink.setDecimals(18)
        await mockChainlink.setPrice(dec(10, 18))

        assert.equal(await priceFeed.fetchPrice.call(), '10000000000000000000')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 20 decimals", async () => {
        await mockChainlink.setDecimals(20)
        await mockChainlink.setPrice(dec(10, 20))

        assert.equal(await priceFeed.fetchPrice.call(), '10000000000000000000')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 22 decimals", async () => {
        await mockChainlink.setDecimals(22)
        await mockChainlink.setPrice(dec(10, 22))

        assert.equal(await priceFeed.fetchPrice.call(), '10000000000000000000')
    })
  })

  describe('- Different chainlink decimal precisions and GMU/USD != 1', async () => {
    beforeEach(async () => {
        await setAddresses()
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 8 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.5e8))
        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '44523597506678539')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 8 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.5e8))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '2173913043478260869')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 7 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(7)
        await mockChainlink.setPrice(toBN(0.5e7))
        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '44523597506678539')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 7 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(7)
        await mockChainlink.setPrice(toBN(0.5e7))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '2173913043478260869')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 9 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(9)
        await mockChainlink.setPrice(toBN(0.5e9))
        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '44523597506678539')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 9 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(9)
        await mockChainlink.setPrice(toBN(0.5e9))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '2173913043478260869')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 20 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(20)
        await mockChainlink.setPrice(toBN(0.5e20))
        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '44523597506678539')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 20 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(20)
        await mockChainlink.setPrice(toBN(0.5e20))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '2173913043478260869')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 22 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(22)
        await mockChainlink.setPrice(dec(5, 21))
        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '44523597506678539')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 22 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(22)
        await mockChainlink.setPrice(dec(5, 21))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '2173913043478260869')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 18 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(18)
        await mockChainlink.setPrice(dec(5, 17))
        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '44523597506678539')
    })

    it("Should work fine with chainlink price = 0.5, chainlink decimals = 18 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(18)
        await mockChainlink.setPrice(dec(5, 17))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '2173913043478260869')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 8 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(dec(1, 8))
        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '89047195013357079')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 8 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(dec(1, 8))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '4347826086956521739')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 7 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(7)
        await mockChainlink.setPrice(dec(1, 7))
        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '89047195013357079')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 7 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(7)
        await mockChainlink.setPrice(dec(1, 7))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '4347826086956521739')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 9 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(9)
        await mockChainlink.setPrice(dec(1, 9))
        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '89047195013357079')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 9 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(9)
        await mockChainlink.setPrice(dec(1, 9))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '4347826086956521739')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 18 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(18)
        await mockChainlink.setPrice(dec(1, 18))
        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '89047195013357079')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 18 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(18)
        await mockChainlink.setPrice(dec(1, 18))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '4347826086956521739')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 20 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(20)
        await mockChainlink.setPrice(dec(1, 20))
        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '89047195013357079')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 20 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(20)
        await mockChainlink.setPrice(dec(1, 20))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '4347826086956521739')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 22 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(22)
        await mockChainlink.setPrice(dec(1, 22))
        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '89047195013357079')
    })

    it("Should work fine with chainlink price = 1, chainlink decimals = 22 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(22)
        await mockChainlink.setPrice(dec(1, 22))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '4347826086956521739')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 7 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(7)
        await mockChainlink.setPrice(dec(10, 7))
        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '890471950133570792')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 7 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(7)
        await mockChainlink.setPrice(dec(10, 7))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '43478260869565217391')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 8 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(dec(10, 8))
        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '890471950133570792')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 8 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(dec(10, 8))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '43478260869565217391')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 9 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(9)
        await mockChainlink.setPrice(dec(10, 9))

        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '890471950133570792')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 9 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(9)
        await mockChainlink.setPrice(dec(10, 9))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '43478260869565217391')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 18 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(18)
        await mockChainlink.setPrice(dec(10, 18))

        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '890471950133570792')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 18 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(18)
        await mockChainlink.setPrice(dec(10, 18))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '43478260869565217391')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 20 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(20)
        await mockChainlink.setPrice(dec(10, 20))

        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '890471950133570792')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 20 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(20)
        await mockChainlink.setPrice(dec(10, 20))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '43478260869565217391')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 22 decimals & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(22)
        await mockChainlink.setPrice(dec(10, 22))

        await gmuOracle.setPrice(11.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '890471950133570792')
    })

    it("Should work fine with chainlink price = 10, chainlink decimals = 22 decimals & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(22)
        await mockChainlink.setPrice(dec(10, 22))
        await gmuOracle.setPrice(0.23e6)

        assert.equal(await priceFeed.fetchPrice.call(), '43478260869565217391')
    })
  })

  describe('- Different chainlink values and GMU/USD = 1', async () => {
    beforeEach(async () => {
        await setAddresses()
    })

    it("Should work fine with chainlink price = 0.5", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.5e8))

        assert.equal(await priceFeed.fetchPrice.call(), '500000000000000000')
    })

    it("Should work fine with chainlink price = 0.35", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.35e8))

        assert.equal(await priceFeed.fetchPrice.call(), '350000000000000000')
    })

    it("Should work fine with chainlink price = 0.95", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.95e8))

        assert.equal(await priceFeed.fetchPrice.call(), '950000000000000000')
    })

    it("Should work fine with chainlink price = 0.878778", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.878778e8))

        assert.equal(await priceFeed.fetchPrice.call(), '878778000000000000')
    })

    it("Should work fine with chainlink price = 0.943234", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.943234e8))

        assert.equal(await priceFeed.fetchPrice.call(), '943234000000000000')
    })

    it("Should work fine with chainlink price = 0.94323412", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.94323412e8))

        assert.equal(await priceFeed.fetchPrice.call(), '943234120000000000')
    })

    it("Should work fine with chainlink price = 8.78778", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(8.78778e8))

        assert.equal(await priceFeed.fetchPrice.call(), '8787780000000000000')
    })

    it("Should work fine with chainlink price = 8.787789", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(8.787789e8))

        assert.equal(await priceFeed.fetchPrice.call(), '8787789000000000000')
    })

    it("Should work fine with chainlink price = 9.4323412", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(9.4323412e8))

        assert.equal(await priceFeed.fetchPrice.call(), '9432341200000000000')
    })

    it("Should work fine with chainlink price = 9.43234127", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(9.43234127e8))

        assert.equal(await priceFeed.fetchPrice.call(), '9432341270000000000')
    })

    it("Should work fine with chainlink price = 10", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(dec(10, 8))

        assert.equal(await priceFeed.fetchPrice.call(), '10000000000000000000')
    })

    it("Should work fine with chainlink price = 11.23", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(11.23e8))

        assert.equal(await priceFeed.fetchPrice.call(), '11230000000000000000')
    })

    it("Should work fine with chainlink price = 50", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(dec(50, 8))

        assert.equal(await priceFeed.fetchPrice.call(), '50000000000000000000')
    })
  })

  describe('- Different chainlink values and GMU/USD != 1', async () => {
    beforeEach(async () => {
        await setAddresses()
    })

    it("Should work fine with chainlink price = 0.5 & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.5e8))
        await gmuOracle.setPrice(toBN(11.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '44523597506678539')
    })

    it("Should work fine with chainlink price = 0.5 & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.5e8))
        await gmuOracle.setPrice(toBN(1.92e6))

        assert.equal(await priceFeed.fetchPrice.call(), '260416666666666666')
    })

    it("Should work fine with chainlink price = 0.5 & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.5e8))
        await gmuOracle.setPrice(toBN(.92e6))

        assert.equal(await priceFeed.fetchPrice.call(), '543478260869565217')
    })

    it("Should work fine with chainlink price = 0.5 & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.5e8))
        await gmuOracle.setPrice(toBN(0.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '2173913043478260869')
    })

    it("Should work fine with chainlink price = 0.35 & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.35e8))
        await gmuOracle.setPrice(toBN(11.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '31166518254674977')
    })

    it("Should work fine with chainlink price = 0.35 & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.35e8))
        await gmuOracle.setPrice(toBN(0.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '1521739130434782608')
    })

    it("Should work fine with chainlink price = 0.95 & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.95e8))
        await gmuOracle.setPrice(toBN(11.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '84594835262689225')
    })

    it("Should work fine with chainlink price = 0.95 & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.95e8))
        await gmuOracle.setPrice(toBN(0.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '4130434782608695652')
    })

    it("Should work fine with chainlink price = 0.878778 & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.878778e8))
        await gmuOracle.setPrice(toBN(11.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '78252715939447907')
    })

    it("Should work fine with chainlink price = 0.878778 & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.878778e8))
        await gmuOracle.setPrice(toBN(0.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '3820773913043478260')
    })

    it("Should work fine with chainlink price = 0.94323412 & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.94323412e8))
        await gmuOracle.setPrice(toBN(11.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '83992352626892252')
    })

    it("Should work fine with chainlink price = 0.94323412 & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.94323412e8))
        await gmuOracle.setPrice(toBN(1.92e6))

        assert.equal(await priceFeed.fetchPrice.call(), '491267770833333333')
    })

    it("Should work fine with chainlink price = 0.94323412 & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.94323412e8))
        await gmuOracle.setPrice(toBN(0.92e6))

        assert.equal(await priceFeed.fetchPrice.call(), '1025254478260869565')
    })

    it("Should work fine with chainlink price = 0.94323412 & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(0.94323412e8))
        await gmuOracle.setPrice(toBN(0.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '4101017913043478260')
    })

    it("Should work fine with chainlink price = 8.78778 & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(8.78778e8))
        await gmuOracle.setPrice(toBN(11.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '782527159394479073')
    })

    it("Should work fine with chainlink price = 8.78778 & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(8.78778e8))
        await gmuOracle.setPrice(toBN(0.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '38207739130434782608')
    })

    it("Should work fine with chainlink price = 8.787789 & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(8.787789e8))
        await gmuOracle.setPrice(toBN(11.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '782527960819234194')
    })

    it("Should work fine with chainlink price = 8.787789 & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(8.787789e8))
        await gmuOracle.setPrice(toBN(0.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '38207778260869565217')
    })

    it("Should work fine with chainlink price = 9.4323412 & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(9.4323412e8))
        await gmuOracle.setPrice(toBN(11.23e6))
        
        assert.equal(await priceFeed.fetchPrice.call(), '839923526268922528')
    })

    it("Should work fine with chainlink price = 9.4323412 & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(9.4323412e8))
        await gmuOracle.setPrice(toBN(1.92e6))
        
        assert.equal(await priceFeed.fetchPrice.call(), '4912677708333333333')
    })

    it("Should work fine with chainlink price = 9.4323412 & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(9.4323412e8))
        await gmuOracle.setPrice(toBN(0.92e6))
        
        assert.equal(await priceFeed.fetchPrice.call(), '10252544782608695652')
    })

    it("Should work fine with chainlink price = 9.4323412 & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(9.4323412e8))
        await gmuOracle.setPrice(toBN(0.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '41010179130434782608')
    })

    it("Should work fine with chainlink price = 9.43234127 & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(9.43234127e8))
        await gmuOracle.setPrice(toBN(11.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '839923532502226179')
    })

    it("Should work fine with chainlink price = 9.43234127 & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(9.43234127e8))
        await gmuOracle.setPrice(toBN(0.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '41010179434782608695')
    })

    it("Should work fine with chainlink price = 10 & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(dec(10, 8))
        await gmuOracle.setPrice(toBN(11.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '890471950133570792')
    })

    it("Should work fine with chainlink price = 10 & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(dec(10, 8))
        await gmuOracle.setPrice(toBN(0.23e6))

        assert.equal(await priceFeed.fetchPrice.call(), '43478260869565217391')
    })

    it("Should work fine with chainlink price = 11.23 & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(11.23e8))
        await gmuOracle.setPrice(toBN(14.453e6))

        assert.equal(await priceFeed.fetchPrice.call(), '777001314605964159')
    })

    it("Should work fine with chainlink price = 11.23 & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(11.23e8))
        await gmuOracle.setPrice(toBN(0.573e6))

        assert.equal(await priceFeed.fetchPrice.call(), '19598603839441535776')
    })

    it("Should work fine with chainlink price = 50 & GMU/USD > 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(dec(50, 8))
        await gmuOracle.setPrice(toBN(14.453e6))

        assert.equal(await priceFeed.fetchPrice.call(), '3459489379367605341')
    })

    it("Should work fine with chainlink price = 50 & GMU/USD < 1", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(dec(50, 8))
        await gmuOracle.setPrice(toBN(0.453e6))

        assert.equal(await priceFeed.fetchPrice.call(), '110375275938189845474')
    })
  })
})