// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ITransferPolicyV2.sol";

contract CompositeTransferPolicyV2 is ITransferPolicyV2 {
    address public immutable governance;
    ITransferPolicyV2[] private _policies;

    event PoliciesReplaced(address[] policies);

    error Unauthorized();
    error ZeroAddress();

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Unauthorized();
        _;
    }

    constructor(address governanceAddress) {
        if (governanceAddress == address(0)) revert ZeroAddress();
        governance = governanceAddress;
    }

    function replacePolicies(address[] calldata policies) external onlyGovernance {
        delete _policies;
        for (uint256 i = 0; i < policies.length; i++) {
            if (policies[i] == address(0)) revert ZeroAddress();
            _policies.push(ITransferPolicyV2(policies[i]));
        }
        emit PoliciesReplaced(policies);
    }

    function policyCount() external view returns (uint256) {
        return _policies.length;
    }

    function policyAt(uint256 index) external view returns (address) {
        return address(_policies[index]);
    }

    function validateTransfer(address operator, address from, address to, uint256 amount) external view {
        for (uint256 i = 0; i < _policies.length; i++) {
            _policies[i].validateTransfer(operator, from, to, amount);
        }
    }
}
