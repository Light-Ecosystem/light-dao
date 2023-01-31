// SPDX-License-Identifier: LGPL-3.0
pragma solidity >=0.8.0 <0.9.0;

interface IGombocFeeDistributor {
    event ToggleAllowCheckpointToken(bool toggleFlag);

    event CheckpointToken(uint256 time, uint256 tokens);

    event Claimed(address indexed gomboc, address indexed recipient, uint256 amount, uint256 claimEpoch, uint256 maxEpoch);
}
