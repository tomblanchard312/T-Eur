// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ITokenLedgerV2.sol";
import "./interfaces/ITransferPolicyV2.sol";

contract TokenLedgerV2 is ITokenLedgerV2 {
    string public constant name = "Tokenized Euro v2";
    string public constant symbol = "tEUR";
    uint8 public constant decimals = 2;

    uint8 public constant CAPABILITY_MOVE = 1 << 0;
    uint8 public constant CAPABILITY_MINT = 1 << 1;
    uint8 public constant CAPABILITY_BURN = 1 << 2;

    address public immutable governance;
    ITransferPolicyV2 public transferPolicy;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => uint8) public controllerCapabilities;
    mapping(bytes32 => bool) public usedOperationDigests;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event ControllerCapabilitiesUpdated(address indexed controller, uint8 capabilities);
    event TransferPolicyUpdated(address indexed previousPolicy, address indexed newPolicy);
    event ControllerMint(address indexed controller, address indexed to, uint256 amount, bytes32 operationDigest);
    event ControllerBurn(address indexed controller, address indexed from, uint256 amount, bytes32 operationDigest);

    error Unauthorized();
    error ZeroAddress();
    error InvalidAmount();
    error InsufficientBalance();
    error InsufficientAllowance();
    error OperationAlreadyUsed();

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Unauthorized();
        _;
    }

    modifier onlyCapability(uint8 capability) {
        if ((controllerCapabilities[msg.sender] & capability) == 0) revert Unauthorized();
        _;
    }

    constructor(address governanceAddress) {
        if (governanceAddress == address(0)) revert ZeroAddress();
        governance = governanceAddress;
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function setControllerCapabilities(address controller, uint8 capabilities) external onlyGovernance {
        if (controller == address(0)) revert ZeroAddress();
        controllerCapabilities[controller] = capabilities;
        emit ControllerCapabilitiesUpdated(controller, capabilities);
    }

    function setTransferPolicy(address policy) external onlyGovernance {
        address previous = address(transferPolicy);
        transferPolicy = ITransferPolicyV2(policy);
        emit TransferPolicyUpdated(previous, policy);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) revert InsufficientAllowance();
            unchecked {
                _allowances[from][msg.sender] = currentAllowance - amount;
            }
            emit Approval(from, msg.sender, _allowances[from][msg.sender]);
        }

        _move(msg.sender, from, to, amount);
        return true;
    }

    function controllerMove(address from, address to, uint256 amount)
        external
        onlyCapability(CAPABILITY_MOVE)
    {
        _move(msg.sender, from, to, amount);
    }

    function controllerMint(address to, uint256 amount, bytes32 clientKey)
        external
        onlyCapability(CAPABILITY_MINT)
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();

        bytes32 digest = _operationDigest(keccak256("MINT"), msg.sender, to, amount, clientKey);
        _consumeOperation(digest);

        _totalSupply += amount;
        _balances[to] += amount;

        emit Transfer(address(0), to, amount);
        emit ControllerMint(msg.sender, to, amount, digest);
    }

    function controllerBurn(address from, uint256 amount, bytes32 clientKey)
        external
        onlyCapability(CAPABILITY_BURN)
    {
        if (from == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (_balances[from] < amount) revert InsufficientBalance();

        bytes32 digest = _operationDigest(keccak256("BURN"), msg.sender, from, amount, clientKey);
        _consumeOperation(digest);

        _balances[from] -= amount;
        _totalSupply -= amount;

        emit Transfer(from, address(0), amount);
        emit ControllerBurn(msg.sender, from, amount, digest);
    }

    function operationDigest(
        bytes32 operationType,
        address actor,
        address target,
        uint256 amount,
        bytes32 clientKey
    ) external view returns (bytes32) {
        return _operationDigest(operationType, actor, target, amount, clientKey);
    }

    function _move(address operator, address from, address to, uint256 amount) internal {
        if (from == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (_balances[from] < amount) revert InsufficientBalance();

        if (address(transferPolicy) != address(0)) {
            transferPolicy.validateTransfer(operator, from, to, amount);
        }

        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _consumeOperation(bytes32 digest) internal {
        if (usedOperationDigests[digest]) revert OperationAlreadyUsed();
        usedOperationDigests[digest] = true;
    }

    function _operationDigest(
        bytes32 operationType,
        address actor,
        address target,
        uint256 amount,
        bytes32 clientKey
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                block.chainid,
                address(this),
                operationType,
                actor,
                target,
                amount,
                clientKey
            )
        );
    }
}
