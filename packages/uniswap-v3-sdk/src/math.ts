import {
  type Fraction,
  createFraction,
  fractionGreaterThan,
  fractionSubtract,
} from "reverse-mirage";
import invariant from "tiny-invariant";
import { Q96, Q128 } from "./constants.js";
import type {
  UniswapV3PoolData,
  UniswapV3Tick,
  UniswapV3TickData,
} from "./types.js";
import { fractionToQ96, q96ToFraction } from "./utils.js";

export const getFeeGrowthInside = (
  tickLower: UniswapV3TickData,
  tickUpper: UniswapV3TickData,
  poolData: Pick<UniswapV3PoolData, "feeGrowth0" | "feeGrowth1" | "tick">,
) => {
  const [feeGrowthBelow0, feeGrowthBelow1] =
    poolData.tick.tick >= tickUpper.tick.tick
      ? [tickLower.feeGrowthOutside0, tickLower.feeGrowthOutside1]
      : [
          fractionSubtract(poolData.feeGrowth0, tickLower.feeGrowthOutside0),
          fractionSubtract(poolData.feeGrowth1, tickLower.feeGrowthOutside1),
        ];

  const [feeGrowthAbove0, feeGrowthAbove1] =
    poolData.tick.tick < tickUpper.tick.tick
      ? [tickUpper.feeGrowthOutside0, tickUpper.feeGrowthOutside1]
      : [
          fractionSubtract(poolData.feeGrowth0, tickUpper.feeGrowthOutside0),
          fractionSubtract(poolData.feeGrowth1, tickUpper.feeGrowthOutside1),
        ];

  return {
    feeGrowthInside0: fractionSubtract(
      fractionSubtract(poolData.feeGrowth0, feeGrowthBelow0),
      feeGrowthAbove0,
    ),
    feeGrowthAbove1: fractionSubtract(
      fractionSubtract(poolData.feeGrowth1, feeGrowthBelow1),
      feeGrowthAbove1,
    ),
  };
};

export const getRatioAtStrike = (tick: UniswapV3Tick): Fraction => {
  const x = tick.tick < 0 ? -tick.tick : tick.tick;
  let ratioX128: bigint = Q128;

  if ((x & 0x1) > 0)
    ratioX128 = (ratioX128 * 0xfffcb933bd6fad37aa2d162d1a594001n) >> 128n;
  if ((x & 0x2) > 0)
    ratioX128 = (ratioX128 * 0xfff97272373d413259a46990580e213an) >> 128n;
  if ((x & 0x4) > 0)
    ratioX128 = (ratioX128 * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if ((x & 0x8) > 0)
    ratioX128 = (ratioX128 * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if ((x & 0x10) > 0)
    ratioX128 = (ratioX128 * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if ((x & 0x20) > 0)
    ratioX128 = (ratioX128 * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if ((x & 0x40) > 0)
    ratioX128 = (ratioX128 * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if ((x & 0x80) > 0)
    ratioX128 = (ratioX128 * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if ((x & 0x100) > 0)
    ratioX128 = (ratioX128 * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if ((x & 0x200) > 0)
    ratioX128 = (ratioX128 * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if ((x & 0x400) > 0)
    ratioX128 = (ratioX128 * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if ((x & 0x800) > 0)
    ratioX128 = (ratioX128 * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if ((x & 0x1000) > 0)
    ratioX128 = (ratioX128 * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if ((x & 0x2000) > 0)
    ratioX128 = (ratioX128 * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if ((x & 0x4000) > 0)
    ratioX128 = (ratioX128 * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if ((x & 0x8000) > 0)
    ratioX128 = (ratioX128 * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if ((x & 0x10000) > 0)
    ratioX128 = (ratioX128 * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if ((x & 0x20000) > 0)
    ratioX128 = (ratioX128 * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if ((x & 0x40000) > 0)
    ratioX128 = (ratioX128 * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if ((x & 0x80000) > 0)
    ratioX128 = (ratioX128 * 0x48a170391f7dc42444e8fa2n) >> 128n;
  // Stop computation here since |strike| < 2**20

  // Inverse r since base = 1/1.0001
  if (tick.tick > 0) ratioX128 = (2n ** 256n - 1n) / ratioX128;

  // down cast to Q96 and round up
  return createFraction(
    ratioX128 >> (32n + (ratioX128 % (1n << 32n) === 0n ? 0n : 1n)),
    Q96,
  );
};

export const getNextSqrtPriceFromAmount0RoundingUp = (
  sqrtPrice: Fraction,
  liquidity: bigint,
  amount: bigint,
  add: boolean,
): Fraction => {
  if (amount === 0n) return sqrtPrice;
  const numerator = liquidity << 96n;
  const product = fractionToQ96(sqrtPrice) * amount;

  if (add) {
    if (product / amount === fractionToQ96(sqrtPrice)) {
      const denominator = numerator + product;
      if (denominator >= numerator)
        return (numerator * fractionToQ96(sqrtPrice)) % denominator !== 0n
          ? q96ToFraction(
              (numerator * fractionToQ96(sqrtPrice)) / denominator + 1n,
            )
          : q96ToFraction((numerator * fractionToQ96(sqrtPrice)) / denominator);
    }

    return q96ToFraction(
      numerator / (numerator / fractionToQ96(sqrtPrice) + amount),
    );
  } else {
    invariant(
      product / amount === fractionToQ96(sqrtPrice) && numerator > product,
    );

    const denominator = numerator - product;

    return (numerator * fractionToQ96(sqrtPrice)) % denominator !== 0n
      ? q96ToFraction((numerator * fractionToQ96(sqrtPrice)) / denominator + 1n)
      : q96ToFraction((numerator * fractionToQ96(sqrtPrice)) / denominator);
  }
};
export const getNextSqrtPriceFromAmount1RoundingDown = (
  sqrtPrice: Fraction,
  liquidity: bigint,
  amount: bigint,
  add: boolean,
): Fraction => {
  if (add) {
    const quotient = (amount * Q96) / liquidity;

    return q96ToFraction(fractionToQ96(sqrtPrice) + quotient);
  } else {
    const quotient =
      (amount << 96n) % liquidity !== 0n
        ? (amount << 96n) / liquidity + 1n
        : (amount << 96n) / liquidity;

    invariant(fractionToQ96(sqrtPrice) > quotient);
    return q96ToFraction(fractionToQ96(sqrtPrice) - quotient);
  }
};

export const getNextSqrtPriceFromInput = (
  sqrtPrice: Fraction,
  liquidity: bigint,
  amountIn: bigint,
  zeroForOne: boolean,
) => {
  invariant(fractionGreaterThan(sqrtPrice, 0));
  invariant(liquidity > 0n);

  return zeroForOne
    ? getNextSqrtPriceFromAmount0RoundingUp(
        sqrtPrice,
        liquidity,
        amountIn,
        true,
      )
    : getNextSqrtPriceFromAmount1RoundingDown(
        sqrtPrice,
        liquidity,
        amountIn,
        true,
      );
};

export const getNextSqrtPriceFromOutput = (
  sqrtPrice: Fraction,
  liquidity: bigint,
  amountOut: bigint,
  zeroForOne: boolean,
) => {
  invariant(fractionGreaterThan(sqrtPrice, 0));
  invariant(liquidity > 0n);

  return zeroForOne
    ? getNextSqrtPriceFromAmount1RoundingDown(
        sqrtPrice,
        liquidity,
        amountOut,
        false,
      )
    : getNextSqrtPriceFromAmount0RoundingUp(
        sqrtPrice,
        liquidity,
        amountOut,
        false,
      );
};

const getAmount0DeltaRound = (
  sqrtPriceA: Fraction,
  sqrtPriceB: Fraction,
  liquidity: bigint,
  roundUp: boolean,
): bigint => {
  const [sqrtPrice0, sqrtPrice1] = fractionGreaterThan(sqrtPriceA, sqrtPriceB)
    ? [sqrtPriceB, sqrtPriceA]
    : [sqrtPriceA, sqrtPriceB];

  const numerator1 = liquidity * Q96;
  const numerator2 = fractionToQ96(sqrtPrice1) - fractionToQ96(sqrtPrice0);

  invariant(fractionGreaterThan(sqrtPrice0, 0));

  if (roundUp) {
    const x =
      (numerator1 * numerator2) % fractionToQ96(sqrtPrice1) !== 0n
        ? (numerator1 * numerator2) / fractionToQ96(sqrtPrice1) + 1n
        : (numerator1 * numerator2) / fractionToQ96(sqrtPrice1);
    return x % fractionToQ96(sqrtPrice0) !== 0n
      ? x / fractionToQ96(sqrtPrice0) + 1n
      : x / fractionToQ96(sqrtPrice0);
  } else {
    return (
      (numerator1 * numerator2) /
      fractionToQ96(sqrtPrice1) /
      fractionToQ96(sqrtPrice0)
    );
  }
};

const getAmount1DeltaRound = (
  sqrtPriceA: Fraction,
  sqrtPriceB: Fraction,
  liquidity: bigint,
  roundUp: boolean,
): bigint => {
  const [sqrtPrice0, sqrtPrice1] = fractionGreaterThan(sqrtPriceA, sqrtPriceB)
    ? [sqrtPriceB, sqrtPriceA]
    : [sqrtPriceA, sqrtPriceB];

  const numerator =
    liquidity * (fractionToQ96(sqrtPrice1) - fractionToQ96(sqrtPrice0));

  invariant(fractionGreaterThan(sqrtPrice0, 0));

  return numerator % Q96 !== 0n && roundUp
    ? numerator / Q96 + 1n
    : numerator / Q96;
};

export const getAmount0Delta = (
  sqrtPriceA: Fraction,
  sqrtPriceB: Fraction,
  liquidity: bigint,
): bigint =>
  liquidity < 0n
    ? -getAmount0DeltaRound(sqrtPriceA, sqrtPriceB, -liquidity, false)
    : getAmount0DeltaRound(sqrtPriceA, sqrtPriceB, liquidity, true);

export const getAmount1Delta = (
  sqrtPriceA: Fraction,
  sqrtPriceB: Fraction,
  liquidity: bigint,
): bigint =>
  liquidity < 0n
    ? -getAmount1DeltaRound(sqrtPriceA, sqrtPriceB, -liquidity, false)
    : getAmount1DeltaRound(sqrtPriceA, sqrtPriceB, liquidity, true);