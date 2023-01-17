// SPDX-License-Identifier: LGPL-3.0

pragma solidity >=0.8.0 <0.9.0;

import "./interfaces/IStaking.sol";
import "./gombocs/AbsGomboc.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {TransferHelper} from "light-lib/contracts/TransferHelper.sol";

contract StakingHOPE is IStaking, ERC20Upgradeable, AbsGomboc {
    uint256 internal constant _LOCK_TIME = 28;

    // staking token contract
    address public stakedToken;
    // permit2 contract
    address public permit2Address;

    struct UnstakingOrderDetail {
        uint256 amount;
        uint256 redeemTime;
        bool redeemExecuted;
    }

    struct UnstakingOrderSummary {
        uint256 notRedeemAmount;
        uint256 index;
        mapping(uint256 => UnstakingOrderDetail) orderMap;
    }

    uint256 public totalNotRedeemAmount;
    mapping(address => UnstakingOrderSummary) public unstakingMap;
    mapping(uint256 => uint256) public unstakingDayHistory;
    uint256 private unstakeTotal;

    constructor(address _stakedToken, address _minter, address _permit2Address) AbsGomboc(_minter) initializer {
        require(_stakedToken != address(0), "StakingHope::initialize: invalid staking address");
        require(_permit2Address != address(0), "StakingHope::initialize: invalid permit2 address");

        __ERC20_init("Staked HOPE UNI", "stHOPE");
        stakedToken = _stakedToken;
        permit2Address = _permit2Address;
    }

    /***
     * @notice Stake HOPE to get stHOPE
     *
     * @param amount
     * @param nonce
     * @param deadline
     * @param signature
     */
    function staking(uint256 amount, uint256 nonce, uint256 deadline, bytes memory signature) external {
        require(amount != 0, "INVALID_ZERO_AMOUNT");

        address staker = _msgSender();
        // checking amount
        uint256 balanceOfUser = IERC20Upgradeable(stakedToken).balanceOf(staker);
        require(balanceOfUser >= amount, "INVALID_AMOUNT");
        TransferHelper.doTransferInV2(permit2Address, stakedToken, amount, staker, nonce, deadline, signature);

        _checkpoint(staker);

        _mint(staker, amount);

        _updateLiquidityLimit(staker, lpBalanceOf(staker), lpTotalSupply());

        emit Staking(staker, amount);
    }

    /***
     * @notice unstaking the staked amount
     * The unstaking process takes 28 days to complete. During this period,
     *  the unstaked $HOPE cannot be traded, and no staking rewards are accrued.
     *
     * @param
     * @return
     */
    function unstaking(uint256 amount) external {
        require(amount != 0, "INVALID_ZERO_AMOUNT");

        address staker = _msgSender();
        // checking amount
        uint256 balanceOfUser = balanceOf(staker);
        require(balanceOfUser >= amount, "INVALID_AMOUNT");

        _checkpoint(staker);

        uint256 nextDayTime = ((block.timestamp + _DAY) / _DAY) * _DAY;
        // lock 28 days
        uint256 redeemTime = nextDayTime + _DAY * _LOCK_TIME;

        unstakingDayHistory[nextDayTime] = unstakingDayHistory[nextDayTime] + amount;
        unstakeTotal = unstakeTotal + amount;

        UnstakingOrderSummary storage summaryMap = unstakingMap[staker];

        summaryMap.notRedeemAmount = summaryMap.notRedeemAmount + amount;
        summaryMap.index = summaryMap.index + 1;
        summaryMap.orderMap[summaryMap.index] = UnstakingOrderDetail(amount, redeemTime, false);
        totalNotRedeemAmount += amount;

        _updateLiquidityLimit(staker, lpBalanceOf(staker), lpTotalSupply());
        emit Unstaking(staker, amount);
    }

    /***
     * @notice get unstaking amount
     *
     * @return
     */
    function unstakingBalanceOf(address _addr) public view returns (uint256) {
        uint256 _unstakingAmount = 0;
        UnstakingOrderSummary storage summaryMap = unstakingMap[_addr];
        for (uint256 _index = summaryMap.index; _index > 0; _index--) {
            if (summaryMap.orderMap[_index].redeemExecuted) {
                break;
            }
            if (block.timestamp < summaryMap.orderMap[_index].redeemTime) {
                _unstakingAmount += summaryMap.orderMap[_index].amount;
            }
        }
        return _unstakingAmount;
    }

    function unstakingTotal() public view returns (uint256) {
        uint256 _unstakingTotal = 0;

        uint256 nextDayTime = ((block.timestamp + _DAY) / _DAY) * _DAY;
        for (uint i = 0; i < _LOCK_TIME; i++) {
            _unstakingTotal += unstakingDayHistory[nextDayTime - _DAY * i];
        }
        return _unstakingTotal;
    }

    /***
     * @notice get can redeem amount
     *
     * @param
     * @return
     */
    function unstakedBalanceOf(address _addr) public view returns (uint256) {
        uint256 amountToRedeem = 0;
        UnstakingOrderSummary storage summaryMap = unstakingMap[_addr];
        for (uint256 _index = summaryMap.index; _index > 0; _index--) {
            if (summaryMap.orderMap[_index].redeemExecuted) {
                break;
            }
            if (block.timestamp >= summaryMap.orderMap[_index].redeemTime) {
                amountToRedeem += summaryMap.orderMap[_index].amount;
            }
        }
        return amountToRedeem;
    }

    function unstakedTotal() external view returns (uint256) {
        return unstakeTotal - unstakingTotal();
    }

    /***
     * @notice Redeem all amounts to your account
     *
     * @param
     * @return
     */
    function redeemAll() external {
        address redeemer = _msgSender();
        uint256 amountToRedeem = unstakedBalanceOf(redeemer);
        require(amountToRedeem != 0, "No redeemable amount");

        _checkpoint(redeemer);

        UnstakingOrderSummary storage summaryMap = unstakingMap[redeemer];
        for (uint256 _index = summaryMap.index; _index > 0; _index--) {
            if (summaryMap.orderMap[_index].redeemExecuted) {
                break;
            }
            if (block.timestamp > summaryMap.orderMap[_index].redeemTime) {
                uint256 amount = summaryMap.orderMap[_index].amount;
                summaryMap.orderMap[_index].redeemExecuted = true;
                summaryMap.notRedeemAmount = summaryMap.notRedeemAmount - amount;
                totalNotRedeemAmount -= amount;
            }
        }

        _burn(redeemer, amountToRedeem);
        TransferHelper.doTransferOut(stakedToken, redeemer, amountToRedeem);
        _updateLiquidityLimit(redeemer, lpBalanceOf(redeemer), lpTotalSupply());

        unstakeTotal = unstakeTotal - amountToRedeem;

        emit Redeem(redeemer, amountToRedeem);
    }

    /***
     * @notice redeem amount by index(Prevent the number of unstaking too much to redeem)
     *
     * @param maxIndex
     * @return
     */
    function redeemByMaxIndex(uint256 maxIndex) external {
        address redeemer = _msgSender();

        uint256 allToRedeemAmount = unstakedBalanceOf(redeemer);
        require(allToRedeemAmount != 0, "No redeemable amount");

        uint256 amountToRedeem = 0;
        _checkpoint(redeemer);

        UnstakingOrderSummary storage summaryMap = unstakingMap[redeemer];
        uint256 indexCount = 0;
        for (uint256 _index = 1; _index <= summaryMap.index; _index++) {
            if (indexCount >= maxIndex) {
                break;
            }
            if (block.timestamp > summaryMap.orderMap[_index].redeemTime && !summaryMap.orderMap[_index].redeemExecuted) {
                uint256 amount = summaryMap.orderMap[_index].amount;
                amountToRedeem += amount;
                summaryMap.orderMap[_index].redeemExecuted = true;
                summaryMap.notRedeemAmount = summaryMap.notRedeemAmount - amount;
                totalNotRedeemAmount -= amount;
                indexCount++;
            }
        }

        if (amountToRedeem > 0) {
            _burn(redeemer, amountToRedeem);
            TransferHelper.doTransferOut(stakedToken, redeemer, amountToRedeem);
            _updateLiquidityLimit(redeemer, lpBalanceOf(redeemer), lpTotalSupply());

            unstakeTotal = unstakeTotal - amountToRedeem;
            emit Redeem(redeemer, amountToRedeem);
        }
    }

    function lpBalanceOf(address _addr) public view override returns (uint256) {
        return super.balanceOf(_addr) - unstakingMap[_addr].notRedeemAmount;
    }

    function lpTotalSupply() public view override returns (uint256) {
        return super.totalSupply() - totalNotRedeemAmount;
    }

    /***
     * @notice Transfers Gomboc deposit (stHOPE) from the caller to _to.
     *
     * @param to
     * @param amount
     * @return bool
     */
    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        _checkpoint(_msgSender());
        _checkpoint(to);
        bool result = super.transfer(to, amount);
        _updateLiquidityLimit(_msgSender(), lpBalanceOf(_msgSender()), lpTotalSupply());
        _updateLiquidityLimit(to, lpBalanceOf(to), lpTotalSupply());
        return result;
    }

    /***
     * @notice Tansfers a Gomboc deposit between _from and _to.
     *
     * @param from
     * @param to
     * @param amount
     * @return bool
     */
    function transferFrom(address _from, address _to, uint256 _amount) public override returns (bool) {
        _checkpoint(_from);
        _checkpoint(_to);

        bool result = super.transferFrom(_from, _to, _amount);

        _updateLiquidityLimit(_from, lpBalanceOf(_from), lpTotalSupply());
        _updateLiquidityLimit(_to, lpBalanceOf(_to), lpTotalSupply());
        return result;
    }
}
