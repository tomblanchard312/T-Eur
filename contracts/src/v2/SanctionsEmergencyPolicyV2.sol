// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ITransferPolicyV2.sol";

contract SanctionsEmergencyPolicyV2 is ITransferPolicyV2 {
    address public immutable governance;
    address public sanctionsAuthority;
    address public emergencyAuthority;
    bool public paused;

    mapping(address => bool) public frozenAccounts;
    mapping(address => bytes32) public freezeReferenceHash;

    event SanctionsAuthorityUpdated(address indexed previousAuthority, address indexed newAuthority);
    event EmergencyAuthorityUpdated(address indexed previousAuthority, address indexed newAuthority);
    event AccountFrozen(address indexed account, bytes32 indexed referenceHash, address indexed authority);
    event AccountUnfrozen(address indexed account, address indexed authority);
    event Paused(address indexed authority);
    event Unpaused(address indexed authority);

    error Unauthorized();
    error ZeroAddress();
    error InvalidReference();
    error AlreadyFrozen();
    error NotFrozen();
    error TransfersPaused();
    error AccountFrozenForTransfer(address account);

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Unauthorized();
        _;
    }

    modifier onlySanctionsAuthority() {
        if (msg.sender != sanctionsAuthority) revert Unauthorized();
        _;
    }

    modifier onlyEmergencyAuthority() {
        if (msg.sender != emergencyAuthority) revert Unauthorized();
        _;
    }

    constructor(address governanceAddress, address sanctionsAuthorityAddress, address emergencyAuthorityAddress) {
        if (
            governanceAddress == address(0) || sanctionsAuthorityAddress == address(0)
                || emergencyAuthorityAddress == address(0)
        ) revert ZeroAddress();

        governance = governanceAddress;
        sanctionsAuthority = sanctionsAuthorityAddress;
        emergencyAuthority = emergencyAuthorityAddress;
    }

    function setSanctionsAuthority(address newAuthority) external onlyGovernance {
        if (newAuthority == address(0)) revert ZeroAddress();
        address previous = sanctionsAuthority;
        sanctionsAuthority = newAuthority;
        emit SanctionsAuthorityUpdated(previous, newAuthority);
    }

    function setEmergencyAuthority(address newAuthority) external onlyGovernance {
        if (newAuthority == address(0)) revert ZeroAddress();
        address previous = emergencyAuthority;
        emergencyAuthority = newAuthority;
        emit EmergencyAuthorityUpdated(previous, newAuthority);
    }

    function freezeAccount(address account, bytes32 referenceHash) external onlySanctionsAuthority {
        if (account == address(0)) revert ZeroAddress();
        if (referenceHash == bytes32(0)) revert InvalidReference();
        if (frozenAccounts[account]) revert AlreadyFrozen();

        frozenAccounts[account] = true;
        freezeReferenceHash[account] = referenceHash;
        emit AccountFrozen(account, referenceHash, msg.sender);
    }

    function unfreezeAccount(address account) external onlySanctionsAuthority {
        if (account == address(0)) revert ZeroAddress();
        if (!frozenAccounts[account]) revert NotFrozen();

        frozenAccounts[account] = false;
        delete freezeReferenceHash[account];
        emit AccountUnfrozen(account, msg.sender);
    }

    function pause() external onlyEmergencyAuthority {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyEmergencyAuthority {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function validateTransfer(address, address from, address to, uint256) external view {
        if (paused) revert TransfersPaused();
        if (frozenAccounts[from]) revert AccountFrozenForTransfer(from);
        if (frozenAccounts[to]) revert AccountFrozenForTransfer(to);
    }
}
