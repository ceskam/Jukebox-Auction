use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer},
};

declare_id!("4uGLaaP4KGHMPHya2YuakkrbnuaGMvo37N88nZCrEFyA");

const BID_DEPOSITED: u8 = 0;
const BID_SETTLED: u8 = 1;
const BID_REFUNDED: u8 = 2;
const WINNER_NONE: u8 = 0;
const WINNER_WALLET: u8 = 1;
const WINNER_CARD: u8 = 2;

#[program]
pub mod adbidcoin_escrow {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.usdc_mint = ctx.accounts.usdc_mint.key();
        config.treasury_token_account = ctx.accounts.treasury_token_account.key();
        config.bump = ctx.bumps.config;
        emit!(ConfigInitialized { authority: config.authority, treasury_token_account: config.treasury_token_account });
        Ok(())
    }

    pub fn initialize_auction(ctx: Context<InitializeAuction>, sequence: u64, closes_at: i64) -> Result<()> {
        require!(closes_at > Clock::get()?.unix_timestamp, EscrowError::AuctionAlreadyClosed);
        let auction = &mut ctx.accounts.auction;
        auction.sequence = sequence;
        auction.closes_at = closes_at;
        auction.finalized = false;
        auction.winner_kind = WINNER_NONE;
        auction.winning_bid = Pubkey::default();
        auction.highest_wallet_amount = 0;
        auction.highest_wallet_bid = Pubkey::default();
        auction.bid_count = 0;
        auction.bump = ctx.bumps.auction;
        emit!(AuctionInitialized { auction: auction.key(), sequence, closes_at });
        Ok(())
    }

    pub fn deposit_bid(ctx: Context<DepositBid>, amount: u64, nonce: u64) -> Result<()> {
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(!ctx.accounts.auction.finalized, EscrowError::AuctionFinalized);
        require!(Clock::get()?.unix_timestamp < ctx.accounts.auction.closes_at, EscrowError::AuctionAlreadyClosed);
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bidder_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.bidder.to_account_info(),
                },
            ),
            amount,
        )?;
        let bid = &mut ctx.accounts.bid;
        bid.auction = ctx.accounts.auction.key();
        bid.bidder = ctx.accounts.bidder.key();
        bid.amount = amount;
        bid.nonce = nonce;
        bid.status = BID_DEPOSITED;
        bid.bump = ctx.bumps.bid;
        if amount > ctx.accounts.auction.highest_wallet_amount {
            ctx.accounts.auction.highest_wallet_amount = amount;
            ctx.accounts.auction.highest_wallet_bid = bid.key();
        }
        ctx.accounts.auction.bid_count = ctx.accounts.auction.bid_count.checked_add(1).ok_or(EscrowError::MathOverflow)?;
        emit!(BidDeposited { auction: bid.auction, bid: bid.key(), bidder: bid.bidder, amount });
        Ok(())
    }

    pub fn finalize_auction(ctx: Context<FinalizeAuction>, winner_kind: u8) -> Result<()> {
        require!(winner_kind <= WINNER_CARD, EscrowError::InvalidWinnerKind);
        require!(Clock::get()?.unix_timestamp >= ctx.accounts.auction.closes_at, EscrowError::AuctionStillOpen);
        require!(!ctx.accounts.auction.finalized, EscrowError::AuctionFinalized);
        if winner_kind == WINNER_WALLET {
            require_keys_eq!(*ctx.accounts.winning_bid.owner, crate::ID, EscrowError::InvalidWinningBid);
            let data = ctx.accounts.winning_bid.try_borrow_data()?;
            let mut data_slice: &[u8] = data.as_ref();
            let winner = BidEscrow::try_deserialize(&mut data_slice)?;
            require_keys_eq!(winner.auction, ctx.accounts.auction.key(), EscrowError::InvalidWinningBid);
            require!(winner.status == BID_DEPOSITED, EscrowError::BidAlreadySettled);
            require_keys_eq!(ctx.accounts.auction.highest_wallet_bid, ctx.accounts.winning_bid.key(), EscrowError::InvalidWinningBid);
        }
        let auction = &mut ctx.accounts.auction;
        auction.finalized = true;
        auction.winner_kind = winner_kind;
        auction.winning_bid = if winner_kind == WINNER_WALLET { ctx.accounts.winning_bid.key() } else { Pubkey::default() };
        emit!(AuctionFinalized { auction: auction.key(), winner_kind, winning_bid: auction.winning_bid });
        Ok(())
    }

    pub fn settle_bid(ctx: Context<SettleBid>) -> Result<()> {
        require!(ctx.accounts.auction.finalized, EscrowError::AuctionNotFinalized);
        require!(ctx.accounts.bid.status == BID_DEPOSITED, EscrowError::BidAlreadySettled);
        let is_winner = ctx.accounts.auction.winner_kind == WINNER_WALLET
            && ctx.accounts.auction.winning_bid == ctx.accounts.bid.key();
        if is_winner {
            require_keys_eq!(ctx.accounts.destination.key(), ctx.accounts.config.treasury_token_account, EscrowError::InvalidDestination);
        } else {
            require_keys_eq!(ctx.accounts.destination.owner, ctx.accounts.bid.bidder, EscrowError::InvalidDestination);
            require_keys_eq!(ctx.accounts.destination.mint, ctx.accounts.config.usdc_mint, EscrowError::InvalidDestination);
        }

        let auction_key = ctx.accounts.bid.auction;
        let bidder_key = ctx.accounts.bid.bidder;
        let nonce = ctx.accounts.bid.nonce.to_le_bytes();
        let bump = [ctx.accounts.bid.bump];
        let signer_seeds: &[&[u8]] = &[b"bid", auction_key.as_ref(), bidder_key.as_ref(), &nonce, &bump];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.bid.to_account_info(),
                },
                &[signer_seeds],
            ),
            ctx.accounts.bid.amount,
        )?;
        token::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.vault.to_account_info(),
                destination: ctx.accounts.bidder.to_account_info(),
                authority: ctx.accounts.bid.to_account_info(),
            },
            &[signer_seeds],
        ))?;
        ctx.accounts.bid.status = if is_winner { BID_SETTLED } else { BID_REFUNDED };
        emit!(BidSettled { auction: ctx.accounts.auction.key(), bid: ctx.accounts.bid.key(), bidder: bidder_key, amount: ctx.accounts.bid.amount, paid_to_treasury: is_winner });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + Config::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(constraint = treasury_token_account.mint == usdc_mint.key() @ EscrowError::InvalidDestination)]
    pub treasury_token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(sequence: u64)]
pub struct InitializeAuction<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = authority)] pub config: Account<'info, Config>,
    #[account(init, payer = authority, space = 8 + AuctionEscrow::INIT_SPACE, seeds = [b"auction", &sequence.to_le_bytes()], bump)]
    pub auction: Account<'info, AuctionEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, nonce: u64)]
pub struct DepositBid<'info> {
    #[account(mut)] pub bidder: Signer<'info>,
    #[account(mut, seeds = [b"auction", &auction.sequence.to_le_bytes()], bump = auction.bump)] pub auction: Account<'info, AuctionEscrow>,
    #[account(init, payer = bidder, space = 8 + BidEscrow::INIT_SPACE, seeds = [b"bid", auction.key().as_ref(), bidder.key().as_ref(), &nonce.to_le_bytes()], bump)]
    pub bid: Account<'info, BidEscrow>,
    #[account(mut, constraint = bidder_token_account.owner == bidder.key(), constraint = bidder_token_account.mint == usdc_mint.key())]
    pub bidder_token_account: Account<'info, TokenAccount>,
    #[account(init, payer = bidder, associated_token::mint = usdc_mint, associated_token::authority = bid)]
    pub vault: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeAuction<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = authority)] pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"auction", &auction.sequence.to_le_bytes()], bump = auction.bump)] pub auction: Account<'info, AuctionEscrow>,
    /// CHECK: Validated and deserialized when the winner is wallet-funded.
    pub winning_bid: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct SettleBid<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = authority)] pub config: Account<'info, Config>,
    #[account(seeds = [b"auction", &auction.sequence.to_le_bytes()], bump = auction.bump)] pub auction: Account<'info, AuctionEscrow>,
    #[account(mut, has_one = auction, seeds = [b"bid", auction.key().as_ref(), bid.bidder.as_ref(), &bid.nonce.to_le_bytes()], bump = bid.bump)]
    pub bid: Account<'info, BidEscrow>,
    /// CHECK: Receives rent from the closed vault and is pinned to bid.bidder.
    #[account(mut, address = bid.bidder)] pub bidder: UncheckedAccount<'info>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = bid)] pub vault: Account<'info, TokenAccount>,
    #[account(mut)] pub destination: Account<'info, TokenAccount>,
    #[account(address = config.usdc_mint)] pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct Config { pub authority: Pubkey, pub usdc_mint: Pubkey, pub treasury_token_account: Pubkey, pub bump: u8 }

#[account]
#[derive(InitSpace)]
pub struct AuctionEscrow {
    pub sequence: u64,
    pub closes_at: i64,
    pub finalized: bool,
    pub winner_kind: u8,
    pub winning_bid: Pubkey,
    pub highest_wallet_amount: u64,
    pub highest_wallet_bid: Pubkey,
    pub bid_count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct BidEscrow { pub auction: Pubkey, pub bidder: Pubkey, pub amount: u64, pub nonce: u64, pub status: u8, pub bump: u8 }

#[event]
pub struct ConfigInitialized { pub authority: Pubkey, pub treasury_token_account: Pubkey }
#[event]
pub struct AuctionInitialized { pub auction: Pubkey, pub sequence: u64, pub closes_at: i64 }
#[event]
pub struct BidDeposited { pub auction: Pubkey, pub bid: Pubkey, pub bidder: Pubkey, pub amount: u64 }
#[event]
pub struct AuctionFinalized { pub auction: Pubkey, pub winner_kind: u8, pub winning_bid: Pubkey }
#[event]
pub struct BidSettled { pub auction: Pubkey, pub bid: Pubkey, pub bidder: Pubkey, pub amount: u64, pub paid_to_treasury: bool }

#[error_code]
pub enum EscrowError {
    #[msg("The bid amount must be positive.")] InvalidAmount,
    #[msg("The auction has already closed.")] AuctionAlreadyClosed,
    #[msg("The auction is still open.")] AuctionStillOpen,
    #[msg("The auction was already finalized.")] AuctionFinalized,
    #[msg("The auction has not been finalized.")] AuctionNotFinalized,
    #[msg("The winning bid account is invalid.")] InvalidWinningBid,
    #[msg("The winner type is invalid.")] InvalidWinnerKind,
    #[msg("This bid has already been settled.")] BidAlreadySettled,
    #[msg("The settlement destination is invalid.")] InvalidDestination,
    #[msg("Arithmetic overflow.")] MathOverflow,
}
