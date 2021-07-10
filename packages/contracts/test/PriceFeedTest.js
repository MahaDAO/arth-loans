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

    it("Should work fine with chainlink price = 9.4323412", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(toBN(9.4323412e8))

        assert.equal(await priceFeed.fetchPrice.call(), '9432341200000000000')
    })

    it("Should work fine with chainlink price = 10", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(dec(10, 8))

        assert.equal(await priceFeed.fetchPrice.call(), '10000000000000000000')
    })

    it("Should work fine with chainlink price = 50", async () => {
        await mockChainlink.setDecimals(8)
        await mockChainlink.setPrice(dec(50, 8))

        assert.equal(await priceFeed.fetchPrice.call(), '50000000000000000000')
    })
  })
})