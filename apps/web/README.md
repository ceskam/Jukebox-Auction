# Web Application Specification

## Purpose

The web application is the primary user interface for Jukebox Auction.

Users connect their Solana wallet, bid USDC on active auctions, and control playlist blocks if they win.

---

## Pages

### Home Page (/)

Displays:

* Current auction
* Highest bid
* Countdown timer
* Current playlist owner
* Connect wallet button
* Bid button

---

### Auction Page (/auction)

Displays:

* Active auction
* Bid history
* Highest bidder
* Bid form
* Auction timer

Functions:

* Connect wallet
* Submit bid
* View auction results

---

### Playlist Page (/playlist)

Displays:

* Current playlist block owner
* Songs in queue
* Remaining block time

Functions:

* Add songs
* Remove songs
* Reorder songs

Only accessible to the winning user.

---

### Admin Dashboard (/admin)

Displays:

* Current auction
* Bid history
* Revenue metrics
* Playlist queue

Functions:

* Start auction
* End auction
* Approve songs
* Reject songs
* Skip songs

---

## Wallet Integration

Supported Wallets:

* Phantom
* Solflare
* Backpack

---

## Realtime Features

* Live highest bid updates
* Live countdown timer
* Live playlist updates
* Live auction results

---

## MVP Goal

A user can:

1. Connect wallet.
2. Place a USDC bid.
3. Win an auction.
4. Control a 15-minute playlist block.
5. Add songs to the queue.

An admin can:

1. Manage auctions.
2. Moderate songs.
3. View revenue.
4. Manage playlist blocks.

---

## Initial Application Structure

```text
apps/web/app/page.tsx
apps/web/app/auction/page.tsx
apps/web/app/playlist/page.tsx
apps/web/app/admin/page.tsx
``` 
