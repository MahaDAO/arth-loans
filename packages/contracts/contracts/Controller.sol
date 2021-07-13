// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IController.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/console.sol";
import "./Interfaces/IGovernance.sol";
import "./Dependencies/IARTH.sol";

contract Controller is CheckContract, IController {
    using SafeMath for uint256;
    
    IARTH public arth;
    IGovernance public governance;

    uint256 private _totalDebt;
    
    string constant public NAME = "Core controller";
    
    // --- Addresses ---
    address public immutable troveManagerAddress;
    address public immutable stabilityPoolAddress;
    address public immutable borrowerOperationsAddress;
    
    // --- Events ---
    event ARTHAddressChanged(address _arthAddress);
    event DebtAdded(uint256 amount, uint256 timestamp);
    event DebtReduced(uint256 amount, uint256 timestamp);
    event GovernanceAddressChanged(address _governanceAddress);
    event TroveManagerAddressChanged(address _troveManagerAddress);
    event StabilityPoolAddressChanged(address _newStabilityPoolAddress);
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);

    constructor
    ( 
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _borrowerOperationsAddress,
        address _governanceAddress,
        address _arthAddress
    ) 
        public 
    {  
        checkContract(_troveManagerAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_borrowerOperationsAddress);
        checkContract(_governanceAddress);
        checkContract(_arthAddress);

        arth = IARTH(_arthAddress);
        emit ARTHAddressChanged(_arthAddress);

        troveManagerAddress = _troveManagerAddress;
        emit TroveManagerAddressChanged(_troveManagerAddress);

        stabilityPoolAddress = _stabilityPoolAddress;
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);

        borrowerOperationsAddress = _borrowerOperationsAddress;        
        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        
        governance = IGovernance(_governanceAddress);
        emit GovernanceAddressChanged(_governanceAddress);
    }

    // --- Functions for intra-Liquity calls ---

    function mint(address _account, uint256 _amount) external override {
        _requireCallerIsBorrowerOperations();
        _requireTotalDebtIsBelowMax(_amount);
        _requireMintIsAllowed();

        _mint(_account, _amount);
        arth.poolMint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) external override {
        _requireCallerIsBOorTroveMorSP();
        _burn(_account, _amount);
        arth.poolBurnFrom(_account, _amount);
    }

    function sendToPool(address _sender,  address _poolAddress, uint256 _amount) external override {
        _requireCallerIsStabilityPool();
        arth.transferFrom(_sender, _poolAddress, _amount);
        // _transfer(_sender, _poolAddress, _amount);
    }

    function returnFromPool(address _poolAddress, address _receiver, uint256 _amount) external override {
        // _requireCallerIsTroveMorSP();
        _requireCallerIsStabilityPool();  // Since trove managers now uses gasPool which transfers funds itself.
        // NOTE: need to be approved by `_poolAddress` since this is potentially a contract.
        arth.transferFrom(_poolAddress, _receiver, _amount);
        // _transfer(_poolAddress, _receiver, _amount);
    }

    // --- External functions ---

    function totalDebt() external view override returns (uint256) {
        return _totalDebt;
    }

    // --- Internal operations ---
    // Warning: sanity checks (for sender and recipient) should have been done before calling these internal functions

    function _mint(address account, uint256 amount) internal {
        assert(account != address(0));

        _totalDebt = _totalDebt.add(amount);
        // _totalSupply = _totalSupply.add(amount);
        // _balances[account] = _balances[account].add(amount);
        emit DebtAdded(amount, block.timestamp);
    }

    function _burn(address account, uint256 amount) internal {
        assert(account != address(0));
        
        // _balances[account] = _balances[account].sub(amount, "ERC20: burn amount exceeds balance");
        _totalDebt = _totalDebt.sub(amount);
        // _totalSupply = _totalSupply.sub(amount);
        emit DebtReduced(amount, block.timestamp);
    }

    // --- 'require' functions ---

    function _requireMintIsAllowed() internal view {
        require(
            governance.getAllowMinting(),
            "Controller: Mint is not allowed"
        );
    }

    function _requireTotalDebtIsBelowMax(uint256 _amount) internal view {
        require(
            _totalDebt.add(_amount) <= governance.getMaxDebtCeiling(),  // Check that after miting debt will still be below max.
            "Controller: Maximum Debt limit reached"
        );
    }

    function _requireValidRecipient(address _recipient) internal view {
        require(
            _recipient != address(0) && 
            _recipient != address(this),
            "Controller: Cannot transfer tokens directly to the LUSD token contract or the zero address"
        );
        require(
            _recipient != stabilityPoolAddress && 
            _recipient != troveManagerAddress && 
            _recipient != borrowerOperationsAddress, 
            "Controller: Cannot transfer tokens directly to the StabilityPool, TroveManager or BorrowerOps"
        );
    }

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "Controller: Caller is not BorrowerOperations");
    }

    function _requireCallerIsBOorTroveMorSP() internal view {
        require(
            msg.sender == borrowerOperationsAddress ||
            msg.sender == troveManagerAddress ||
            msg.sender == stabilityPoolAddress,
            "Controller: Caller is neither BorrowerOperations nor TroveManager nor StabilityPool"
        );
    }

    function _requireCallerIsStabilityPool() internal view {
        require(msg.sender == stabilityPoolAddress, "Controller: Caller is not the StabilityPool");
    }

    function _requireCallerIsTroveMorSP() internal view {
        require(
            msg.sender == troveManagerAddress || msg.sender == stabilityPoolAddress,
            "Controller: Caller is neither TroveManager nor StabilityPool");
    }
}
