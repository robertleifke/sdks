import { createFraction } from "reverse-mirage";
import {
  http,
  createPublicClient,
  createTestClient,
  createWalletClient,
} from "viem";
import { foundry } from "viem/chains";
import type { Chain } from "viem/chains";
import type { PanopticCollateralParamters } from "../index.js";
import { ALICE } from "./constants.js";

export const pool = Number(process.env.VITEST_POOL_ID ?? 1);
export const anvil = {
  ...foundry, // We are using a mainnet fork for testing.
  id: foundry.id,
  rpcUrls: {
    // These rpc urls are automatically used in the transports.
    default: {
      // Note how we append the worker id to the local rpc urls.
      http: [`http://127.0.0.1:8545/${pool}`],
      webSocket: [`ws://127.0.0.1:8545/${pool}`],
    },
    public: {
      // Note how we append the worker id to the local rpc urls.
      http: [`http://127.0.0.1:8545/${pool}`],
      webSocket: [`ws://127.0.0.1:8545/${pool}`],
    },
  },
} as const satisfies Chain;

export const testClient = createTestClient({
  chain: anvil,
  mode: "anvil",
  transport: http(),
});

export const publicClient = createPublicClient({
  chain: anvil,
  transport: http(),
});

export const walletClient = createWalletClient({
  chain: anvil,
  transport: http(),
  account: ALICE,
});

export const baseParameters: PanopticCollateralParamters = {
  type: "panopticCollateralParameters",
  maintenanceMarginRatio: createFraction(13_333, 10_000),
  commissionFee: createFraction(10, 10_000),
  ITMSpreadFee: createFraction(60, 10_000),
  sellCollateralRatio: createFraction(2_000, 10_000),
  buyCollateralRatio: createFraction(1_000, 10_000),
  targetPoolUtilization: createFraction(5_000, 10_000),
  saturatedPoolUtilization: createFraction(9_000, 10_000),
  exerciseCost: createFraction(-1_024, 10_000),
};