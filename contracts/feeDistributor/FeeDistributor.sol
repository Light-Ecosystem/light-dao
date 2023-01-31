// SPDX-License-Identifier: LGPL-3.0
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../interfaces/IFeeDistributor.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";

struct Point {
    int256 bias;
    int256 slope;
    uint256 ts;
    uint256 blk;
}

interface IVotingEscrow {
    function epoch() external view returns (uint256);

    function userPointEpoch(address user) external view returns (uint256);

    function checkpointSupply() external;

    function supplyPointHistory(uint256 epoch) external view returns (Point memory);

    function userPointHistory(address user, uint256 epoch) external view returns (Point memory);
}

contract FeeDistributor is Ownable2StepUpgradeable, PausableUpgradeable, IFeeDistributor {
    uint256 constant WEEK = 7 * 86400;
    uint256 constant TOKEN_CHECKPOINT_DEADLINE = 86400;

    uint256 public start_time;
    uint256 public time_cursor;

    ///userAddress => timeCursor
    mapping(address => uint256) public time_cursor_of;
    ///userAddress => epoch
    mapping(address => uint256) user_epoch_of;

    ///lastTokenTime
    uint256 public last_token_time;
    /// tokensPreWeek
    uint256[1000000000000000] tokens_per_week;

    address public token;
    uint256 public token_last_balance;
    address public voting_escrow;

    // VE total supply at week bounds
    uint256[1000000000000000] public ve_supply;

    bool public can_checkpoint_token;
    address public emergency_return;

    /**
     * @notice Contract constructor
     * @param _voting_escrow VotingEscrow contract address
     * @param _start_time Epoch time for fee distribution to start
     * @param _token Fee token address list
     * @param _emergency_return Address to transfer `_token` balance to if this contract is killed
     */
    function initialize(address _voting_escrow, uint256 _start_time, address _token, address _emergency_return) external initializer {
        __Ownable2Step_init();

        uint256 t = (_start_time / WEEK) * WEEK;
        start_time = t;
        last_token_time = t;
        time_cursor = t;
        voting_escrow = _voting_escrow;
        emergency_return = _emergency_return;
    }

    /**
     * @notice Update the token checkpoint
     * @dev Calculates the total number of tokens to be distributed in a given week.
         During setup for the initial distribution this function is only callable
         by the contract owner. Beyond initial distro, it can be enabled for anyone
         to call
     */
    function checkpoint_token() external {
        require(
            (msg.sender == owner()) || (can_checkpoint_token && (block.timestamp > last_token_time + TOKEN_CHECKPOINT_DEADLINE)),
            "can not checkpoint now"
        );
        _checkpoint_token();
    }

    function _checkpoint_token() internal {
        uint256 token_balance = IERC20Upgradeable(token).balanceOf(address(this));
        uint256 to_distribute = token_balance - token_last_balance;
        token_last_balance = token_balance;

        uint256 t = last_token_time;
        uint256 since_last = block.timestamp - t;
        last_token_time = block.timestamp;
        uint256 this_week = (t / WEEK) * WEEK;
        uint256 next_week = 0;

        for (uint i = 0; i < 20; i++) {
            next_week = this_week + WEEK;
            if (block.timestamp < next_week) {
                if (since_last == 0 && block.timestamp == t) {
                    tokens_per_week[this_week] += to_distribute;
                } else {
                    tokens_per_week[this_week] += (to_distribute * (block.timestamp - t)) / since_last;
                }
                break;
            } else {
                if (since_last == 0 && next_week == t) {
                    tokens_per_week[this_week] += to_distribute;
                } else {
                    tokens_per_week[this_week] += (to_distribute * (next_week - t)) / since_last;
                }
            }
            t = next_week;
            this_week = next_week;
        }
        emit CheckpointToken(block.timestamp, to_distribute);
    }

    /**
     * @notice Get the veLT balance for `_user` at `_timestamp`
     * @param _user Address to query balance for
     * @param _timestamp Epoch time
     * @return uint256 veLT balance
     */
    function ve_for_at(address _user, uint256 _timestamp) external view returns (uint256) {
        uint256 max_user_epoch = IVotingEscrow(voting_escrow).userPointEpoch(_user);
        uint256 epoch = _find_timestamp_user_epoch(voting_escrow, _user, _timestamp, max_user_epoch);
        Point memory pt = IVotingEscrow(voting_escrow).userPointHistory(_user, epoch);
        return Math.max(uint256(pt.bias) - uint256(pt.slope) * (_timestamp - pt.ts), 0);
    }

    /**
     * @notice Update the veLT total supply checkpoint
     * @dev The checkpoint is also updated by the first claimant each
         new epoch week. This function may be called independently
         of a claim, to reduce claiming gas costs.
     */
    function checkpoint_total_supply() external {
        _checkpoint_total_supply();
    }

    function _checkpoint_total_supply() internal {
        address ve = voting_escrow;
        uint256 t = time_cursor;
        uint256 rounded_timestamp = (block.timestamp / WEEK) * WEEK;
        IVotingEscrow(ve).checkpointSupply();

        for (int i = 0; i < 20; i++) {
            if (t > rounded_timestamp) {
                break;
            } else {
                uint256 epoch = _find_timestamp_epoch(ve, t);
                Point memory pt = IVotingEscrow(ve).supplyPointHistory(epoch);
                uint256 dt = 0;
                if (t > pt.ts) {
                    /// If the point is at 0 epoch, it can actually be earlier than the first deposit
                    /// Then make dt 0
                    dt = t - pt.ts;
                }
                ve_supply[t] = Math.max(uint256(pt.bias) - uint256(pt.slope) * dt, 0);
            }
            t += WEEK;
        }
        time_cursor = t;
    }

    function _find_timestamp_epoch(address ve, uint256 _timestamp) internal view returns (uint256) {
        uint256 _min = 0;
        uint256 _max = IVotingEscrow(ve).epoch();
        for (int i = 0; i < 128; i++) {
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 2) / 2;
            Point memory pt = IVotingEscrow(ve).supplyPointHistory(_mid);
            if (pt.ts <= _timestamp) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    function _find_timestamp_user_epoch(
        address ve,
        address user,
        uint256 _timestamp,
        uint256 max_user_epoch
    ) internal view returns (uint256) {
        uint256 _min = 0;
        uint256 _max = max_user_epoch;
        for (int i = 0; i < 128; i++) {
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 2) / 2;
            Point memory pt = IVotingEscrow(ve).userPointHistory(user, _mid);
            if (pt.ts <= _timestamp) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    function _claim(address addr, address ve, uint256 _last_token_time) internal returns (uint256) {
        ///Minimal user_epoch is 0 (if user had no point)
        uint256 user_epoch = 0;
        uint256 to_distribute = 0;

        uint256 max_user_epoch = IVotingEscrow(ve).userPointEpoch(addr);
        uint256 _start_time = start_time;

        if (max_user_epoch == 0) {
            /// No lock = no fees
            return 0;
        }

        uint256 week_cursor = time_cursor_of[addr];
        if (week_cursor == 0) {
            /// Need to do the initial binary search
            user_epoch = _find_timestamp_user_epoch(ve, addr, _start_time, max_user_epoch);
        } else {
            user_epoch = user_epoch_of[addr];
        }

        if (user_epoch == 0) {
            user_epoch = 1;
        }

        Point memory user_point = IVotingEscrow(ve).userPointHistory(addr, user_epoch);

        if (week_cursor == 0) {
            week_cursor = ((user_point.ts + WEEK - 1) / WEEK) * WEEK;
        }

        if (week_cursor >= _last_token_time) {
            return 0;
        }

        if (week_cursor < _start_time) {
            week_cursor = _start_time;
        }
        Point memory old_user_point = Point({bias: 0, slope: 0, ts: 0, blk: 0});

        /// Iterate over weeks
        for (int i = 0; i < 50; i++) {
            if (week_cursor >= _last_token_time) {
                break;
            }

            if (week_cursor >= user_point.ts && user_epoch <= max_user_epoch) {
                user_epoch += 1;
                old_user_point = user_point;
                if (user_epoch > max_user_epoch) {
                    user_point = Point({bias: 0, slope: 0, ts: 0, blk: 0});
                } else {
                    user_point = IVotingEscrow(ve).userPointHistory(addr, user_epoch);
                }
            } else {
                // Calc
                // + i * 2 is for rounding errors
                uint256 dt = week_cursor - old_user_point.ts;
                uint256 balance_of = Math.max(uint256(old_user_point.bias) - dt * uint256(old_user_point.slope), 0);
                if (balance_of == 0 && user_epoch > max_user_epoch) {
                    break;
                }
                if (balance_of > 0) {
                    to_distribute += (balance_of * tokens_per_week[week_cursor]) / ve_supply[week_cursor];
                }
                week_cursor += WEEK;
            }
        }

        user_epoch = Math.min(max_user_epoch, user_epoch - 1);
        user_epoch_of[addr] = user_epoch;
        time_cursor_of[addr] = week_cursor;

        emit Claimed(addr, to_distribute, user_epoch, max_user_epoch);

        return to_distribute;
    }

    /**
     * @notice Claim fees for `_addr`
     *  @dev Each call to claim look at a maximum of 50 user veCRV points.
         For accounts with many veCRV related actions, this function
         may need to be called more than once to claim all available
         fees. In the `Claimed` event that fires, if `claim_epoch` is
         less than `max_epoch`, the account may claim again.
         @param _addr Address to claim fees for
         @return uint256 Amount of fees claimed in the call
     *
     */
    function claim(address _addr) external whenNotPaused returns (uint256) {
        if (block.timestamp >= time_cursor) {
            _checkpoint_total_supply();
        }
        return _doClaim(_addr);
    }

    function _doClaim(address _addr) internal returns (uint256) {
        if (_addr == address(0)) {
            _addr = msg.sender;
        }
        uint256 _last_token_time = last_token_time;
        if (can_checkpoint_token && (block.timestamp > _last_token_time + TOKEN_CHECKPOINT_DEADLINE)) {
            _checkpoint_token();
            _last_token_time = block.timestamp;
        }

        _last_token_time = (_last_token_time / WEEK) * WEEK;
        uint256 amount = _claim(_addr, voting_escrow, _last_token_time);
        if (amount != 0) {
            IERC20Upgradeable(token).transfer(_addr, amount);
            token_last_balance -= amount;
        }
        return amount;
    }

    /**
     * @notice Make multiple fee claims in a single call
     * @dev Used to claim for many accounts at once, or to make
         multiple claims for the same address when that address
         has significant veLT history
     * @param _receivers List of addresses to claim for. Claiming terminates at the first `ZERO_ADDRESS`.
     * @return uint256 claim totol fee
     */
    function claim_many(address[] memory _receivers) external whenNotPaused returns (uint256) {
        if (block.timestamp >= time_cursor) {
            _checkpoint_total_supply();
        }

        uint256 _last_token_time = last_token_time;

        if (can_checkpoint_token && (block.timestamp > _last_token_time + TOKEN_CHECKPOINT_DEADLINE)) {
            _checkpoint_token();
            _last_token_time = block.timestamp;
        }

        _last_token_time = (_last_token_time / WEEK) * WEEK;
        uint256 total = 0;

        for (uint256 i = 0; i < _receivers.length; i++) {
            address addr = _receivers[i];
            if (addr == address(0)) {
                break;
            }
            uint256 amount = _claim(addr, voting_escrow, _last_token_time);
            if (amount != 0) {
                IERC20Upgradeable(token).transfer(addr, amount);
                total += amount;
            }

            if (total != 0) {
                token_last_balance -= total;
            }
        }

        return total;
    }

    /**
     * @notice Toggle permission for checkpointing by any account
     */
    function toggle_allow_checkpoint_token() external onlyOwner {
        bool flag = !can_checkpoint_token;
        can_checkpoint_token = !can_checkpoint_token;
        emit ToggleAllowCheckpointToken(flag);
    }

    /**
     * @notice Recover ERC20 tokens from this contract
     * @dev Tokens are sent to the emergency return address.
     * @return bool success
     */
    function recover_balance() external onlyOwner returns (bool) {
        uint256 amount = IERC20Upgradeable(token).balanceOf(address(this));
        TransferHelper.doTransferOut(token, emergency_return, amount);
        return true;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
