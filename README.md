# Jukebox Auction

A crypto-powered digital jukebox where 15-minute music blocks are auctioned off for USDC.

## Concept

Users scan a QR code, connect a Solana wallet, bid in USDC, and compete for control of the next 15-minute music block.

The highest bidder wins the block and can choose the songs that play during that time.

## Vision

Transform music selection into a live marketplace.

Customers compete for control of the next 15-minute music block by bidding USDC. The highest bidder wins control of the playlist for that block.

## MVP Features

- Venue creates a live jukebox auction
- Customers scan a QR code
- Users connect Phantom wallet
- Users bid in USDC
- Highest bidder wins the next 15-minute block
- Winner selects songs
- Admin/DJ can approve, reject, skip, or override songs
- Venue screen displays current auction and winner

## Tech Stack

- Frontend: Next.js
- Backend: Node.js / Express
- Database: Supabase Postgres
- Payments: Solana USDC
- Wallet: Solana Wallet Adapter
- Realtime Updates: Supabase Realtime or Socket.io
- Music API: Spotify API

## Auction Flow

1. Venue starts an auction for the next 15-minute block.
2. Customers scan the QR code.
3. Users connect their wallet.
4. Users select songs and place a USDC bid.
5. Backend verifies payment on Solana.
6. Highest valid bid wins.
7. Winner controls the next 15-minute block.
8. A new auction starts for the next block.

## Revenue Model

The venue keeps the winning USDC bid.

Future options:

- Split revenue with DJs
- Reward token holders
- Burn a project token
- Add sponsor-funded blocks
- Add livestream mode


## Project Structure

```txt
apps/
  web/              Customer app, venue screen, admin dashboard

server/
  api/              Backend API
  workers/          Auction and payment jobs

database/           Supabase schema

docs/               Product specs and setup notes
```
## Development Roadmap

### Phase 1 - MVP

- Create venue dashboard
- Create auction system
- Connect Phantom wallet
- Accept USDC bids
- Display highest bidder
- Select auction winner
- Manual song approval

### Phase 2

- Spotify integration
- Automatic playlist control
- Multiple venues
- QR code generation

### Phase 3

- Livestream support
- Revenue sharing
- Mobile app
- Advanced analytics
- ## Auction Rules

- Auctions run continuously in 15-minute blocks.
- Each new bid must exceed the current highest bid.
- Bids are paid in USDC on Solana.
- Winning bids are non-refundable.
- The highest bidder at auction close wins control of the next 15-minute block.
- Winning users may queue up to X songs.
- Venue admins can reject songs that violate venue policies.
- The venue maintains final control over playback.
- ## Future Enhancements

- Dynamic bidding increments
- NFT membership perks
- Venue leaderboards
- Multi-location support
- Artist promotion campaigns
- Sponsor-funded music blocks
- Revenue sharing with DJs

