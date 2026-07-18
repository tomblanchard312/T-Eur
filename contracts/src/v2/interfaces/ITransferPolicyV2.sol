// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITransferPolicyV2 {
    function validateTransfer(address operator, address from, address to, uint256 amount) external view;
}
