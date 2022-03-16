// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Dependencies/IERC20.sol";
import "./Dependencies/IUniswapPairOracle.sol";
import "./Dependencies/LiquityMath.sol";
import "./Dependencies/TransferableOwnable.sol";
import "./Interfaces/IBurnableERC20.sol";
import "./Interfaces/IGovernance.sol";
import "./Dependencies/ISimpleERCFund.sol";

/*
 * The Default Pool holds the ETH and LUSD debt (but not LUSD tokens) from liquidations that have been redistributed
 * to active troves but not yet "applied", i.e. not yet recorded on a recipient active trove's struct.
 *
 * When a trove makes an operation that applies its pending ETH and LUSD debt, its pending ETH and LUSD debt is moved
 * from the Default Pool to the Active Pool.
 */
contract Governance is TransferableOwnable, IGovernance {
    using SafeMath for uint256;

    string public NAME = "Governance";
    uint256 public _100pct = 1000000000000000000; // 1e18 == 100%

    address public  troveManagerAddress;
    address public  borrowerOperationAddress;

    // Maximum amount of debt that this deployment can have (used to limit exposure to volatile assets)
    // set this according to how much ever debt we'd like to accumulate; default is infinity
    bool private allowMinting = true;

    // MAHA; the governance token used for charging stability fees
    IBurnableERC20 private stabilityFeeToken;

    // price feed
    IPriceFeed private priceFeed;

    // The fund which recieves all the fees.
    ISimpleERCFund private fund;

    IUniswapPairOracle private stabilityTokenPairOracle;

    uint256 private maxDebtCeiling = uint256(-1); // infinity
    uint256 private stabilityFee = 10000000000000000; // 1%

    uint256 private DEPLOYMENT_START_TIME;

    event AllowMintingChanged(bool oldFlag, bool newFlag, uint256 timestamp);
    event StabilityFeeChanged(uint256 oldValue, uint256 newValue, uint256 timestamp);
    event PriceFeedChanged(address oldAddress, address newAddress, uint256 timestamp);
    event MaxDebtCeilingChanged(uint256 oldValue, uint256 newValue, uint256 timestamp);
    event StabilityFeeTokenChanged(address oldAddress, address newAddress, uint256 timestamp);
    event StabilityTokenPairOracleChanged(address oldAddress, address newAddress, uint256 timestamp);
    event StabilityFeeCharged(uint256 LUSDAmount, uint256 feeAmount, uint256 timestamp);
    event FundAddressChanged(address oldAddress, address newAddress, uint256 timestamp);
    event SentToFund(address token, uint256 amount, uint256 timestamp, string reason);
     event SetMCR(uint256 oldValue, uint256 newValue, uint256 timestamp);
    event SetCCR(uint256 oldValue, uint256 newValue, uint256 timestamp);
    event SetLUSDGasCompensation(uint256 oldValue, uint256 newValue, uint256 timestamp);
    event SetMinNetDebt(uint256 oldValue, uint256 newValue, uint256 timestamp);
    event SetBorrowingFeeFloor(uint256 oldValue, uint256 newValue, uint256 timestamp);
    event SetMaxBorrowingFee(uint256 oldValue, uint256 newValue, uint256 timestamp);
    event SetRedemptionFeeFloor(uint256 oldValue, uint256 newValue, uint256 timestamp);

    uint256 public DECIMAL_PRECISION = 1e18;
    uint256 public PERCENT_DIVISOR = 200; // dividing by 200 yields 0.5%
    uint256 public override MCR = 1100000000000000000; // 110%
    uint256 public override CCR = 1500000000000000000; // 150%
    uint256 public override LUSD_GAS_COMPENSATION = 5e18;
    uint256 public override MIN_NET_DEBT = 250e18;
    uint256 public override BORROWING_FEE_FLOOR = (DECIMAL_PRECISION / 1000) * 5; // 0.5%
    uint256 public override MAX_BORROWING_FEE = (DECIMAL_PRECISION / 100) * 5; // 5%
    uint256 public override REDEMPTION_FEE_FLOOR = (DECIMAL_PRECISION / 1000) * 5;

    bool public initialized = false;

    function initialize(address _troveManagerAddress, address _borrowerOperationAddress) external {
        require(!initialized, 'Contract already initialized');

        troveManagerAddress = _troveManagerAddress;
        borrowerOperationAddress = _borrowerOperationAddress;
        DEPLOYMENT_START_TIME = block.timestamp;

        address msgSender = _msgSender();
        _owner = msgSender;
        emit OwnershipTransferred(address(0), msgSender);

        NAME = "Governance";
        _100pct = 1000000000000000000; // 1e18 == 100%
        allowMinting = true;
        maxDebtCeiling = uint256(-1); // infinity
        stabilityFee = 10000000000000000; // 1%
        DECIMAL_PRECISION = 1e18;
        PERCENT_DIVISOR = 200; // dividing by 200 yields 0.5%
        MCR = 1100000000000000000; // 110%
        CCR = 1500000000000000000; // 150%
        LUSD_GAS_COMPENSATION = 5e18;
        MIN_NET_DEBT = 250e18;
        BORROWING_FEE_FLOOR = (DECIMAL_PRECISION / 1000) * 5; // 0.5%
        MAX_BORROWING_FEE = (DECIMAL_PRECISION / 100) * 5; // 5%
        REDEMPTION_FEE_FLOOR = (DECIMAL_PRECISION / 1000) * 5;
        initialized = false;
        
        initialized = true;
    }

    function setRedemptionFeeFloor(uint256 value) external override onlyOwner {
        uint256 oldValue = REDEMPTION_FEE_FLOOR;
        REDEMPTION_FEE_FLOOR = value;
        emit SetRedemptionFeeFloor(oldValue, value, block.timestamp);
    }

    function setMaxBorrowingFee(uint256 value) external override onlyOwner {
        uint256 oldValue = MAX_BORROWING_FEE;
        MAX_BORROWING_FEE = value;
        emit SetMaxBorrowingFee(oldValue, value, block.timestamp);
    }

    function setBorrowingFeeFloor(uint256 value) external override onlyOwner {
        uint256 oldValue = BORROWING_FEE_FLOOR;
        BORROWING_FEE_FLOOR = value;
        emit SetBorrowingFeeFloor(oldValue, value, block.timestamp);
    }

    function setLUSDGasCompensation(uint256 value) external override onlyOwner {
        uint256 oldValue = LUSD_GAS_COMPENSATION;
        LUSD_GAS_COMPENSATION = value;
        emit SetLUSDGasCompensation(oldValue, value, block.timestamp);
    }

    function setMinNetDebt(uint256 value) external override onlyOwner {
        uint256 oldValue = MIN_NET_DEBT;
        MIN_NET_DEBT = value;
        emit SetMinNetDebt(oldValue, value, block.timestamp);
    }

    function setMCR(uint256 value) external override onlyOwner {
        uint256 oldValue = MCR;
        MCR = value;
        emit SetMCR(oldValue, value, block.timestamp);
    }

    function setCCR(uint256 value) external override onlyOwner {
        uint256 oldValue = CCR;
        CCR = value;
        emit SetCCR(oldValue, value, block.timestamp);
    }
    
    function setMaxDebtCeiling(uint256 _value) public onlyOwner {
        uint256 oldValue = maxDebtCeiling;
        maxDebtCeiling = _value;
        emit MaxDebtCeilingChanged(oldValue, _value, block.timestamp);
    }

    function setFund(address _newFund) public onlyOwner {
        address oldAddress = address(fund);
        fund = ISimpleERCFund(_newFund);
        emit FundAddressChanged(oldAddress, _newFund, block.timestamp);
    }

    function setPriceFeed(address _feed) public onlyOwner {
        address oldAddress = address(priceFeed);
        priceFeed = IPriceFeed(_feed);
        emit PriceFeedChanged(oldAddress, _feed, block.timestamp);
    }

    function setAllowMinting(bool _value) public onlyOwner {
        bool oldFlag = allowMinting;
        allowMinting = _value;
        emit AllowMintingChanged(oldFlag, _value, block.timestamp);
    }

    function setStabilityFee(uint256 _value) public onlyOwner {
        uint256 oldValue = stabilityFee;
        stabilityFee = _value;
        emit StabilityFeeChanged(oldValue, _value, block.timestamp);
    }

    function setStabilityFeeToken(address token, IUniswapPairOracle oracle) public onlyOwner {
        address oldAddress = address(stabilityFeeToken);
        stabilityFeeToken = IBurnableERC20(token);
        emit StabilityFeeTokenChanged(oldAddress, address(token), block.timestamp);

        oldAddress = address(stabilityTokenPairOracle);
        stabilityTokenPairOracle = oracle;
        emit StabilityTokenPairOracleChanged(oldAddress, address(oracle), block.timestamp);
    }

    function getDeploymentStartTime() external view override returns (uint256) {
        return DEPLOYMENT_START_TIME;
    }

    function getMaxDebtCeiling() external view override returns (uint256) {
        return maxDebtCeiling;
    }

    function getFund() external view override returns (ISimpleERCFund) {
        return fund;
    }

    function getStabilityFee() external view override returns (uint256) {
        return stabilityFee;
    }

    function getStabilityTokenPairOracle() external view override returns (IUniswapPairOracle) {
        return stabilityTokenPairOracle;
    }

    function getAllowMinting() external view override returns (bool) {
        return allowMinting;
    }

    function getStabilityFeeToken() external view override returns (IERC20) {
        return stabilityFeeToken;
    }

    function getPriceFeed() external view override returns (IPriceFeed) {
        return priceFeed;
    }

    function chargeStabilityFee(address who, uint256 LUSDAmount) external override {
        _requireCallerIsTroveManager();

        if (
            address(stabilityTokenPairOracle) == address(0) ||
            address(stabilityFeeToken) == address(0)
        ) return;

        uint256 stabilityFeeInLUSD = LUSDAmount.mul(stabilityFee).div(_100pct);
        uint256 stabilityTokenPriceInLUSD = stabilityTokenPairOracle.consult(
            address(stabilityFeeToken),
            1e18
        );
        uint256 _stabilityFee = stabilityFeeInLUSD.mul(1e18).div(stabilityTokenPriceInLUSD);

        if (stabilityFee > 0) {
            stabilityFeeToken.burnFrom(who, _stabilityFee);
            emit StabilityFeeCharged(LUSDAmount, _stabilityFee, block.timestamp);
        }
    }

    // Amount of tokens have to be transferred to this addr before calling this func.
    function sendToFund(
        address token,
        uint256 amount,
        string memory reason
    ) external override {
        _requireCallerIsBOorTroveM();

        IERC20(token).approve(address(fund), amount);
        fund.deposit(token, amount, reason);
        emit SentToFund(token, amount, block.timestamp, reason);
    }

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == troveManagerAddress, "Governance: Caller is not TroveManager");
    }

    function _requireCallerIsBOorTroveM() internal view {
        require(
            msg.sender == borrowerOperationAddress || msg.sender == troveManagerAddress,
            "Governance: Caller is neither BorrowerOperations nor TroveManager"
        );
    }
}
