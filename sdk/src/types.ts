/**
 * Type definitions for Stellend Protocol
 */

export interface LendingPoolInfo {
  totalSupply: bigint;
  totalBorrowed: bigint;
  utilizationRate: bigint;
  interestRate: bigint;
}

export interface UserPosition {
  deposited: bigint;
  borrowed: bigint;
  collateral: bigint;
  healthRatio: bigint;
}

export interface AssetInfo {
  symbol: string;
  decimals: number;
  price: bigint;
}

export interface InterestRateModel {
  baseRate: bigint;
  slope1: bigint;
  slope2: bigint;
  optimalUtilization: bigint;
}

