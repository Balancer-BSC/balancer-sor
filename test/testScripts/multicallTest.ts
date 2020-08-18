require('dotenv').config();
import fetch from 'isomorphic-fetch';
const sor = require('../../src');
const BigNumber = require('bignumber.js');
import { Pool } from '../../src/direct/types';
import { BONE, calcOutGivenIn, calcInGivenOut } from '../../src/bmath';
import { JsonRpcProvider } from '@ethersproject/providers';
import _ from 'lodash'; // Import the entire lodash library

async function run() {
    const multicall = '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441';
    let provider = new JsonRpcProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`
    );
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
    const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
    const LINK = '0x514910771af9ca656af840dff83e8264ecf986ca';
    const IMBTC = '0x3212b29e33587a00fb1c83346f5dbfa69a458923';

    let allPools = await sor.getAllPublicSwapPools();
    let i = 0;
    while (i < 5) {
        console.log(allPools.pools.length);
        try {
            console.time('multi');
            let allPoolsOnChain = await sor.getAllPoolDataOnChain(
                allPools,
                multicall,
                provider
            );
            console.timeEnd('multi');
        } catch (error) {
            console.log(error);
            break;
        }

        let newPools = _.cloneDeep(allPools.pools);

        newPools = allPools.pools.concat(newPools);
        allPools.pools = newPools;

        i++;
    }

    return;
}

async function runParsePoolDataOnChain() {
    const multicall = '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441';
    let provider = new JsonRpcProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`
    );
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
    const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
    const LINK = '0x514910771af9ca656af840dff83e8264ecf986ca';
    const IMBTC = '0x3212b29e33587a00fb1c83346f5dbfa69a458923';

    let pools = await sor.getPoolsWithTokens(WETH, DAI);

    let i = 0;
    while (i < 5) {
        console.log(pools.pools.length);
        try {
            let allPoolsOnChain = await sor.parsePoolDataOnChain(
                pools.pools,
                WETH,
                DAI,
                multicall,
                provider
            );
        } catch (error) {
            console.log(error);
            break;
        }

        let newPools = _.cloneDeep(pools.pools);
        newPools = pools.pools.concat(newPools);
        pools.pools = newPools;
        i++;
    }

    return;
}

run();
// runParsePoolDataOnChain()
