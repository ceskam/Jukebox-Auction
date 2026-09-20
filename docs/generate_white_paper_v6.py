from pathlib import Path

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "apps" / "web" / "public" / "attention-bid-white-paper-v6-1.pdf"

WIDTH, HEIGHT = letter
MARGIN_X = 0.68 * inch
TOP = HEIGHT - 0.72 * inch
BOTTOM = 0.58 * inch

BG = HexColor("#07040D")
PANEL = HexColor("#140B23")
PANEL_2 = HexColor("#1D1032")
WHITE = HexColor("#FFFFFF")
MUTED = HexColor("#C1BCD1")
PINK = HexColor("#FF2ED5")
YELLOW = HexColor("#FFD43B")
BLUE = HexColor("#1BD6FF")
GREEN = HexColor("#23F06B")
LINE = Color(1, 1, 1, alpha=0.14)


def style(name, size, leading=None, color=WHITE, bold=False, align=TA_LEFT):
    return ParagraphStyle(
        name=name,
        fontName="Helvetica-Bold" if bold else "Helvetica",
        fontSize=size,
        leading=leading or size * 1.32,
        textColor=color,
        alignment=align,
        spaceAfter=0,
        spaceBefore=0,
    )


BODY = style("body", 8.55, 12.2, MUTED)
BODY_SMALL = style("body-small", 7.45, 10.5, MUTED)
BODY_WHITE = style("body-white", 8.55, 12.2, WHITE)
H1 = style("h1", 28, 28, WHITE, True)
H2 = style("h2", 15.5, 17.2, WHITE, True)
H3 = style("h3", 10.5, 12, WHITE, True)
EYEBROW = style("eyebrow", 7.1, 8.4, YELLOW, True)
CENTER_BODY = style("center-body", 9.2, 13.2, MUTED, False, TA_CENTER)
CENTER_LABEL = style("center-label", 7.4, 9, BLUE, True, TA_CENTER)
REF = style("ref", 6.65, 9, MUTED)


def set_alpha(c, stroke=None, fill=None):
    if stroke is not None and hasattr(c, "setStrokeAlpha"):
        c.setStrokeAlpha(stroke)
    if fill is not None and hasattr(c, "setFillAlpha"):
        c.setFillAlpha(fill)


def background(c, page_num, section="DISCUSSION DRAFT"):
    c.setFillColor(BG)
    c.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)

    set_alpha(c, fill=0.14)
    c.setFillColor(PINK)
    c.circle(0.9 * inch, HEIGHT - 1.0 * inch, 1.15 * inch, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.circle(WIDTH - 0.55 * inch, HEIGHT - 0.55 * inch, 0.95 * inch, fill=1, stroke=0)
    set_alpha(c, fill=1)

    c.setStrokeColor(Color(1, 1, 1, alpha=0.12))
    c.setLineWidth(0.6)
    c.line(MARGIN_X, HEIGHT - 0.47 * inch, WIDTH - MARGIN_X, HEIGHT - 0.47 * inch)

    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 7.2)
    c.drawString(MARGIN_X, HEIGHT - 0.34 * inch, "ATTENTION BID, INC.")
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 6.7)
    c.drawRightString(WIDTH - MARGIN_X, HEIGHT - 0.34 * inch, section)

    c.setStrokeColor(Color(1, 1, 1, alpha=0.1))
    c.line(MARGIN_X, 0.43 * inch, WIDTH - MARGIN_X, 0.43 * inch)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6.5)
    c.drawString(MARGIN_X, 0.25 * inch, "Attention Bid White Paper v6.1 - September 2026")
    c.drawRightString(WIDTH - MARGIN_X, 0.25 * inch, f"{page_num} / 7")


def paragraph(c, text, x, y_top, width, paragraph_style=BODY):
    p = Paragraph(text, paragraph_style)
    _, h = p.wrap(width, HEIGHT)
    p.drawOn(c, x, y_top - h)
    return y_top - h


def section_title(c, number, title, y):
    y = paragraph(c, f"{number} / {title.upper()}", MARGIN_X, y, WIDTH - 2 * MARGIN_X, EYEBROW)
    return y - 6


def rule(c, y):
    c.setStrokeColor(Color(1, 1, 1, alpha=0.12))
    c.setLineWidth(0.7)
    c.line(MARGIN_X, y, WIDTH - MARGIN_X, y)
    return y - 12


def card(c, x, y_top, width, height, label, title, body, accent=BLUE):
    set_alpha(c, fill=0.96, stroke=0.55)
    c.setFillColor(PANEL)
    c.setStrokeColor(accent)
    c.roundRect(x, y_top - height, width, height, 7, fill=1, stroke=1)
    set_alpha(c, fill=1, stroke=1)
    paragraph(c, label.upper(), x + 12, y_top - 13, width - 24, style("card-label", 6.4, 7.5, accent, True))
    y = paragraph(c, title, x + 12, y_top - 29, width - 24, H3)
    paragraph(c, body, x + 12, y - 6, width - 24, BODY_SMALL)


def metric(c, x, y, width, value, label, color=GREEN):
    c.setFillColor(PANEL_2)
    c.roundRect(x, y, width, 47, 6, fill=1, stroke=0)
    paragraph(c, value, x + 8, y + 38, width - 16, style("metric", 14, 15, color, True, TA_CENTER))
    paragraph(c, label.upper(), x + 8, y + 17, width - 16, CENTER_LABEL)


def chip(c, x, y, text, color):
    w = stringWidth(text, "Helvetica-Bold", 6.8) + 18
    c.setStrokeColor(color)
    c.setFillColor(Color(color.red, color.green, color.blue, alpha=0.08))
    c.roundRect(x, y, w, 20, 10, fill=1, stroke=1)
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", 6.8)
    c.drawCentredString(x + w / 2, y + 6.5, text)
    return x + w + 7


def page_one(c):
    background(c, 1, "WHITE PAPER - VERSION 6.1")
    y = HEIGHT - 1.24 * inch
    y = paragraph(c, "THE MARKET FOR THE NEXT", MARGIN_X, y, WIDTH - 2 * MARGIN_X, style("cover1", 23, 24, WHITE, True, TA_CENTER))
    y = paragraph(c, "30 MINUTES OF ATTENTION", MARGIN_X, y - 3, WIDTH - 2 * MARGIN_X, style("cover2", 31, 31, YELLOW, True, TA_CENTER))

    y = paragraph(
        c,
        "Attention Bid transforms a continuously renewing unit of digital attention into an open, observable market - where price is discovered through competition, the winner controls the next block, and the auction itself becomes part of the content.",
        MARGIN_X + 0.45 * inch,
        y - 22,
        WIDTH - 2 * (MARGIN_X + 0.45 * inch),
        CENTER_BODY,
    )

    x = MARGIN_X + 0.18 * inch
    chip_y = y - 39
    x = chip(c, x, chip_y, "SCARCE TIME", PINK)
    x = chip(c, x, chip_y, "VISIBLE PRICE DISCOVERY", BLUE)
    x = chip(c, x, chip_y, "PERPETUAL AUCTIONS", YELLOW)
    chip(c, x, chip_y, "LIVE BETA", GREEN)

    box_y = chip_y - 44
    c.setFillColor(PANEL_2)
    c.setStrokeColor(Color(1, 1, 1, alpha=0.15))
    c.roundRect(MARGIN_X, box_y - 132, WIDTH - 2 * MARGIN_X, 132, 9, fill=1, stroke=1)
    paragraph(c, "COMPANY UPDATE", MARGIN_X + 18, box_y - 18, WIDTH - 2 * MARGIN_X - 36, EYEBROW)
    y2 = paragraph(c, "Attention Bid is now incorporated.", MARGIN_X + 18, box_y - 38, WIDTH - 2 * MARGIN_X - 36, style("cover-company", 18, 20, WHITE, True))
    paragraph(
        c,
        "Attention Bid, Inc. is a Delaware C corporation responsible for operating the platform, owning company intellectual property, pursuing partnerships and financing, and building the next stage of the attention marketplace.",
        MARGIN_X + 18,
        y2 - 8,
        WIDTH - 2 * MARGIN_X - 36,
        BODY,
    )

    paragraph(c, "VERSION 6.1 - SEPTEMBER 2026", MARGIN_X, 1.42 * inch, WIDTH - 2 * MARGIN_X, style("version", 8.2, 10, BLUE, True, TA_CENTER))
    paragraph(c, "INFORMATIONAL DISCUSSION DRAFT - NOT AN OFFER TO SELL SECURITIES OR TOKENS", MARGIN_X, 1.12 * inch, WIDTH - 2 * MARGIN_X, style("cover-warning", 7, 9, MUTED, True, TA_CENTER))


def page_two(c):
    background(c, 2, "MARKET THESIS")
    y = section_title(c, "01", "Abstract", TOP)
    y = paragraph(c, "A new market primitive for digital attention", MARGIN_X, y, WIDTH - 2 * MARGIN_X, H1)
    y = paragraph(
        c,
        "Attention Bid operates a perpetual auction for a scarce, time-bounded digital resource: control of the platform's primary attention surface. Each 30-minute block is allocated through competitive bidding. When one block ends, the next market begins.",
        MARGIN_X,
        y - 12,
        WIDTH - 2 * MARGIN_X,
        BODY_WHITE,
    )
    y = paragraph(
        c,
        "The product combines digital advertising, auction-based allocation, and crypto-native settlement in a consumer-facing market. The central innovation is not simply that attention is auctioned. The bidding, price discovery, countdown, winner, payment receipt, and transition of control are visible parts of the experience.",
        MARGIN_X,
        y - 9,
        WIDTH - 2 * MARGIN_X,
        BODY,
    )

    gap = 8
    mw = (WIDTH - 2 * MARGIN_X - gap * 3) / 4
    my = y - 66
    metric(c, MARGIN_X, my, mw, "30 MIN", "one block", YELLOW)
    metric(c, MARGIN_X + (mw + gap), my, mw, "48", "blocks per day", GREEN)
    metric(c, MARGIN_X + 2 * (mw + gap), my, mw, "1,440", "per 30 days", BLUE)
    metric(c, MARGIN_X + 3 * (mw + gap), my, mw, "17,520", "per year", PINK)

    y = my - 22
    y = section_title(c, "02", "Market thesis", y)
    y = paragraph(c, "Attention is valuable. Time is scarce. Markets discover prices.", MARGIN_X, y, WIDTH - 2 * MARGIN_X, H2)
    y = paragraph(
        c,
        "Businesses already allocate enormous capital to acquiring digital visibility. Attention Bid narrows that broad market into a defined inventory unit - its own next 30-minute homepage block - and asks participants to reveal what that specific interval is worth.",
        MARGIN_X,
        y - 8,
        WIDTH - 2 * MARGIN_X,
        BODY,
    )

    cw = (WIDTH - 2 * MARGIN_X - 12) / 2
    card(c, MARGIN_X, y - 18, cw, 120, "Conventional advertising", "Allocation is mostly hidden", "A platform, network, or algorithm usually determines placement. The audience sees the result but rarely sees the market that selected it.", PINK)
    card(c, MARGIN_X + cw + 12, y - 18, cw, 120, "Attention Bid", "The market is part of the product", "Current bids, time remaining, winning price, payment receipt, winner, and content transition can all be visible.", BLUE)


def page_three(c):
    background(c, 3, "AUCTION ARCHITECTURE")
    y = section_title(c, "03", "The perpetual auction", TOP)
    y = paragraph(c, "One scarce block. Continuous renewal.", MARGIN_X, y, WIDTH - 2 * MARGIN_X, H1)
    y = paragraph(
        c,
        "Each block is unique because a past time interval cannot be recreated. Scarcity renews because another future interval opens immediately after the current one. This creates a recurring product cadence and a continuing opportunity to participate.",
        MARGIN_X,
        y - 10,
        WIDTH - 2 * MARGIN_X,
        BODY,
    )

    flow_y = y - 52
    labels = ["OPEN BLOCK", "BID USDC", "VERIFY", "WIN 30 MIN", "NEXT BLOCK"]
    total_gap = 8 * 4
    fw = (WIDTH - 2 * MARGIN_X - total_gap) / 5
    for i, label in enumerate(labels):
        x = MARGIN_X + i * (fw + 8)
        c.setFillColor(PANEL_2)
        c.setStrokeColor(BLUE if i % 2 else PINK)
        c.roundRect(x, flow_y, fw, 39, 6, fill=1, stroke=1)
        paragraph(c, label, x + 4, flow_y + 25, fw - 8, style("flow", 6.3, 7.5, WHITE, True, TA_CENTER))

    y = flow_y - 28
    y = section_title(c, "04", "Price discovery", y)
    y = paragraph(c, "USDC value plus verified QUIET bid power.", MARGIN_X, y, WIDTH - 2 * MARGIN_X, H2)
    y = paragraph(
        c,
        "User bids are ranked by effective bid: USDC bid x min(10, 1 + QUIET held / 1,000,000). One million QUIET adds one unit of power, while nine million reaches the 10x maximum. Fractional balances apply proportionally. The USDC transfer remains the amount actually paid.",
        MARGIN_X,
        y - 8,
        WIDTH - 2 * MARGIN_X,
        BODY,
    )

    cw = (WIDTH - 2 * MARGIN_X - 12) / 2
    card(c, MARGIN_X, y - 18, cw, 108, "Bid Power Vault", "Non-custodial balance snapshot", "At bid recording time, the server verifies the connected wallet's current QUIET balance. Tokens stay in the holder's wallet and are not transferred or locked.", YELLOW)
    card(c, MARGIN_X + cw + 12, y - 18, cw, 108, "Important limitation", "Snapshot is not an on-chain lock", "A holder can move tokens after a bid or between wallets. A true deposited vault would require a separately deployed and audited Solana program.", GREEN)

    y2 = y - 146
    y2 = section_title(c, "05", "Growth engine", y2)
    y2 = paragraph(c, "The competition can market the auction.", MARGIN_X, y2, WIDTH - 2 * MARGIN_X, H2)
    paragraph(
        c,
        "The growth hypothesis is reflexive: more viewers can make a block more useful; greater usefulness can attract more bidders; more competition and unexpected outcomes can create new reasons to watch and share. This thesis must be tested with retention, repeat bidding, referral, close-time traffic, and click-through data.",
        MARGIN_X,
        y2 - 8,
        WIDTH - 2 * MARGIN_X,
        BODY,
    )


def page_four(c):
    background(c, 4, "INFRASTRUCTURE AND CONTROLS")
    y = section_title(c, "06", "Solana and USDC", TOP)
    y = paragraph(c, "Verifiable settlement for a dollar-denominated auction.", MARGIN_X, y, WIDTH - 2 * MARGIN_X, H1)
    y = paragraph(
        c,
        "USDC is the bidding asset and Solana provides transaction infrastructure. A winning bid of 500 USDC therefore communicates approximately 500 dollars of nominal bidding value, making historical auction prices easier to interpret than if bids were denominated only in a volatile project token.",
        MARGIN_X,
        y - 10,
        WIDTH - 2 * MARGIN_X,
        BODY,
    )

    cw = (WIDTH - 2 * MARGIN_X - 12) / 2
    card(c, MARGIN_X, y - 18, cw, 112, "Payment verification", "Exact transaction checks", "The application verifies network, USDC mint, sender, treasury destination, amount, confirmation, and transaction reuse before recording a user bid.", BLUE)
    card(c, MARGIN_X + cw + 12, y - 18, cw, 112, "Wallet authentication", "Signed ownership challenge", "Winning wallets sign a message to prove control before publishing content. Signing does not authorize a payment or fee.", GREEN)

    y = y - 156
    y = section_title(c, "07", "Operating controls", y)
    y = paragraph(c, "Automation should be visible and limited.", MARGIN_X, y, WIDTH - 2 * MARGIN_X, H2)
    y = paragraph(
        c,
        "The live beta includes a disclosed operator-funded house bidder that can enter an otherwise empty round after ten minutes. The house wallet is separate from the revenue treasury, subject to a spending cap, and labeled wherever its bid or content appears.",
        MARGIN_X,
        y - 8,
        WIDTH - 2 * MARGIN_X,
        BODY,
    )

    controls = [
        ("Treasury separation", "Revenue, operating funds, and automated bidding funds should remain in distinct wallets."),
        ("Content controls", "Winner content can be hidden or rejected by the operator when necessary."),
        ("Public receipts", "On-chain transaction links allow payment claims to be independently checked."),
        ("Key security", "Private keys should never be committed to source control or exposed to the browser."),
    ]
    start_y = y - 18
    h = 82
    for idx, (title, body) in enumerate(controls):
        row = idx // 2
        col = idx % 2
        card(c, MARGIN_X + col * (cw + 12), start_y - row * (h + 10), cw, h, f"Control {idx + 1}", title, body, YELLOW if idx % 2 == 0 else BLUE)


def page_five(c):
    background(c, 5, "COMPANY AND FUNDING")
    y = section_title(c, "08", "Attention Bid, Inc.", TOP)
    y = paragraph(c, "A Delaware corporation now operates the project.", MARGIN_X, y, WIDTH - 2 * MARGIN_X, H1)
    y = paragraph(
        c,
        "Attention Bid, Inc. was incorporated in Delaware in 2026 to operate the platform, own company intellectual property, contract with service providers and partners, employ contributors, manage company assets, and pursue financing under formal corporate approvals.",
        MARGIN_X,
        y - 10,
        WIDTH - 2 * MARGIN_X,
        BODY_WHITE,
    )

    c.setFillColor(PANEL_2)
    c.setStrokeColor(YELLOW)
    c.roundRect(MARGIN_X, y - 112, WIDTH - 2 * MARGIN_X, 98, 7, fill=1, stroke=1)
    paragraph(c, "FOUNDER STOCK IS NOT THE SAME AS COMPANY VALUATION", MARGIN_X + 14, y - 29, WIDTH - 2 * MARGIN_X - 28, EYEBROW)
    paragraph(
        c,
        "A founder's nominal purchase price for restricted common stock records the initial issuance under the company's formation documents. It does not by itself establish the price investors would pay, the company's enterprise value, or a guaranteed economic return. A future financing establishes its own negotiated terms and ordinarily dilutes existing ownership when new securities are issued.",
        MARGIN_X + 14,
        y - 48,
        WIDTH - 2 * MARGIN_X - 28,
        BODY_SMALL,
    )

    y = y - 135
    y = section_title(c, "09", "Funding pathways", y)
    y = paragraph(c, "Financing must follow a documented exemption or registration path.", MARGIN_X, y, WIDTH - 2 * MARGIN_X, H2)

    cw = (WIDTH - 2 * MARGIN_X - 12) / 2
    card(c, MARGIN_X, y - 17, cw, 112, "Private financing", "SAFE or priced equity round", "The company may negotiate financing with investors using board-approved documents and an available securities-law exemption. Proceeds paid to the company fund the company; a founder secondary sale does not.", BLUE)
    card(c, MARGIN_X + cw + 12, y - 17, cw, 112, "Community financing", "Regulation Crowdfunding", "A public crowdfunding round must run through a registered intermediary with Form C disclosures, offering limits, financial information, advertising constraints, and ongoing reporting.", PINK)

    y2 = y - 156
    card(c, MARGIN_X, y2, cw, 110, "Non-dilutive capital", "Grants and commercial revenue", "Ecosystem grants, sponsorships, paid pilots, and auction revenue can finance development without issuing additional company securities, although each source still requires appropriate accounting and contracts.", GREEN)
    card(c, MARGIN_X + cw + 12, y2, cw, 110, "Public website", "Factual company information", "The website can describe the company and product. It should not publish investment terms or accept investment funds until counsel selects and documents the offering pathway.", YELLOW)


def page_six(c):
    background(c, 6, "TOKENIZATION BOUNDARIES")
    y = section_title(c, "10", "Shares and tokens", TOP)
    y = paragraph(c, "Putting shares on-chain does not remove securities laws.", MARGIN_X, y, WIDTH - 2 * MARGIN_X, H1)
    y = paragraph(
        c,
        "The SEC describes an issuer-sponsored tokenized security as a security whose ownership record is maintained in whole or in part through a crypto network. The technology changes the recordkeeping format, not the legal nature of the share.",
        MARGIN_X,
        y - 10,
        WIDTH - 2 * MARGIN_X,
        BODY_WHITE,
    )

    cw = (WIDTH - 2 * MARGIN_X - 12) / 2
    card(c, MARGIN_X, y - 18, cw, 126, "Possible later structure", "Tokenized company security", "Attention Bid could explore issuer-sponsored tokenized shares with securities counsel, board and stockholder approvals, a compliant transfer system, identity controls, investor records, custody design, disclosures, and an available offering exemption or registration.", BLUE)
    card(c, MARGIN_X + cw + 12, y - 18, cw, 126, "Not a technical conversion", "Shares do not simply vest into tokens", "Founder vesting determines when repurchase restrictions lapse. Tokenization is a separate corporate and securities process. Any exchange, redemption, or representation of shares must preserve the holder's legal rights and the company's official stock ledger.", PINK)

    y = y - 170
    y = section_title(c, "11", "Current token position", y)
    y = paragraph(c, "QUIET utility does not represent Attention Bid equity.", MARGIN_X, y, WIDTH - 2 * MARGIN_X, H2)
    y = paragraph(
        c,
        "The current product can use the separately issued QUIET token only to calculate bid power. Holding QUIET does not grant Attention Bid shares, company revenue, dividends, governance rights, or a future company token. No website visitor should rely on a future equity-token launch. Any later design would require new governing documents, technical security review, tax analysis, and a documented legal pathway before announcement or sale.",
        MARGIN_X,
        y - 8,
        WIDTH - 2 * MARGIN_X,
        BODY,
    )

    c.setFillColor(PANEL_2)
    c.setStrokeColor(GREEN)
    c.roundRect(MARGIN_X, y - 105, WIDTH - 2 * MARGIN_X, 90, 7, fill=1, stroke=1)
    paragraph(c, "SEPARATE COMMUNITY ASSETS", MARGIN_X + 14, y - 31, WIDTH - 2 * MARGIN_X - 28, style("separate", 7, 8, GREEN, True))
    paragraph(
        c,
        "QUIET bid power is a product utility calculated from a wallet-balance snapshot. It does not make QUIET an Attention Bid share. Any proposed holder rewards, revenue sharing, redemption, or exchange for company securities must be separately authorized, documented, and reviewed before launch.",
        MARGIN_X + 14,
        y - 50,
        WIDTH - 2 * MARGIN_X - 28,
        BODY_SMALL,
    )


def page_seven(c):
    background(c, 7, "ROADMAP, RISKS, AND SOURCES")
    y = section_title(c, "12", "Execution roadmap", TOP)
    y = paragraph(c, "Prove the market before expanding the financial layer.", MARGIN_X, y, WIDTH - 2 * MARGIN_X, H1)

    milestones = [
        ("LIVE BETA", "Improve mobile wallet access, reliability, moderation, analytics, and bidder onboarding."),
        ("AUDIENCE", "Launch a branded domain, publish searchable company content, grow X and Telegram, and measure referrals."),
        ("FUNDING", "Organize the cap table, company bank and wallets, accounting, data room, and counsel-led financing materials."),
        ("TOKEN REVIEW", "Only after product traction: determine whether any token has a necessary function and a viable legal structure."),
    ]
    for idx, (title, body) in enumerate(milestones):
        yy = y - 16 - idx * 57
        c.setFillColor(PANEL_2)
        c.setStrokeColor([GREEN, BLUE, YELLOW, PINK][idx])
        c.roundRect(MARGIN_X, yy - 42, WIDTH - 2 * MARGIN_X, 42, 6, fill=1, stroke=1)
        paragraph(c, f"{idx + 1}. {title}", MARGIN_X + 11, yy - 10, 86, style(f"milestone-{idx}", 6.7, 8, [GREEN, BLUE, YELLOW, PINK][idx], True))
        paragraph(c, body, MARGIN_X + 100, yy - 10, WIDTH - 2 * MARGIN_X - 111, BODY_SMALL)

    y = y - 252
    y = section_title(c, "13", "Principal risks", y)
    y = paragraph(
        c,
        "Adoption and revenue may remain limited. Network effects may not develop. Bids and token values can be volatile or illiquid. The product depends on Solana, USDC, wallets, RPC providers, hosting, and database infrastructure. Content may create moderation and legal exposure. Automated wallets create key and treasury risk. Financing dilutes existing stockholders. Securities, commodities, money-transmission, sanctions, privacy, advertising, tax, and consumer-protection rules may apply depending on the final facts.",
        MARGIN_X,
        y,
        WIDTH - 2 * MARGIN_X,
        BODY_SMALL,
    )

    y = y - 16
    y = section_title(c, "14", "Selected sources", y)
    refs = [
        "[1] IAB and PwC, Internet Advertising Revenue Report: Full Year 2025.",
        "[2] Nobel Prize, Economic Sciences 2020 - Paul Milgrom and Robert Wilson.",
        "[3] Circle, USDC transparency and USDC on Solana materials.",
        "[4] Solana Documentation, Transaction Fees.",
        "[5] U.S. SEC staff, Statement on Tokenized Securities, Jan. 28, 2026 - sec.gov/newsroom/speeches-statements/corp-fin-statement-tokenized-securities-012826-statement-tokenized-securities",
        "[6] U.S. SEC, What is Form D? - sec.gov/resources-small-businesses/capital-raising-building-blocks/what-form-d",
        "[7] U.S. SEC, Regulation Crowdfunding: Guidance for Issuers - sec.gov/resources-small-businesses/small-business-compliance-guides/regulation-crowdfunding-guidance-issuers",
        "[8] U.S. SEC, Proposed Regulation Crypto Assets, Release No. 33-11434, Aug. 18, 2026.",
    ]
    for ref in refs:
        y = paragraph(c, ref, MARGIN_X, y, WIDTH - 2 * MARGIN_X, REF) - 2

    c.setFillColor(PANEL_2)
    c.setStrokeColor(Color(1, 1, 1, alpha=0.16))
    c.roundRect(MARGIN_X, BOTTOM + 4, WIDTH - 2 * MARGIN_X, 42, 6, fill=1, stroke=1)
    paragraph(
        c,
        "IMPORTANT: This document is informational and forward-looking. It is not legal, tax, or investment advice and is not an offer or solicitation to buy or sell any security, token, or other financial instrument.",
        MARGIN_X + 10,
        BOTTOM + 35,
        WIDTH - 2 * MARGIN_X - 20,
        style("important", 6.3, 8, MUTED, True),
    )


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=letter, pageCompression=1)
    c.setTitle("Attention Bid White Paper v6.1")
    c.setAuthor("Attention Bid, Inc.")
    c.setSubject("Perpetual marketplace for digital attention")
    c.setKeywords("Attention Bid, Solana, USDC, attention auction, Attention Bid Inc")

    for page in (page_one, page_two, page_three, page_four, page_five, page_six, page_seven):
        page(c)
        c.showPage()

    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()
