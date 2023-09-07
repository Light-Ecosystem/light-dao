// ----------------
// MATH
// ----------------

import { BigNumber } from "ethers";
import { parseEther, parseUnits } from "ethers/lib/utils";

export const PERCENTAGE_FACTOR = "10000";
export const HALF_PERCENTAGE = BigNumber.from(PERCENTAGE_FACTOR)
  .div(2)
  .toString();
export const oneEther = parseUnits("1", 18);
export const MAX_UINT_AMOUNT =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";
export const MAX_UINT_160_AMOUNT =
  "1461501637330902918203684832716283019655932542975";
export const ONE_YEAR = 31536000;
export const ONE_MONTH = 2592000;
export const ONE_WEEK = 604800;
export const ONE_DAY = 86400;
export const ONE_HOUR = 3600;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
export const ETH_MOCK_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export const HARDHAT_CHAINID = 31337;
export const COVERAGE_CHAINID = 1337;