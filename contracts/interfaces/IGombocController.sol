// SPDX-License-Identifier: LGPL-3.0

pragma solidity 0.8.17;

interface IGombocController {
    struct Point {
        uint256 bias;
        uint256 slope;
    }

    struct VotedSlope {
        uint256 slope;
        uint256 power;
        uint256 end;
    }

    struct UserPoint {
        uint256 bias;
        uint256 slope;
        uint256 ts;
        uint256 blk;
    }

    event AddType(string name, int128 type_id);

    event NewTypeWeight(int128 indexed type_id, uint256 time, uint256 weight, uint256 total_weight);

    event NewGombocWeight(address indexed gomboc_address, uint256 time, uint256 weight, uint256 total_weight);

    event VoteForGomboc(address indexed user, address indexed gomboc_address, uint256 time, uint256 weight);

    event NewGomboc(address indexed gomboc_address, int128 gomboc_type, uint256 weight);

    /**
     * @notice Get gomboc type for address
     *  @param _addr Gomboc address
     * @return Gomboc type id
     */
    function gombocTypes(address _addr) external view returns (int128);

    /**
     * @notice Add gomboc `addr` of type `gomboc_type` with weight `weight`
     * @param addr Gomboc address
     * @param gombocType Gomboc type
     * @param weight Gomboc weight
     */
    function addGomboc(address addr, int128 gombocType, uint256 weight) external;

    /**
     * @notice Checkpoint to fill data common for all gombocs
     */
    function checkpoint() external;

    /**
     * @notice Checkpoint to fill data for both a specific gomboc and common for all gomboc
     * @param addr Gomboc address
     */
    function checkpointGomboc(address addr) external;

    /**
     * @notice Get Gomboc relative weight (not more than 1.0) normalized to 1e18(e.g. 1.0 == 1e18). Inflation which will be received by
     * it is inflation_rate * relative_weight / 1e18
     * @param gombocAddress Gomboc address
     * @param time Relative weight at the specified timestamp in the past or present
     * @return Value of relative weight normalized to 1e18
     */
    function gombocRelativeWeight(address gombocAddress, uint256 time) external view returns (uint256);

    /**
     *  @notice Get gomboc weight normalized to 1e18 and also fill all the unfilled values for type and gauge records
     * @dev Any address can call, however nothing is recorded if the values are filled already
     * @param gombocAddress Gomboc address
     * @param time Relative weight at the specified timestamp in the past or present
     * @return Value of relative weight normalized to 1e18
     */
    function gombocRelativeWeightWrite(address gombocAddress, uint256 time) external returns (uint256);

    /**
     * @notice Add gomboc type with name `_name` and weight `weight`
     * @dev only owner call
     * @param _name Name of gauge type
     * @param weight Weight of gauge type
     */
    function addType(string memory _name, uint256 weight) external;

    /**
     * @notice Change gomboc type `type_id` weight to `weight`
     * @dev only owner call
     * @param type_id Gomboc type id
     * @param weight New Gomboc weight
     */
    function changeTypeWeight(int128 type_id, uint256 weight) external;

    /**
     * @notice Change weight of gomboc `addr` to `weight`
     * @param gombocAddress `Gomboc` contract address
     * @param weight New Gomboc weight
     */
    function changeGombocWeight(address gombocAddress, uint256 weight) external;

    /**
     * @notice Allocate voting power for changing pool weights
     * @param gombocAddress Gomboc which `msg.sender` votes for
     * @param userWeight Weight for a gomboc in bps (units of 0.01%). Minimal is 0.01%. Ignored if 0.
     *        example: 10%=1000,3%=300,0.01%=1,100%=10000
     */
    function voteForGombocWeights(address gombocAddress, uint256 userWeight) external;

    /**
     * @notice Get current gomboc weight
     * @param addr Gomboc address
     * @return Gomboc weight
     */

    function getGombocWeight(address addr) external view returns (uint256);

    /**
     * @notice Get current type weight
     * @param type_id Type id
     * @return Type weight
     */
    function getTypeWeight(int128 type_id) external view returns (uint256);

    /**
     * @notice Get current total (type-weighted) weight
     * @return Total weight
     */
    function getTotalWeight() external view returns (uint256);

    /**
     * @notice Get sum of gomboc weights per type
     * @param type_id Type id
     * @return Sum of gomboc weights
     */
    function getWeightsSumPreType(int128 type_id) external view returns (uint256);

    function votingEscrow() external view returns (address);
}
