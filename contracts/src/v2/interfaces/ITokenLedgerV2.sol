// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITokenLedgerV2 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    function controllerMove(address from, address to, uint256 amount) external;
    function controllerMint(address to, uint256 amount, bytes32 clientKey) external;
    function controllerBurn(address from, uint256 amount) external;
    function controllerBurn(address from, uint256 amount, bytes32 clientKey) external;
}
