import {
  type ERC20,
  createAmountFromRaw,
  createAmountFromString,
  createFraction,
  fractionEqualTo,
} from "reverse-mirage";
import { parseEther } from "viem";
import { describe, expect, test } from "vitest";
import {
  calculateAccrue,
  calculateAddLiquidity,
  calculateBorrowLiquidity,
  calculateInitialize,
  calculateRemoveLiquidity,
  calculateRepayLiquidity,
  calculateSwap,
} from "./amounts.js";
import type { Pair } from "./types.js";

const token0 = {
  type: "erc20",
  chainID: 1,
  address: "0x0000000000000000000000000000000000000001",
  decimals: 18,
  name: "Token 0",
  symbol: "TOKEN0",
} as const satisfies ERC20;

const token1 = {
  type: "erc20",
  chainID: 1,
  address: "0x0000000000000000000000000000000000000002",
  decimals: 18,
  name: "Token 1",
  symbol: "TOKEN1",
} as const satisfies ERC20;

const pair = { token0, token1, scalingFactor: 0 } as const satisfies Pair;

const oneEther = parseEther("1");

describe.concurrent("amounts", () => {
  test("initialized", () => {
    const pairData = calculateInitialize(1);

    expect(pairData.strikes[1]).toBeTruthy();
    expect(pairData.strikeCurrent).toStrictEqual([1, 1, 1, 1, 1]);
    expect(pairData.initialized).toBe(true);
  });

  test("calculate add liquidity", () => {
    const pairData = calculateInitialize(0);
    const { amount0, amount1, position } = calculateAddLiquidity(
      pair,
      pairData,
      0n,
      0,
      1,
      oneEther,
    );

    // amounts
    expect(amount0.amount).toBe(oneEther);
    expect(amount1.amount).toBe(0n);
    expect(position.balance).toBe(oneEther);
    expect(amount0.token === token0).toBe(true);
    expect(amount1.token === token1).toBe(true);

    // pair data
    expect(pairData.strikes[0]).toBeTruthy();
    expect(pairData.strikes[0]!.liquidity).toStrictEqual([
      { swap: oneEther, borrowed: 0n },
      { swap: 0n, borrowed: 0n },
      { swap: 0n, borrowed: 0n },
      { swap: 0n, borrowed: 0n },
      { swap: 0n, borrowed: 0n },
    ]);
  });

  test("calculate remove liquidity", () => {
    const pairData = calculateInitialize(0);

    pairData.strikes[0]!.liquidity[0].swap = oneEther;
    const { amount0, amount1, position } = calculateRemoveLiquidity(
      pair,
      pairData,
      0n,
      0,
      1,
      oneEther,
    );

    // amounts
    expect(amount0.amount).toBe(1n - oneEther);
    expect(amount1.amount).toBe(0n);
    expect(position.balance).toBe(-oneEther);
    expect(amount0.token === token0).toBe(true);
    expect(amount1.token === token1).toBe(true);

    // pair data
    expect(pairData.strikes[0]).toBeTruthy();
    expect(pairData.strikes[0]!.liquidity).toStrictEqual([
      { swap: 0n, borrowed: 0n },
      { swap: 0n, borrowed: 0n },
      { swap: 0n, borrowed: 0n },
      { swap: 0n, borrowed: 0n },
      { swap: 0n, borrowed: 0n },
    ]);
  });

  test("calculate borrow liquidity", () => {
    const pairData = calculateInitialize(0);
    pairData.strikes[0]!.liquidity[0].swap = oneEther;
    const { amount0, amount1, position } = calculateBorrowLiquidity(
      pair,
      pairData,
      0n,
      0,
      createAmountFromString(token0, "1.5"),
      parseEther("0.5"),
    );

    // amounts
    expect(amount0.amount).toBe(oneEther + 1n);
    expect(amount1.amount).toBe(0n);
    expect(position.balance).toBe(parseEther("0.5"));
    expect(fractionEqualTo(position.token.data.liquidityGrowthLast, 0n)).toBe(
      true,
    );
    expect(
      fractionEqualTo(position.token.data.multiplier, createFraction(2)),
    ).toBe(true);
    expect(amount0.token === token0).toBe(true);
    expect(amount1.token === token1).toBe(true);

    // pair data
    expect(pairData.strikes[0]).toBeTruthy();
    expect(pairData.strikes[0]!.liquidity).toStrictEqual([
      { swap: parseEther("0.5"), borrowed: parseEther("0.5") },
      { swap: 0n, borrowed: 0n },
      { swap: 0n, borrowed: 0n },
      { swap: 0n, borrowed: 0n },
      { swap: 0n, borrowed: 0n },
    ]);
    expect(
      fractionEqualTo(
        pairData.strikes[0]!.liquidityRepayRate,
        createFraction(oneEther, 4),
      ),
    ).toBe(true);
  });

  test("calculate repay liquidity", () => {
    const pairData = calculateInitialize(0);
    pairData.strikes[0]!.liquidity[0].swap = parseEther("0.5");
    pairData.strikes[0]!.liquidity[0].borrowed = parseEther("0.5");
    pairData.strikes[0]!.liquidityRepayRate = createFraction(oneEther, 4);

    const { amount0, amount1, position } = calculateRepayLiquidity(
      pair,
      pairData,
      0n,
      0,
      "Token0",
      createFraction(0),
      createFraction(2),
      parseEther("0.5"),
    );

    // amounts
    expect(amount0.amount).toBe(-oneEther);
    expect(amount1.amount).toBe(0n);
    expect(position.balance).toBe(-parseEther("0.5"));
    expect(amount0.token === token0).toBe(true);
    expect(amount1.token === token1).toBe(true);

    // pair data
    expect(pairData.strikes[0]).toBeTruthy();
    expect(pairData.strikes[0]!.liquidity).toStrictEqual([
      { swap: parseEther("1"), borrowed: 0n },
      { swap: 0n, borrowed: 0n },
      { swap: 0n, borrowed: 0n },
      { swap: 0n, borrowed: 0n },
      { swap: 0n, borrowed: 0n },
    ]);
  });

  test("calculate swap token 0 exact in", () => {
    const pairData = calculateInitialize(0);
    calculateAccrue(pairData, 0n, 1);
    pairData.strikes[1]!.liquidity[0].swap = oneEther;
    pairData.strikeCurrent[0] = 1;

    const { amount0, amount1 } = calculateSwap(
      pair,
      pairData,
      createAmountFromRaw(token0, oneEther / 2n),
    );
    expect(amount0.amount).toBe(oneEther / 2n);
    expect(amount1.amount).toBe(-oneEther / 2n);
    expect(amount0.token === token0).toBe(true);
    expect(amount1.token === token1).toBe(true);
    expect(pairData.strikeCurrent[0]).toBe(1);
  });

  test("calculate swap token 1 exact out", () => {
    const pairData = calculateInitialize(0);
    calculateAccrue(pairData, 0n, 1);
    pairData.strikes[1]!.liquidity[0].swap = oneEther;
    pairData.strikeCurrent[0] = 1;

    const { amount0, amount1 } = calculateSwap(
      pair,
      pairData,
      createAmountFromRaw(token1, -oneEther / 2n),
    );
    expect(amount0.amount).toBe(oneEther / 2n);
    expect(amount1.amount).toBe(-oneEther / 2n);
    expect(amount0.token === token0).toBe(true);
    expect(amount1.token === token1).toBe(true);
    expect(pairData.strikeCurrent[0]).toBe(1);
  });

  test("calculate swap token 0 exact out", () => {
    const pairData = calculateInitialize(0);
    calculateAccrue(pairData, 0n, -1);
    pairData.strikes[-1]!.liquidity[0].swap = oneEther;
    pairData.strikeCurrent[0] = -1;

    const { amount0, amount1 } = calculateSwap(
      pair,
      pairData,
      createAmountFromRaw(token0, -oneEther / 2n),
    );
    expect(amount0.amount).toBe(-oneEther / 2n);
    expect(amount1.amount).toBe(oneEther / 2n);
    expect(amount0.token === token0).toBe(true);
    expect(amount1.token === token1).toBe(true);
    expect(pairData.strikeCurrent[0]).toBe(-1);
  });

  test("calculate swap token 1 exact in", () => {
    const pairData = calculateInitialize(0);
    calculateAccrue(pairData, 0n, -1);
    pairData.strikes[-1]!.liquidity[0].swap = oneEther;
    pairData.strikeCurrent[0] = -1;

    const { amount0, amount1 } = calculateSwap(
      pair,
      pairData,
      createAmountFromRaw(token1, oneEther / 2n),
    );
    expect(amount0.amount).toBe(-oneEther / 2n);
    expect(amount1.amount).toBe(oneEther / 2n);
    expect(amount0.token === token0).toBe(true);
    expect(amount1.token === token1).toBe(true);
    expect(pairData.strikeCurrent[0]).toBe(-1);
  });

  test.todo("calculate accrue", () => {});
});
