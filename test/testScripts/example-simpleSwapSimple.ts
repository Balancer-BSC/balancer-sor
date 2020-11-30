// Example showing full swaps with timings - run using: $ ts-node ./test/testScripts/example-swapExactIn.ts
require('dotenv').config();
const sor = require('../../src');
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI Address
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC Address
const uUSD = '0xD16c79c8A39D44B2F3eB45D2019cd6A42B03E2A9'; // uUSDwETH Synthetic Token
const AMPL = '0xd46ba6d942050d489dbd938a2c909a5d5039a161';

async function simpleSwap() {
    // If running this example make sure you have a .env file saved in root DIR with INFURA=your_key
    const provider = new JsonRpcProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`
    );

    // gasPrice is used by SOR as a factor to determine how many pools to swap against.
    // i.e. higher cost means more costly to trade against lots of different pools.
    // Can be changed in future using SOR.gasPrice = newPrice
    const gasPrice = new BigNumber('30000000000');
    // This determines the max no of pools the SOR will use to swap.
    const maxNoPools = 4;
    const chainId = 1;

    const poolsUrl = `https://ipfs.io/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange/pools`;

    const SOR = new sor.SOR(provider, gasPrice, maxNoPools, chainId, poolsUrl);

    const tokenIn = AMPL;
    const tokenOut = USDC;
    const swapType = 'swapExactIn'; // Two different swap types are used: swapExactIn & swapExactOut
    let amountIn = new BigNumber('1000000000000'); // 1 USDC, Always pay attention to Token Decimals. i.e. In this case USDC has 6 decimals.

    console.log(
        `\n************** First Call, Without All Pools - Loading Subset of Pools For Pair`
    );

    console.time(`totalCallNoPools`);
    // This calculates the cost to make a swap which is used as an input to SOR to allow it to make gas efficient recommendations.
    // Can be set once and will be used for further swap calculations.
    // Defaults to 0 if not called or can be set manually using: await SOR.setCostOutputToken(tokenOut, manualPriceBn)
    console.time(`setCostOutputToken`);
    await SOR.setCostOutputToken(tokenOut);
    console.timeEnd(`setCostOutputToken`);

    // This fetches a subset of pair pools onchain information
    console.time('fetchFilteredPairPools');
    await SOR.fetchFilteredPairPools(tokenIn, tokenOut);
    console.timeEnd('fetchFilteredPairPools');

    // First call so any paths must be processed so this call will take longer than cached in future.
    console.time('withOutPathsCache');
    let [swaps, amountOut] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountIn
    );
    console.timeEnd('withOutPathsCache');
    console.timeEnd(`totalCallNoPools`);

    console.log(
        `AMPL>USDC, SwapExactIn, ${amountIn.toString()}, Total USDC Return: ${amountOut.toString()}`
    );
    console.log(`Swaps: `);
    console.log(swaps);
}

simpleSwap();
