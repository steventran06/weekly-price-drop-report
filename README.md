# Weekly Price Drop Report

Automated workflow for analyzing Portland Metro residential listings with price reductions and turning the strongest buyer opportunities into weekly real estate content.

The project is designed for Steven Tran Real Estate and supports the **Portland Metro Price Alert** content series.

It takes structured listing data, evaluates the available homes, identifies the most compelling opportunities, and generates ready-to-use content for social media and YouTube.

---

## Overview

The Weekly Price Drop Report is a real estate data and content automation project.

Its primary goals are to:

* identify meaningful residential price reductions
* compare listings against one another
* surface the strongest buyer opportunities
* extract useful property details from listing remarks
* reduce manual listing review
* generate a concise weekly video script
* generate an Instagram caption
* generate a YouTube Shorts title
* generate a YouTube Shorts description
* generate YouTube keywords
* preserve the listing data behind each report for review

The project is intended to assist with editorial selection and content creation. It does not replace professional review of the underlying listing information.

---

# Core Workflow

At a high level:

```text
Listing Data
     ↓
Normalize + Calculate
     ↓
Filter Price Drops
     ↓
AI Analysis
     ↓
Rank Buyer Opportunities
     ↓
Select 4–5 Listings
     ↓
Generate Weekly Content
     ↓
Review
     ↓
Instagram / YouTube / Other Channels
```

The system should do as much repetitive analysis and formatting as possible while leaving final editorial judgment with Steven.

---

# Content Series

The primary output supports the:

## Portland Metro Price Alert

A short weekly real estate video highlighting Portland-area homes that have experienced meaningful price reductions.

The emphasis should not simply be:

> This house dropped in price.

Instead, the report should explain why the property may now deserve another look.

Useful details include:

* updated kitchens
* renovated bathrooms
* newer roofs or major systems
* usable yards
* views
* garages
* flexible bonus spaces
* multigenerational layouts
* newer construction
* desirable neighborhoods
* larger lots
* ADU potential
* rental potential
* distinctive architecture
* proximity to amenities
* meaningful changes in value relative to the original list price

---

# Technology

The exact implementation may evolve, but the project currently uses or is designed around:

* Node.js
* JavaScript
* OpenAI API
* structured real estate listing data
* JSON
* local scripts
* environment variables
* Git / GitHub

Depending on the listing-data source, additional APIs or data-processing tools may also be used.

---

# Project Structure

The repository structure may evolve, but a typical organization should look similar to:

```text
weekly-price-drop-report/
│
├── data/
│   ├── input/
│   ├── processed/
│   └── output/
│
├── reports/
│
├── scripts/
│   ├── ...
│   └── generateReport.js
│
├── .env
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

Keep source data, processing logic, generated reports, and configuration separate whenever practical.

---

# Local Setup

## Requirements

Install Node.js.

A current Node LTS release is recommended.

Verify:

```bash
node --version
npm --version
```

---

## Clone the Repository

```bash
git clone <REPOSITORY_URL>
cd weekly-price-drop-report
```

Replace `<REPOSITORY_URL>` with the actual GitHub repository URL.

---

## Install Dependencies

```bash
npm install
```

Dependencies are defined in `package.json`.

---

# Environment Variables

Create a local `.env` file in the repository root.

At minimum, the project may require:

```text
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

Additional keys may be required depending on how listing data is retrieved.

Never commit `.env`.

---

# Git Ignore

The repository should generally ignore:

```gitignore
node_modules/

.env
.env.*

.DS_Store

*.log
npm-debug.log*

.tmp/
temp/
```

Be more deliberate about ignoring data directories.

Listing data may contain licensed MLS information or other information that should not be publicly redistributed.

Do not automatically commit raw listing exports simply because they are part of the local workflow.

---

# Listing Data

The analysis works best when each listing contains structured information such as:

```text
address
city
state
zip
originalPrice
currentPrice
squareFeet
bedrooms
bathrooms
status
listDate
daysOnMarket
acres
yearBuilt
propertyType
style
county
neighborhood
remarks
```

Additional fields can improve analysis.

---

# Calculated Listing Fields

The workflow may derive values that are not supplied directly by the listing source.

For example:

## Total Price Reduction

```text
originalPrice - currentPrice
```

This represents the total difference between the property's original list price and its current list price.

It should not automatically be described as the property's "latest price drop."

A property may have gone through multiple price changes.

---

## Price Per Square Foot

When square footage is available:

```text
currentPrice / squareFeet
```

Price per square foot is useful as one comparison point but should never be treated as the sole measure of value.

Condition, location, lot, property type, age, layout and other factors matter.

---

# Price Reduction Language

Public-facing content should generally round the price reduction to the nearest $1,000.

Examples:

```text
$75,100 → about $75,000
$50,995 → about $51,000
$91,000 → about $91,000
```

Avoid overly precise language such as:

```text
This home is down $75,100.
```

Prefer:

```text
This home is down about $75,000 from the original list price.
```

or:

```text
It's now about $75,000 below its original list price.
```

---

# Important Price Terminology

`originalPrice` refers to the original MLS list price.

`totalPriceReduction` refers to:

```text
originalPrice - currentPrice
```

Do not describe `totalPriceReduction` as:

```text
the most recent price reduction
```

unless the underlying data specifically proves that statement.

Preferred language:

```text
down about $X from the original list price
```

---

# AI Listing Analysis

The AI receives normalized listing information and compares the listings against one another.

The primary goal is to identify approximately:

```text
4–5 listings
```

that are likely to be most interesting to a general Portland Metro homebuyer audience.

The analysis should consider more than the size of the price reduction.

---

# Selection Criteria

Strong candidates may combine several factors.

## Price Opportunity

Consider:

* size of reduction
* percentage reduction
* current list price
* value relative to nearby alternatives
* price per square foot where useful

---

## Property Characteristics

Consider:

* bedrooms
* bathrooms
* square footage
* lot size
* garage
* layout
* year built
* style
* outdoor space
* flexibility

---

## Listing Remarks

The public remarks are especially important.

Read the remarks for every candidate.

Extract concrete details such as:

* remodeling
* flooring
* appliances
* windows
* roof
* HVAC
* plumbing
* electrical
* landscaping
* decks
* patios
* views
* finished basements
* home offices
* bonus rooms
* ADUs
* garages
* EV charging
* newer construction
* builder features
* accessibility
* multigenerational layouts

Favor specific facts over generic language.

For example, this is useful:

```text
The kitchen was remodeled with quartz counters and newer cabinetry.
```

This is less useful:

```text
This is a beautiful home with lots to love.
```

---

# Comparing Listings

Listings should be evaluated against the other available listings in the same report.

The goal is not to independently score every property in a vacuum.

Ask:

```text
Why should this property make the final 4–5 instead of the other available homes?
```

The selected properties should collectively make an interesting piece of content.

Avoid selecting five nearly identical listings simply because they have the largest numerical reductions.

---

# Generated Output

The analysis should return structured output that can be reused programmatically.

The exact JSON schema may evolve, but the report generally needs:

```text
selected listings
reason for selection
key property details
price reduction
video script
Instagram caption
YouTube title
YouTube description
YouTube keywords
```

Structured JSON is strongly preferred over free-form model output when another script needs to consume the result.

---

# Weekly Video Script

The weekly Portland Metro Price Alert script should generally be:

```text
110–150 spoken words
```

The script should sound conversational when read aloud.

Avoid writing that sounds like a listing description or MLS remarks pasted into a teleprompter.

---

## Script Structure

A useful structure is:

```text
Hook

Property 1
Property 2
Property 3
Property 4
Optional Property 5

CTA
```

Each listing should receive only enough detail to explain why it stands out.

---

# Required Video CTA

The reel script should end with:

> Comment price drop if any of these homes interest you, or you can call or text me and I’ll send you the details.

Keep this CTA consistent unless the content strategy is intentionally changed.

---

# Instagram Caption

The Instagram caption should:

* begin with a concise hook
* be easy to scan
* list every featured property
* include the full address
* include the current price
* briefly explain the opportunity
* invite viewers to contact Steven
* use only a small number of useful emojis

Each selected home should generally appear on its own line.

Example structure:

```text
Portland Metro price drops worth another look this week 👀

123 Example St, Beaverton — $625,000
456 Example Ave, Portland — $749,000
789 Example Dr, Tigard — $699,000

Several of these homes have seen meaningful reductions from their original list prices.

Call or text me if you'd like the details on any of them.

#PortlandRealEstate #BeavertonRealEstate #PortlandMetro #HomesForSale #PriceDrop
```

---

# Required Instagram Hashtags

The caption should currently end with exactly:

```text
#PortlandRealEstate #BeavertonRealEstate #PortlandMetro #HomesForSale #PriceDrop
```

If the social strategy changes later, update the prompt/configuration rather than manually changing generated posts each week.

---

# YouTube Shorts Title

Generate one strong title.

Guidelines:

* under 70 characters
* reference Portland Metro price drops
* clearly communicate the subject
* avoid unsupported clickbait
* make the value understandable before someone clicks

Example direction:

```text
5 Portland Metro Homes With Big Price Drops This Week
```

Do not claim a property is a bargain, steal or incredible deal unless the available data genuinely supports that conclusion.

---

# YouTube Shorts Description

The YouTube description should:

* explain the weekly series
* list every selected property
* include each full address
* include current prices
* mention relevant price reductions
* include Steven's required contact information
* remain easy to scan

---

# Required Steven Tran Contact Block

Use the current approved contact block when generating YouTube descriptions.

```text
Connect With Me
📞 Call / Text: (971) 285-2002
📧 Email: steven@diverserg.com
Instagram: https://instagram.com/steventranpdx
Facebook: https://www.facebook.com/StevenTranPDXRealtor/

📅 Schedule a call with me here:
👉 https://calendly.com/steven-diverserg/new-meeting

Download my Portland Relocation Guide:
👉 [CURRENT RELOCATION GUIDE URL]
```

Keep the relocation guide URL centralized where possible so it does not need to be updated in multiple scripts.

---

# YouTube Keywords

Generate a single comma-separated keyword string.

Include relevant terms such as:

```text
Portland real estate
Portland homes for sale
Portland Metro homes
Beaverton real estate
Hillsboro real estate
Tigard real estate
price drops
homes for sale
Oregon real estate
Portland home buyer
```

Also include city/neighborhood terms directly relevant to the selected properties.

Do not use hashtags in the YouTube keyword field.

---

# Writing Style

Generated content should sound natural when spoken or posted.

Preferred style:

* direct
* conversational
* informative
* specific
* locally knowledgeable
* analytical without being overly technical

Avoid:

* unnecessary hype
* excessive emojis
* generic AI-sounding filler
* long dashes
* phrases such as "no fluff"
* repeatedly calling every listing "stunning"
* unsupported investment claims

---

# Analytical Approach

The content series should reflect an analytical approach to home buying.

A price reduction is interesting, but price alone does not determine whether a home is a strong opportunity.

Where the available data supports it, consider:

```text
price
condition
size
location
lot
updates
days on market
competition
housing type
current alternatives
potential future utility
```

The purpose is to help buyers notice properties worth evaluating, not to declare that the AI has identified objectively undervalued homes.

---

# Human Review

All generated content should be reviewed before publishing.

Review:

* addresses
* prices
* property facts
* price reductions
* remarks
* spelling
* city names
* legal/disclosure concerns
* script flow
* social copy
* contact information

Never assume generated content is publication-ready simply because the script completed successfully.

---

# MLS and Data Licensing

Be careful with MLS-derived information.

Source data may be subject to licensing, copyright, attribution and redistribution restrictions.

Do not automatically:

* publish entire MLS reports
* expose private listing fields
* commit licensed datasets to a public repository
* redistribute fields not authorized for public display

Generated public content should use information that is appropriate for public marketing.

Always follow the requirements of the listing-data source.

---

# Raw Data vs Public Output

Keep a clear separation between:

```text
RAW / INTERNAL DATA
```

and:

```text
PUBLIC CONTENT
```

The internal dataset may contain substantially more information than should appear in an Instagram caption, Reel or YouTube description.

This project should transform data into useful public insights rather than dump source records directly into content.

---

# Reports

It may be useful to retain a weekly report archive.

Example:

```text
reports/
├── 2026-08-03/
├── 2026-08-10/
└── ...
```

Each run could store:

```text
input metadata
selected listings
analysis JSON
video script
Instagram caption
YouTube content
```

This creates a useful history for improving the selection model over time.

---

# Recommended Weekly Workflow

A normal weekly run should look something like:

```text
1. Obtain current listing data
2. Add/update source file
3. Run processing
4. Calculate total reductions
5. Send qualified listings to AI analysis
6. Review selected 4–5 properties
7. Verify facts against listing source
8. Edit script if necessary
9. Record video
10. Publish Reel / Short
11. Archive report
```

---

# Typical Local Workflow

Pull the latest repository version:

```bash
git pull
```

Install dependencies if needed:

```bash
npm install
```

Make sure `.env` is configured.

Run the relevant report command defined in `package.json`.

For example:

```bash
npm run report
```

Use the actual script currently defined by the project if it differs.

Review output before committing or publishing.

---

# OpenAI Integration

The project uses the OpenAI API to perform listing comparison and content generation.

The API call should use structured input rather than giving the model unnecessary raw data.

A normalized listing object may look conceptually like:

```js
{
  address,
  city,
  currentPrice,
  originalPrice,
  totalPriceReduction,
  squareFeet,
  pricePerSquareFoot,
  bedrooms,
  bathrooms,
  daysOnMarket,
  acres,
  yearBuilt,
  propertyType,
  style,
  neighborhood,
  remarks
}
```

This keeps prompts more predictable and makes model output easier to validate.

---

# Structured Responses

When practical, require the model to return a known JSON structure.

Benefits include:

* easier validation
* easier downstream formatting
* predictable automation
* fewer parsing errors
* easier archival
* simpler future integrations

Do not rely on parsing arbitrary Markdown generated by the model if structured JSON can accomplish the same task.

---

# Model Configuration

Keep the selected OpenAI model configurable rather than hard-coding assumptions throughout the application.

For example:

```text
OPENAI_MODEL=...
```

or centralize the model in one configuration location.

This makes future model changes easier.

---

# Prompt Maintenance

The model instructions are a core piece of the application.

When changing them:

1. Keep the primary selection goals explicit.
2. Preserve price-reduction terminology.
3. Preserve required CTAs.
4. Preserve output formatting requirements.
5. Test against multiple weeks of listing data.
6. Watch for unintended changes in tone.
7. Avoid overly optimizing prompts around one unusual report.

Prompt changes should be treated like code changes.

---

# Error Handling

The report process should fail clearly when required information is unavailable.

Examples include:

```text
Missing OPENAI_API_KEY
No listings found
Invalid source data
Model response is not valid JSON
Required output property missing
```

Prefer explicit failures over silently generating incomplete content.

---

# Validation

Before accepting a report, validate important output fields.

For example:

```text
selectedListings exists
selectedListings length is reasonable
reelScript exists
instagramCaption exists
youtubeTitle exists
youtubeDescription exists
youtubeKeywords exists
```

Where possible, validate model JSON against a schema.

---

# Duplicate Listings

A listing should only appear once in a weekly report.

Use a stable identifier when available, such as:

```text
MLS number
listing ID
```

If no stable identifier is available, normalize the property address before comparing records.

---

# Future Improvements

Potential next steps for the project include:

### Better Historical Tracking

Store previous reports so the system knows:

* whether a property was featured before
* previous prices
* how long it has been reduced
* whether it returned to market

---

### Duplicate Content Prevention

Avoid repeatedly featuring the same property unless something meaningful changed.

---

### City-Level Ranking

Compare opportunities within submarkets such as:

```text
Portland
Beaverton
Hillsboro
Tigard
Happy Valley
Oregon City
Lake Oswego
Gresham
```

before creating the final regional shortlist.

---

### Opportunity Scoring

Create transparent internal metrics around:

```text
price reduction
price reduction percentage
days on market
property updates
lot
size
remarks quality
neighborhood demand
```

Use these as decision-support signals rather than presenting the score publicly as an objective valuation.

---

### Website Integration

Selected price-drop opportunities could eventually feed into:

```text
steventranrealestate.com
```

or the:

```text
steventranrealestate-blog
```

content ecosystem.

For example:

```text
Weekly analysis
      ↓
Price Alert article
      ↓
Short-form video
      ↓
Instagram
      ↓
YouTube Shorts
```

One analysis could generate several coordinated pieces of content.

---

### Automatic Blog Article

The weekly report could generate a draft blog post containing:

* selected properties
* market observations
* buyer considerations
* links to relevant city pages
* consultation CTA

Human review should remain required before publication.

---

### Better Market Context

Future versions could combine listing-level analysis with broader market indicators, such as:

* inventory
* pending ratio
* median price
* average days on market
* list-to-sale ratio
* price-band activity

This would allow the content to explain not only:

```text
what changed
```

but also:

```text
why that change matters in the current market
```

---

# Related Projects

## Steven Tran Real Estate

```text
steventranrealestate
```

Primary real estate website containing:

* city guides
* community guides
* relocation resources
* YouTube content
* reviews
* FAQs
* consultation CTAs

---

## Steven Tran Real Estate Blog

```text
steventranrealestate-blog
```

Astro-based long-form content site containing:

* market reports
* relocation content
* buyer education
* local guides
* searchable articles
* topic archives

---

# Project Philosophy

The goal of this project is not to automatically call homes "deals."

The goal is to use listing data to efficiently identify properties that deserve a closer look, then communicate why they may be interesting to buyers.

The system should prioritize:

```text
useful data
+
specific property details
+
local real estate context
+
human judgment
```

over hype.

Automation should save time without removing the professional review that makes the final content credible.

---

# Maintenance Checklist

When updating the project:

* Keep environment variables out of Git.
* Review MLS/data licensing before committing source files.
* Verify price calculations.
* Keep price-drop terminology consistent.
* Read public remarks for selected listings.
* Validate model JSON.
* Review every address and price.
* Run scripts locally before scheduling them.
* Keep required CTAs centralized.
* Avoid duplicate weekly listings where possible.
* Archive useful historical reports.
* Document new automation in this README.
* Keep public content aligned with Steven Tran Real Estate branding.

---

# Owner

Steven Tran
Real Estate Broker
Portland Metro & Southwest Washington

Main website: steventranrealestate.com

Instagram: @steventranpdx

YouTube: @portlandmetrorealestateguide

---

# Website Upcoming Events

The repository also contains an independent scheduled workflow for publishing
upcoming Portland Metro and SW Washington events to the Steven Tran Real Estate
website repository.

The event job does not use Gmail or OpenAI. It fetches structured event data from
the Ticketmaster Discovery API, normalizes the results, removes duplicate and
cancelled events, and publishes one static JSON file to the website repository.

## Run locally

```bash
npm run events
```

Required environment variables:

```text
TICKETMASTER_API_KEY=...
SITE_GITHUB_TOKEN=...
```

The existing website GitHub settings can be reused:

```text
SITE_GITHUB_OWNER=steventran06
SITE_GITHUB_REPO=steventranrealestate
SITE_GITHUB_BRANCH=main
```

By default the generated file is published to:

```text
data/events/latest.json
```

Override that path with:

```text
SITE_EVENTS_PATH=data/events/latest.json
```

Optional tuning variables:

```text
EVENT_LOOKAHEAD_DAYS=120
EVENT_PAGE_SIZE=100
EVENT_MAX_PAGES_PER_CITY=5
EVENT_REQUEST_DELAY_MS=650
```

The resulting event records include city slugs plus venue latitude/longitude
when Ticketmaster supplies coordinates. This allows the website to display
city-specific events immediately and later support nearby-neighborhood filtering
without changing the fetcher.

---

# Portland Home Guide Instagram Automation

The weekly market-stats workflow can now generate a branded 1080x1350 Instagram carousel from the same structured Oregon market data used for the blog and weekly email.

The Instagram layer does **not** scrape or reread the email. It consumes the existing `ExtractedMarketStats`, `MarketStatsAnalysis`, and generated social caption directly.

## What it generates

Each run creates six JPEG slides:

1. Portland Metro housing market cover
2. Greater Portland single-family vs condo snapshot
3. Most competitive single-family markets
4. Strongest buyer-opportunity markets
5. Metro condo vs single-family comparison
6. Portland Home Guide takeaway / follow slide

Generated files live at:

```text
output/market-stats/instagram/YYYY-MM-DD/
```

The directory also contains the SVG source for every slide, `caption.txt`, and `manifest.json`.

## Image renderer requirement

The carousel is built as SVG and converted to Instagram-ready JPEG files with ImageMagick.

On macOS:

```bash
brew install imagemagick
```

Verify:

```bash
magick -version
```

Instagram rendering is non-blocking inside the weekly market-stats workflow. If ImageMagick is unavailable, the normal website/blog/email workflow continues.

## Preview without rerunning Gmail / PDFs / OpenAI

If the latest market-stats output already exists, run:

```bash
npm run instagram:preview
```

This reads:

```text
output/market-stats/market-stats-oregon.json
output/market-stats/market-analysis.json
output/market-stats/generated-content.json
```

and regenerates the carousel locally.

## Safe default

The default behavior is:

```text
INSTAGRAM_ENABLED=true
INSTAGRAM_AUTO_PUBLISH=false
```

So `npm run market-stats` creates the carousel but does not post it.

Copy the settings you need from `.env.instagram.example` into your existing `.env`.

## Automatic publishing

When `INSTAGRAM_AUTO_PUBLISH=true`, the workflow:

1. renders the six JPEGs
2. commits them to the existing website GitHub repo in one commit
3. waits until the images are publicly reachable
4. creates Instagram carousel child containers
5. creates the carousel parent container
6. publishes the post

Required variables:

```text
INSTAGRAM_AUTO_PUBLISH=true
INSTAGRAM_API_VERSION=v25.0
INSTAGRAM_USER_ID=...
INSTAGRAM_ACCESS_TOKEN=...
INSTAGRAM_ASSET_BASE_URL=https://portlandhomeguide.com/generated/instagram/market-stats
```

The GitHub publishing step reuses:

```text
SITE_GITHUB_TOKEN
SITE_GITHUB_OWNER
SITE_GITHUB_REPO
SITE_GITHUB_BRANCH
```

The default website destination is:

```text
public/generated/instagram/market-stats/YYYY-MM-DD/
```

You can override it with `INSTAGRAM_GITHUB_ASSET_PATH`.

## Publish an already-rendered carousel

After reviewing a preview, you can publish the newest rendered carousel without rerunning the full weekly report:

```bash
npm run instagram:publish
```

This requires the Instagram and asset-hosting environment variables above.

## Recommended rollout

Leave `INSTAGRAM_AUTO_PUBLISH=false` for the first several weeks. Review the images generated by `npm run instagram:preview`, tune brand colors/copy if needed, then enable automatic publishing once the output is consistently correct.
