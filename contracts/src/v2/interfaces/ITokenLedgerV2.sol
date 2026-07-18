// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITokenLedgerV2 {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function controllerMove(address from, address to, uint256 amount) external;
    function controllerBurn(address from, uint256 amount) external;
}
