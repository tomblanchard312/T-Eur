// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ITokenLedgerV2.sol";
import "./interfaces/ITransferPolicyV2.sol";

contract HoldingLimitPolicyV2 is ITransferPolicyV2 {
    ITokenLedgerV2 public immutable ledger;
    address public immutable governance;
    address public policyAuthority;

    mapping(address => uint256) public holdingLimits;
    mapping(address => bool) public exemptAccounts;

    event PolicyAuthorityUpdated(address indexed previousAuthority, address indexed newAuthority);
    event HoldingLimitUpdated(address indexed account, uint256 previousLimit, uint256 newLimit);
    event ExemptionUpdated(address indexed account, bool exempt);

    error Unauthorized();
    error ZeroAddress();
    error InvalidLimit();
    error HoldingLimitExceeded(address account, uint256 resultingBalance, uint256 limit);

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Unauthorized();
        _;
    }

    modifier onlyPolicyAuthority() {
        if (msg.sender != policyAuthority) revert Unauthorized();
        _;
    }

    constructor(address ledgerAddress, address governanceAddress, address policyAuthorityAddress) {
        if (ledgerAddress == address(0) || governanceAddress == address(0) || policyAuthorityAddress == address(0)) {
            revert ZeroAddress();
        }
        ledger = ITokenLedgerV2(ledgerAddress);
        governance = governanceAddress;
        policyAuthority = policyAuthorityAddress;
    }

    function setPolicyAuthority(address newAuthority) external onlyGovernance {
        if (newAuthority == address(0)) revert ZeroAddress();
        address previous = policyAuthority;
        policyAuthority = newAuthority;
        emit PolicyAuthorityUpdated(previous, newAuthority);
    }

    function setHoldingLimit(address account, uint256 newLimit) external onlyPolicyAuthority {
        if (account == address(0)) revert ZeroAddress();
        if (newLimit == 0) revert InvalidLimit();
        uint256 previous = holdingLimits[account];
        holdingLimits[account] = newLimit;
        emit HoldingLimitUpdated(account, previous, newLimit);
    }

    function setExempt(address account, bool exempt) external onlyPolicyAuthority {
        if (account == address(0)) revert ZeroAddress();
        exemptAccounts[account] = exempt;
        emit ExemptionUpdated(account, exempt);
    }

    function availableCapacity(address account) public view returns (uint256) {
        if (exemptAccounts[account]) return type(uint256).max;
        uint256 limit = holdingLimits[account];
        uint256 balance = ledger.balanceOf(account);
        if (limit <= balance) return 0;
        return limit - balance;
    }

    function validateTransfer(address, address, address to, uint256 amount) external view {
        if (exemptAccounts[to]) return;
        uint256 limit = holdingLimits[to];
        if (limit == 0) return;
        uint256 resultingBalance = ledger.balanceOf(to) + amount;
        if (resultingBalance > limit) revert HoldingLimitExceeded(to, resultingBalance, limit);
    }
}
