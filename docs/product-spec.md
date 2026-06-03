# Jukebox Auction Product Specification

## Overview

Jukebox Auction is a crypto-powered music marketplace where customers compete for control of upcoming 15-minute music blocks by bidding USDC on Solana.

The highest bidder at the end of an auction wins control of the next music block and can queue approved songs.

The system is designed for bars, clubs, restaurants, livestreams, and entertainment venues.

---

# User Types

## Customer

A customer who wants to bid for control of music.

Capabilities:

* Connect Solana wallet
* View active auction
* Submit bids
* View highest bid
* Control the playlist during their winning 15-minute block.
* View auction history

## Venue Owner

The venue hosting the auction.

Capabilities:

* Start auctions
* Stop auctions
* Configure auction settings
* View revenue
* Manage playback
* View bid history

## DJ / Moderator

The person controlling music quality.

Capabilities:

* Approve songs
* Reject songs
* Skip songs
* Override winner selections
* Ban songs and artists

---

# Auction Rules

* Auctions run continuously.
* Each auction controls one 15-minute music block.
* Bids are paid in USDC.
* Bids are non-refundable.
* Highest valid bid wins.
* Winner receives control of the next 15-minute block.
* Winner may queue approved songs.
* Venue staff maintain final playback authority.

---

# Customer Screen

## Main Components

### Current Auction

Display:

* Current highest bid
* Current leader
* Countdown timer
* Auction status

### Bid Panel

Display:

* Bid amount input
* Connect wallet button
* Submit bid button

### Auction History

Display:

* Previous winners
* Winning bid amounts

---

# Venue Display Screen

Large-screen display visible to customers.

Display:

* Current song
* Current highest bid
* Current leader
* Countdown timer
* QR code
* Upcoming winner

Updates in real time.

---

# Admin Dashboard

## Auction Controls

* Start auction
* End auction
* Pause auction
* Reset auction

## Song Controls

* Approve songs
* Reject songs
* Skip songs
* Remove songs

## Revenue Dashboard

Display:

* Daily revenue
* Weekly revenue
* Monthly revenue
* Total auctions
* Average winning bid

---

# Payment System

Supported Currency:

* USDC on Solana

Supported Wallets:

* Phantom
* Solflare
* Backpack

Payment Flow:

1. User enters bid.
2. User signs transaction.
3. Backend verifies payment.
4. Bid is recorded.
5. Highest bid updates in real time.

---

# Song Queue System

Winner may:

* Add songs
* Reorder songs
* Remove songs

Moderator may:

* Approve songs
* Reject songs
* Skip songs

---

# Database Entities

## Venues

* id
* name
* wallet_address
* created_at

## Auctions

* id
* venue_id
* start_time
* end_time
* status

## Bids

* id
* auction_id
* wallet_address
* amount
* timestamp

## Songs

* id
* auction_id
* title
* artist
* spotify_id

## Users

* wallet_address
* created_at

---

# MVP Success Criteria

A user can:

1. Scan a QR code.
2. Connect a wallet.
3. Bid USDC.
4. Become highest bidder.
5. Win an auction.
6. Queue songs.
7. Have songs appear in the venue queue.

A venue can:

1. Start auctions.
2. View bids.
3. View winners.
4. Approve songs.
5. Display results on a public screen.
