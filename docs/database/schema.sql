-- USERS

CREATE TABLE users (
    wallet_address TEXT PRIMARY KEY,
    username TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- AUCTIONS

CREATE TABLE auctions (
    id UUID PRIMARY KEY,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status TEXT NOT NULL,
    current_high_bid NUMERIC(18,6) DEFAULT 0,
    winning_wallet TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- BIDS

CREATE TABLE bids (
    id UUID PRIMARY KEY,
    auction_id UUID REFERENCES auctions(id),
    wallet_address TEXT REFERENCES users(wallet_address),
    amount NUMERIC(18,6) NOT NULL,
    tx_signature TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- PLAYLIST BLOCKS

CREATE TABLE playlist_blocks (
    id UUID PRIMARY KEY,
    auction_id UUID REFERENCES auctions(id),
    owner_wallet TEXT REFERENCES users(wallet_address),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- SONGS

CREATE TABLE songs (
    id UUID PRIMARY KEY,
    playlist_block_id UUID REFERENCES playlist_blocks(id),
    title TEXT NOT NULL,
    artist TEXT,
    spotify_id TEXT,
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
