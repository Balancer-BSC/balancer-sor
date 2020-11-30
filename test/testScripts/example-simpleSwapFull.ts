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
    // const poolsUrl = `https://cloudflare-ipfs.com/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange/pools`;
    // const poolsUrl = `https://ipfs.io/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange-kovan/pools`;
    // const poolsUrl = `https://cloudflare-ipfs.com/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange-kovan/pools`;
    // const poolsUrl = `https://raw.githubusercontent.com/balancer-labs/balancer-exchange/8615273ca006dba50fd12051535a68ad058f0611/src/allPublicPools.json`;

    const SOR = new sor.SOR(provider, gasPrice, maxNoPools, chainId, poolsUrl);

    const tokenIn = AMPL;
    const tokenOut = USDC;
    const swapType = 'swapExactIn'; // Two different swap types are used: swapExactIn & swapExactOut
    let amountIn = new BigNumber('1000000000000'); // 1 USDC, Always pay attention to Token Decimals. i.e. In this case USDC has 6 decimals.

    await SOR.setCostOutputToken(tokenOut);

    // This fetches all pools list from URL in constructor then onChain balances using Multicall
    let fetch = SOR.fetchPools();
    await fetch;

    let isAllPoolsFetched = SOR.isAllFetched;
    console.log(`Are all pools fetched: ${isAllPoolsFetched}`);

    console.log(
        `\n**************  Fetch All Pools In Background - Get swap (exactIn) using previously fetched filtered pools`
    );

    console.time(`getSwapsWithFilteredPoolsExactIn`);
    let [swaps, amountOut] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountIn
    );
    console.timeEnd(`getSwapsWithFilteredPoolsExactIn`);

    console.log(
        `AMPL>USDC, SwapExactIn, ${amountIn.toString()}, Total USDC Return: ${amountOut.toString()}`
    );
    console.log(`Swaps: `);
    console.log(swaps);
}

simpleSwap();
