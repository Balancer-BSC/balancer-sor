import { Set } from 'jsclass/src/set';
import { BigNumber } from './utils/bignumber';
import { getAddress } from '@ethersproject/address';
import { PoolPairData, Path } from './types';
import {
    BONE,
    TWOBONE,
    MAX_IN_RATIO,
    MAX_OUT_RATIO,
    bmul,
    bdiv,
    bnum,
    calcOutGivenIn,
    calcInGivenOut,
    scale,
} from './bmath';

export function toChecksum(address) {
    return getAddress(address);
}

export function getLimitAmountSwap(
    poolPairData: PoolPairData,
    swapType: string
): BigNumber {
    if (swapType === 'swapExactIn') {
        return bmul(poolPairData.balanceIn, MAX_IN_RATIO);
    } else {
        return bmul(poolPairData.balanceOut, MAX_OUT_RATIO);
    }
}

export function getLimitAmountSwapPath(
    pools: any[],
    path: Path,
    swapType: string
): BigNumber {
    let swaps = path.swaps;
    if (swaps.length == 1) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );
        return getLimitAmountSwap(poolPairDataSwap1, swapType);
    } else if (swaps.length == 2) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );

        let swap2 = swaps[1];
        let poolSwap2 = pools[swap2.pool];
        let poolPairDataSwap2 = parsePoolPairData(
            poolSwap2,
            swap2.tokenIn,
            swap2.tokenOut
        );

        if (swapType === 'swapExactIn') {
            return BigNumber.min(
                // The limit is either set by limit_IN of poolPairData 1 or indirectly by limit_IN of poolPairData 2
                getLimitAmountSwap(poolPairDataSwap1, swapType),
                bmul(
                    getLimitAmountSwap(poolPairDataSwap2, swapType),
                    getSpotPrice(poolPairDataSwap1)
                ) // we need to multiply the limit_IN of
                // poolPairData 2 by the spotPrice of poolPairData 1 to get the equivalent in token IN
            );
        } else {
            return BigNumber.min(
                // The limit is either set by limit_OUT of poolPairData 2 or indirectly by limit_OUT of poolPairData 1
                getLimitAmountSwap(poolPairDataSwap2, swapType),
                bdiv(
                    getLimitAmountSwap(poolPairDataSwap1, swapType),
                    getSpotPrice(poolPairDataSwap2)
                ) // we need to divide the limit_OUT of
                // poolPairData 1 by the spotPrice of poolPairData 2 to get the equivalent in token OUT
            );
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}

export function getSpotPricePath(pools: any[], path: Path): BigNumber {
    let swaps = path.swaps;
    if (swaps.length == 1) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );
        return getSpotPrice(poolPairDataSwap1);
    } else if (swaps.length == 2) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );

        let swap2 = swaps[1];
        let poolSwap2 = pools[swap2.pool];
        let poolPairDataSwap2 = parsePoolPairData(
            poolSwap2,
            swap2.tokenIn,
            swap2.tokenOut
        );

        return bmul(
            getSpotPrice(poolPairDataSwap1),
            getSpotPrice(poolPairDataSwap2)
        );
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}

export function getSpotPrice(poolPairData: PoolPairData): BigNumber {
    let inRatio = bdiv(poolPairData.balanceIn, poolPairData.weightIn);
    let outRatio = bdiv(poolPairData.balanceOut, poolPairData.weightOut);
    if (outRatio.isEqualTo(bnum(0))) {
        return bnum(0);
    } else {
        return bdiv(bdiv(inRatio, outRatio), BONE.minus(poolPairData.swapFee));
    }
}

export function getSlippageLinearizedSpotPriceAfterSwapPath(
    pools: any[],
    path: Path,
    swapType: string
): BigNumber {
    let swaps = path.swaps;
    if (swaps.length == 1) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );

        return getSlippageLinearizedSpotPriceAfterSwap(
            poolPairDataSwap1,
            swapType
        );
    } else if (swaps.length == 2) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let p1 = parsePoolPairData(poolSwap1, swap1.tokenIn, swap1.tokenOut);

        let swap2 = swaps[1];
        let poolSwap2 = pools[swap2.pool];
        let p2 = parsePoolPairData(poolSwap2, swap2.tokenIn, swap2.tokenOut);
        if (
            p1.balanceIn.isEqualTo(bnum(0)) ||
            p2.balanceIn.isEqualTo(bnum(0))
        ) {
            return bnum(0);
        } else {
            // Since the numerator is the same for both 'swapExactIn' and 'swapExactOut' we do this first
            // See formulas on https://one.wolframcloud.com/env/fernando.martinel/SOR_multihop_analysis.nb
            let numerator1 = bmul(
                bmul(
                    bmul(BONE.minus(p1.swapFee), BONE.minus(p2.swapFee)), // In mathematica both terms are the negative (which compensates)
                    p1.balanceOut
                ),
                bmul(p1.weightIn, p2.weightIn)
            );

            let numerator2 = bmul(
                bmul(
                    p1.balanceOut.plus(p2.balanceIn),
                    BONE.minus(p1.swapFee) // In mathematica this is the negative but we add (instead of subtracting) numerator2 to compensate
                ),
                bmul(p1.weightIn, p2.weightOut)
            );

            let numerator3 = bmul(
                p2.balanceIn,
                bmul(p1.weightOut, p2.weightOut)
            );

            let numerator = numerator1.plus(numerator2).plus(numerator3);

            // The denominator is different for 'swapExactIn' and 'swapExactOut'
            if (swapType === 'swapExactIn') {
                let denominator = bmul(
                    bmul(p1.balanceIn, p2.balanceIn),
                    bmul(p1.weightOut, p2.weightOut)
                );
                return bdiv(numerator, denominator);
            } else {
                let denominator = bmul(
                    bmul(BONE.minus(p1.swapFee), BONE.minus(p2.swapFee)),
                    bmul(
                        bmul(p1.balanceOut, p2.balanceOut),
                        bmul(p1.weightIn, p2.weightIn)
                    )
                );
                return bdiv(numerator, denominator);
            }
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}

export function getSlippageLinearizedSpotPriceAfterSwap(
    poolPairData: PoolPairData,
    swapType: string
): BigNumber {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = poolPairData;
    if (swapType === 'swapExactIn') {
        if (balanceIn.isEqualTo(bnum(0))) {
            return bnum(0);
        } else {
            return bdiv(
                bmul(BONE.minus(swapFee), bdiv(weightIn, weightOut)).plus(BONE),
                balanceIn
            );
        }
    } else {
        if (balanceOut.isEqualTo(bnum(0))) {
            return bnum(0);
        } else {
            return bdiv(
                bdiv(weightOut, bmul(BONE.minus(swapFee), weightIn)).plus(BONE),
                balanceOut
            );
        }
    }
}

export function getReturnAmountSwapPath(
    pools: any[],
    path: Path,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let swaps = path.swaps;
    if (swaps.length == 1) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );
        return getReturnAmountSwap(pools, poolPairDataSwap1, swapType, amount);
    } else if (swaps.length == 2) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );

        let swap2 = swaps[1];
        let poolSwap2 = pools[swap2.pool];
        let poolPairDataSwap2 = parsePoolPairData(
            poolSwap2,
            swap2.tokenIn,
            swap2.tokenOut
        );

        if (swapType === 'swapExactIn') {
            // The outputAmount is number of tokenOut we receive from the second poolPairData
            let returnAmountSwap1 = getReturnAmountSwap(
                pools,
                poolPairDataSwap1,
                swapType,
                amount
            );

            return getReturnAmountSwap(
                pools,
                poolPairDataSwap2,
                swapType,
                returnAmountSwap1
            );
        } else {
            // The outputAmount is number of tokenIn we send to the first poolPairData
            let returnAmountSwap2 = getReturnAmountSwap(
                pools,
                poolPairDataSwap2,
                swapType,
                amount
            );
            return getReturnAmountSwap(
                pools,
                poolPairDataSwap1,
                swapType,
                returnAmountSwap2
            );
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}

export function getReturnAmountSwap(
    pools: any[],
    poolPairData: PoolPairData,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let {
        weightIn,
        weightOut,
        balanceIn,
        balanceOut,
        swapFee,
        tokenIn,
        tokenOut,
    } = poolPairData;
    let returnAmount;
    if (swapType === 'swapExactIn') {
        if (balanceIn.isEqualTo(bnum(0))) {
            return bnum(0);
        } else {
            returnAmount = calcOutGivenIn(
                balanceIn,
                weightIn,
                balanceOut,
                weightOut,
                amount,
                swapFee
            );
            // Update balances of tokenIn and tokenOut
            pools[poolPairData.id] = updateTokenBalanceForPool(
                pools[poolPairData.id],
                tokenIn,
                balanceIn.plus(amount)
            );
            pools[poolPairData.id] = updateTokenBalanceForPool(
                pools[poolPairData.id],
                tokenOut,
                balanceOut.minus(returnAmount)
            );
            return returnAmount;
        }
    } else {
        if (balanceOut.isEqualTo(bnum(0))) {
            return bnum(0);
        } else {
            returnAmount = calcInGivenOut(
                balanceIn,
                weightIn,
                balanceOut,
                weightOut,
                amount,
                swapFee
            );
            // Update balances of tokenIn and tokenOut
            pools[poolPairData.id] = updateTokenBalanceForPool(
                pools[poolPairData.id],
                tokenIn,
                balanceIn.plus(returnAmount)
            );
            pools[poolPairData.id] = updateTokenBalanceForPool(
                pools[poolPairData.id],
                tokenOut,
                balanceOut.minus(amount)
            );
            return returnAmount;
        }
    }
}

// Updates the balance of a given token for a given pool passed as parameter
export function updateTokenBalanceForPool(
    pool: any,
    token: string,
    balance: BigNumber
): any {
    // console.log("pool")
    // console.log(pool)
    // console.log("token")
    // console.log(token)
    // console.log("balance")
    // console.log(balance)

    // Scale down back as balances are stored scaled down by the decimals
    let T = pool.tokens.find(t => t.address === token);
    T.balance = scale(balance, -T.decimals).toString(); // scale down, hence negative sign
    return pool;
}

// Based on the function of same name of file onchain-sor in file: BRegistry.sol
// Normalized liquidity is not used in any calculationf, but instead for comparison between poolPairDataList only
// so we can find the most liquid poolPairData considering the effect of uneven weigths
export function getNormalizedLiquidity(poolPairData: PoolPairData): BigNumber {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = poolPairData;
    return bdiv(bmul(balanceOut, weightIn), weightIn.plus(weightOut));
}

// LEGACY FUNCTION - Keep Input/Output Format
export const parsePoolData = (
    directPools,
    tokenIn: string,
    tokenOut: string,
    mostLiquidPoolsFirstHop = [],
    mostLiquidPoolsSecondHop = [],
    hopTokens = []
): [any, Path[]] => {
    let pathDataList: Path[] = [];
    let pools = {};
    // First add direct pair paths
    for (let i in directPools) {
        let p = directPools[i];
        // Add pool to the set with all pools (only adds if it's still not present in dict)
        pools[i] = p;

        // TODO remove since this is already being checked in the previous filters
        let balanceIn = p.tokens.find(
            t => getAddress(t.address) === getAddress(tokenIn)
        ).balance;
        let balanceOut = p.tokens.find(
            t => getAddress(t.address) === getAddress(tokenOut)
        ).balance;
        // TODO remove since this is already being checked in the previous filters
        if (balanceIn != 0 && balanceOut != 0) {
            let swap = {
                pool: p.id,
                tokenIn: tokenIn,
                tokenOut: tokenOut,
            };

            let path = {
                id: p.id,
                swaps: [swap],
            };
            pathDataList.push(path);
        }
    }

    // Now add multi-hop paths.
    // mostLiquidPoolsFirstHop and mostLiquidPoolsSecondHop always has the same
    // lengh of hopTokens
    for (let i = 0; i < hopTokens.length; i++) {
        // Add pools to the set with all pools (only adds if it's still not present in dict)
        pools[mostLiquidPoolsFirstHop[i].id] = mostLiquidPoolsFirstHop[i];
        pools[mostLiquidPoolsSecondHop[i].id] = mostLiquidPoolsSecondHop[i];

        // // Only add path if the balances are both not zero for first and second hops
        // console.log("poolFirstHop")
        // console.log(poolFirstHop)
        // console.log("poolSecondHop")
        // console.log(poolSecondHop)
        // console.log("tokenIn")
        // console.log(tokenIn)
        // console.log("hopTokens[i]")
        // console.log(hopTokens[i])
        // console.log("tokenOut")
        // console.log(tokenOut)

        // TODO remove since this is already being checked in the previous filters
        let poolFirstHopBalanceIn = mostLiquidPoolsFirstHop[i].tokens.find(
            t => getAddress(t.address) === getAddress(tokenIn)
        ).balance;
        let poolFirstHopBalanceOut = mostLiquidPoolsFirstHop[i].tokens.find(
            t => getAddress(t.address) === getAddress(hopTokens[i])
        ).balance;
        let poolSecondHopBalanceIn = mostLiquidPoolsSecondHop[i].tokens.find(
            t => getAddress(t.address) === getAddress(hopTokens[i])
        ).balance;
        let poolSecondHopBalanceOut = mostLiquidPoolsSecondHop[i].tokens.find(
            t => getAddress(t.address) === getAddress(tokenOut)
        ).balance;

        // TODO remove since this is already being checked in the previous filters
        if (
            poolFirstHopBalanceIn != 0 &&
            poolFirstHopBalanceOut != 0 &&
            poolSecondHopBalanceIn != 0 &&
            poolSecondHopBalanceOut != 0
        ) {
            let swap1 = {
                pool: mostLiquidPoolsFirstHop[i].id,
                tokenIn: tokenIn,
                tokenOut: hopTokens[i],
            };

            let swap2 = {
                pool: mostLiquidPoolsSecondHop[i].id,
                tokenIn: hopTokens[i],
                tokenOut: tokenOut,
            };

            let path = {
                id:
                    mostLiquidPoolsFirstHop[i].id +
                    mostLiquidPoolsSecondHop[i].id, // Path id is the concatenation of the ids of poolFirstHop and poolSecondHop
                swaps: [swap1, swap2],
            };
            pathDataList.push(path);
        }
    }
    return [pools, pathDataList];
};

export const parsePoolPairData = (
    p,
    tokenIn: string,
    tokenOut: string
): PoolPairData => {
    // console.log("Pool")
    // console.log(p)
    // console.log("tokenIn")
    // console.log(tokenIn)
    // console.log("tokenOut")
    // console.log(tokenOut)

    let tI = p.tokens.find(t => getAddress(t.address) === getAddress(tokenIn));
    // console.log("tI")
    // console.log(tI)
    let tO = p.tokens.find(t => getAddress(t.address) === getAddress(tokenOut));

    // console.log("tO")
    // console.log(tO)

    let poolPairData = {
        id: p.id,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        decimalsIn: tI.decimals,
        decimalsOut: tO.decimals,
        balanceIn: scale(bnum(tI.balance), tI.decimals),
        balanceOut: scale(bnum(tO.balance), tO.decimals),
        weightIn: scale(bnum(tI.denormWeight).div(bnum(p.totalWeight)), 18),
        weightOut: scale(bnum(tO.denormWeight).div(bnum(p.totalWeight)), 18),
        swapFee: scale(bnum(p.swapFee), 18),
    };

    return poolPairData;
};

function filterPoolsWithoutToken(pools, token) {
    var found;
    var OutputPools = {};
    for (let i in pools) {
        found = false;
        for (var k = 0; k < pools[i].tokensList.length; k++) {
            if (pools[i].tokensList[k].toLowerCase() == token.toLowerCase()) {
                found = true;
                break;
            }
        }
        //Add pool if token not found
        if (!found) OutputPools[i] = pools[i];
    }
    return OutputPools;
}

// Inputs:
// - pools: All pools that contain a token
// - token: Token for which we are looking for pairs
// Outputs:
// - tokens: Set (without duplicate elements) of all tokens that pair with token
function getTokensPairedToTokenWithinPools(pools, token) {
    var found;
    var tokens = new Set();
    for (let i in pools) {
        found = false;
        for (var k = 0; k < pools[i].tokensList.length; k++) {
            if (
                getAddress(pools[i].tokensList[k]) != getAddress(token) &&
                pools[i].tokens.find(
                    t =>
                        getAddress(t.address) ===
                        getAddress(pools[i].tokensList[k])
                ).balance != 0
            ) {
                tokens.add(pools[i].tokensList[k]);
            }
        }
    }
    return tokens;
}

function union(setA, setB) {
    if (setA.size == 0) {
        return new Set(setB);
    }

    let _union = new Set(setA);

    setB.forEach((address, index) => {
        _union.add(address);
    });

    return _union;
}

// Returns two arrays
// First array contains all tokens in direct pools containing tokenIn
// Second array contains all tokens in multi-hop pools containing tokenIn
export function getTokenPairsMultiHop(token: string, poolsTokensListSet: any) {
    let poolsWithToken = new Set();
    let poolsWithoutToken = new Set();

    let directTokenPairsSet = new Set();

    // If pool contains token add all its tokens to direct list
    poolsTokensListSet.forEach((poolTokenList, index) => {
        if (poolTokenList.contains(token)) poolsWithToken.add(poolTokenList);
        else poolsWithoutToken.add(poolTokenList);
    });

    directTokenPairsSet = poolsWithToken.flatten();

    let multihopTokenPools = new Set();
    let multihopTokenPairsSet = new Set();

    poolsWithoutToken.forEach((pool, index) => {
        if (!pool.intersection(directTokenPairsSet).isEmpty())
            multihopTokenPools.add(pool);
    });

    multihopTokenPairsSet = multihopTokenPools.flatten();
    let allTokenPairsSet = new Set();
    allTokenPairsSet = directTokenPairsSet.union(multihopTokenPairsSet);

    // console.log("allTokenPairsSet")
    // console.log(allTokenPairsSet)

    let directTokenPairs = directTokenPairsSet.toArray();
    let allTokenPairs = allTokenPairsSet.toArray();
    return [directTokenPairs, allTokenPairs];
}

// Filters all pools data to find pools that have both tokens
// TODO: Check for balance > 0
export function filterPoolsWithTokensDirect(
    allPools: any, // The complete information of the pools
    tokenIn: string,
    tokenOut: string
) {
    let poolsWithTokens = {};
    let tokens = new Set([tokenIn, tokenOut]);
    // If pool contains token add all its tokens to direct list
    allPools.forEach(pool => {
        if (tokens.isSubset(new Set(pool.tokensList)))
            poolsWithTokens[pool.id] = pool;
    });

    return poolsWithTokens;
}

// Returns two pool lists. One with all pools containing tokenOne and not tokenTwo and one with tokenTwo not tokenOn.
export function filterPoolsWithoutMutualTokens(
    allPools: any,
    tokenOne: string,
    tokenTwo: string
) {
    let tokenOnePools = {};
    let tokenTwoPools = {};
    let tokenOnePairedTokens = new Set();
    let tokenTwoPairedTokens = new Set();

    allPools.forEach(pool => {
        let poolTokensSET = new Set(pool.tokensList);
        let containsTokenOne = poolTokensSET.contains(tokenOne);
        let containsTokenTwo = poolTokensSET.contains(tokenTwo);

        if (containsTokenOne && !containsTokenTwo) {
            tokenOnePairedTokens.merge(poolTokensSET);
            tokenOnePools[pool.id] = pool;
        } else if (!containsTokenOne && containsTokenTwo) {
            tokenTwoPairedTokens.merge(poolTokensSET);
            tokenTwoPools[pool.id] = pool;
        }
    });

    return [
        tokenOnePools,
        tokenOnePairedTokens,
        tokenTwoPools,
        tokenTwoPairedTokens,
    ];
}

// Replacing getMultihopPoolsWithTokens
export async function filterPoolsWithTokensMultihop(
    allPools: any, // Just the list of pool tokens
    tokenIn: string,
    tokenOut: string
) {
    //// Multi-hop trades: we find the best pools that connect tokenIn and tokenOut through a multi-hop (intermediate) token
    // First: we get all tokens that can be used to be traded with tokenIn excluding
    // tokens that are in pools that already contain tokenOut (in which case multi-hop is not necessary)
    let poolsTokenInNoTokenOut,
        tokenInHopTokens,
        poolsTokenOutNoTokenIn,
        tokenOutHopTokens;

    // STOPPED HERE: poolsTokenInNoTokenOut NEEDS
    [
        poolsTokenInNoTokenOut,
        tokenInHopTokens,
        poolsTokenOutNoTokenIn,
        tokenOutHopTokens,
    ] = filterPoolsWithoutMutualTokens(allPools, tokenIn, tokenOut);

    // console.log("poolsTokenInNoTokenOut")
    // console.log(poolsTokenInNoTokenOut)
    // console.log("poolsTokenOutNoTokenIn")
    // console.log(poolsTokenOutNoTokenIn)
    // console.log("tokenInHopTokens")
    // console.log(tokenInHopTokens)
    // console.log("tokenOutHopTokens")
    // console.log(tokenOutHopTokens)

    // Third: we find the intersection of the two previous sets so we can trade tokenIn for tokenOut with 1 multi-hop
    // code from https://stackoverflow.com/a/31931146
    var hopTokensSet = tokenInHopTokens.intersection(tokenOutHopTokens);
    // console.log("hopTokensSet")
    // console.log(hopTokensSet)

    // Transform set into Array
    var hopTokens = hopTokensSet.toArray();
    // console.log(hopTokens);

    // Find the most liquid pool for each pair (tokenIn -> hopToken). We store an object in the form:
    // mostLiquidPoolsFirstHop = {hopToken1: mostLiquidPool, hopToken2: mostLiquidPool, ... , hopTokenN: mostLiquidPool}
    // Here we could query subgraph for all pools with pair (tokenIn -> hopToken), but to
    // minimize subgraph calls we loop through poolsTokenInNoTokenOut, and check the liquidity
    // only for those that have hopToken
    var mostLiquidPoolsFirstHop = [];
    for (var i = 0; i < hopTokens.length; i++) {
        var highestNormalizedLiquidity = bnum(0); // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        var highestNormalizedLiquidityPoolId; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        for (let k in poolsTokenInNoTokenOut) {
            // If this pool has hopTokens[i] calculate its normalized liquidity
            if (
                new Set(poolsTokenInNoTokenOut[k].tokensList).contains(
                    hopTokens[i]
                )
            ) {
                let normalizedLiquidity = getNormalizedLiquidity(
                    parsePoolPairData(
                        poolsTokenInNoTokenOut[k],
                        tokenIn,
                        hopTokens[i].toString()
                    )
                );

                if (
                    normalizedLiquidity.isGreaterThanOrEqualTo(
                        // Cannot be strictly greater otherwise
                        // highestNormalizedLiquidityPoolId = 0 if hopTokens[i] balance is 0 in this pool.
                        highestNormalizedLiquidity
                    )
                ) {
                    highestNormalizedLiquidity = normalizedLiquidity;
                    highestNormalizedLiquidityPoolId = k;
                }
            }
        }
        mostLiquidPoolsFirstHop[i] =
            poolsTokenInNoTokenOut[highestNormalizedLiquidityPoolId];
        // console.log(highestNormalizedLiquidity)
        // console.log(mostLiquidPoolsFirstHop)
    }

    // console.log('mostLiquidPoolsFirstHop');
    // console.log(mostLiquidPoolsFirstHop);

    // Now similarly find the most liquid pool for each pair (hopToken -> tokenOut)
    var mostLiquidPoolsSecondHop = [];
    for (var i = 0; i < hopTokens.length; i++) {
        var highestNormalizedLiquidity = bnum(0); // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        var highestNormalizedLiquidityPoolId; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        for (let k in poolsTokenOutNoTokenIn) {
            // If this pool has hopTokens[i] calculate its normalized liquidity
            if (
                new Set(poolsTokenOutNoTokenIn[k].tokensList).contains(
                    hopTokens[i]
                )
            ) {
                let normalizedLiquidity = getNormalizedLiquidity(
                    parsePoolPairData(
                        poolsTokenOutNoTokenIn[k],
                        hopTokens[i].toString(),
                        tokenOut
                    )
                );

                if (
                    normalizedLiquidity.isGreaterThanOrEqualTo(
                        // Cannot be strictly greater otherwise
                        // highestNormalizedLiquidityPoolId = 0 if hopTokens[i] balance is 0 in this pool.
                        highestNormalizedLiquidity
                    )
                ) {
                    highestNormalizedLiquidity = normalizedLiquidity;
                    highestNormalizedLiquidityPoolId = k;
                }
            }
        }
        mostLiquidPoolsSecondHop[i] =
            poolsTokenOutNoTokenIn[highestNormalizedLiquidityPoolId];
        // console.log(highestNormalizedLiquidity)
        // console.log(mostLiquidPoolsSecondHop)
    }
    return [mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens];
}

export function filterAllPools(allPools: any) {
    let allTokensSet = new Set();
    let allPoolsNonZeroBalances = [];

    let i = 0;

    allPools.pools.forEach(pool => {
        // Build list of non-zero balance pools
        // Only check first balance since AFAIK either all balances are zero or none are:
        if (pool.tokens.length != 0) {
            if (pool.tokens[0].balance != '0') {
                var tokensListSet = new Set(pool.tokensList);
                allTokensSet.add(tokensListSet); // Will add without duplicate
                allPoolsNonZeroBalances.push(pool);
                i++;
            }
        }
    });

    return [allTokensSet, allPoolsNonZeroBalances];
}
