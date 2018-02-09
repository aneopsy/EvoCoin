class Policy {
    static get SATOSHIS_PER_COIN() {
        return 1e8;
    }

    static get BLOCK_TIME() {
        return 10; // Seconds
    }

    static get BLOCK_REWARD() {
        return Policy.coinsToSatoshis(1);
    }

    static get BLOCK_SIZE_MAX() {
        return 1e6; // 1 MB
    }

    static get BLOCK_TARGET_MAX() {
        return BlockUtils.compactToTarget(0x1d00ffff); // 21 -> 16 zero bits, bitcoin uses 32 (0x1d00ffff)
    }

    static get DIFFICULTY_ADJUSTMENT_BLOCKS() {
        return 5; // Blocks
    }

    static coinsToSatoshis(coins) {
        return Math.round(coins * Policy.SATOSHIS_PER_COIN);
    }

    static satoshisToCoins(satoshis) {
        return satoshis / Policy.SATOSHIS_PER_COIN;
    }
}
Class.register(Policy);
