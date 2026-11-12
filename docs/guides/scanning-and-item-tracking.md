# Scanning and item tracking (Batch 43)

Every time goods change hands, someone scans them. WHOLESTRA compares the scans with the numbers and asks questions when they do not match.

## Two ways a product is tracked

| | Everyday goods (rice, oil, drinks) | "Track each item" (engines, gearboxes, phones) |
|---|---|---|
| What is scanned | The maker's barcode already on the bag or carton | A WHOLESTRA label stuck on each single item |
| What WHOLESTRA knows | How many are at each branch, how many are on the road, and at which handover any went missing | All of that, plus where each single item is and its whole story |
| Set up | Add the barcode to the product (Products, Edit, Barcodes). No barcode? Press "Make one" and print labels | Products, Edit, tick **Track each item**, or turn it on for every product at once (Item Tracking, then Labels). Labels print when the goods are scanned in |

## The jobs (Inventory, then Scan)

- **Goods in.** Scan every item as it comes off the supplier's truck, against a purchase order or without one. Tracked products get their labels at this step: print them and stick one on each item.
- **Send.** The sender checks the number for each product, then scans every item as it is loaded. Tracked products need their own labels scanned.
- **Receive.** The receiving branch scans every item off the truck. Anything not scanned in counts as not received.
- **Find an item.** Scan any label or barcode. An item label shows that item's journey. A product barcode shows how many are at each branch and on the road.

Store staff (Inventory User role) land on Scan when they sign in. Cashiers (Sales User) land on the Counter.

## When something does not match: questions

These become a **question** (Item Tracking, then Questions):

- Goods typed in by hand instead of scanned. The person must give a reason.
- Fewer items arrived than were sent (both branches see it).
- A labelled item that was sent but not scanned in. It is marked **missing**, with its last confirmed place.
- A transfer that has been on the road more than 2 days. This one shows on the bell.

The branch explains what happened. The owner or an administrator closes the question with a decision: *cleared*, *found at fault* or *goods recovered*. Nobody can close a question about their own handover. If a missing item turns up, scan it on Find and press "It is here": it goes back into stock and its story says where it was found.

## Labels and scanners

- Labels carry a Code 128 barcode, which every USB scanner reads, and a QR code for phone cameras.
- Print on a label printer (50 × 30 mm rolls) or on A4 sticker sheets (3 × 8). Choose on the print screen.
- USB and Bluetooth scanners work on every scan screen without any setup. On a phone, press **Camera**.

# Goods leaving for a customer, and the customer's confirmation (Batch 44)

## At the counter

- Tapping a product sets how many. Scanning confirms them: the basket shows **scan 2 to confirm** until every item with a barcode has been scanned.
- If the cashier presses Pay with items still unscanned, they must say why. The manager is asked to check.
- The receipt and the customer screen show a **QR code**. The customer scans it with their phone and confirms they received everything.

## Sales collected later or delivered

- On **Sales & Invoices**, a new sale defaults to **Customer collects from the store**. The goods stay on the shelf but are **reserved**: they cannot be sold again or sent to another branch.
- When the customer or driver comes, go to **Scan, then Release to customer**. Scan the barcode on the invoice, or pick the sale from **Waiting for collection**, then scan every item out. The customer can take part now and the rest later.
- Print the **release note** (A5): what went out, who released it, who collected it (name and vehicle), signature lines, and the customer's QR code.
- The bell shows customers who have not collected paid goods after 3 days.

## The customer's confirmation (no sign-in, any phone)

- **Yes, I received everything:** they see a thank-you message.
- **Something is missing or wrong:** they enter what they actually received, plus an optional comment, name and phone. This becomes a question on **Item Tracking, then Questions** for the branch manager and the owner.
- Each QR code can be answered once. The sale's page shows whether the customer confirmed, or what they reported.

## Products with no barcode

A product with no barcode cannot be checked by scanning. Scan screens show it as **"No barcode: count by eye"**, and nobody is questioned for it. The Scan page lists these products so the owner can press **"No barcode? Make one"** and print labels.

# Selling without internet (Batch 45)

The counter keeps working when the internet drops:

- **Products, prices, barcodes and item labels** are kept on the device, so scanning and tapping work as usual.
- A sale made offline is **saved on the device** and gets a temporary receipt number (OFF-…). The receipt still carries the customer's QR code. It works once the sale has been sent.
- The top of the counter shows **Offline · 2 to send**. When the connection is back, the sales go out by themselves, oldest first, with the time they really happened. A sale is never saved twice, even if it is sent again.
- Only the cashier who made an offline sale can send it, because it is recorded in their name. If someone else signs in on that device, the sales wait until the cashier signs in again.
- While offline, the counter does not sign anyone out for being idle, because signing back in needs the internet.
- **Needs internet:** selling on credit (the customer's balance has to be checked), sales to collect later, and the scan screens for goods in, transfers and releases (these check against other branches' records).
- If an offline sale sold more than the stock on record, it is still saved, because the goods and money already changed hands, and a question asks the branch to count that product.
- **Do not clear the browser's data** on a counter device while sales are waiting.
- The counter page opens without internet once it has been opened online on that device. Install the app (Install app at the top of the site) for the best result.

# New products while scanning (Batch 47)

A barcode is only a number, so the first time a product arrives someone has to say what it is. That now happens on the spot:

- At **Goods in**, scanning a barcode WHOLESTRA has never seen opens **New barcode**:
  - **It's a new product:** type the name (and category), then save. The scan is counted, and every later scan of that barcode counts straight away.
    - Packaged goods (drinks, food, toiletries, household items) are looked up in the free public product lists (Open Food Facts, Open Beauty Facts, Open Products Facts), and the name is filled in for you. Check it and change it to what your shop calls it.
    - Spare parts and local goods are usually not in those lists, so type their name.
  - **We already have it:** pick the product and the barcode is added to it, for example a carton code nobody recorded.
- **Who sets the price:**
  - Owners and managers (people who can create products) type the selling price, and the cost price if they can see costs, in the same form.
  - A storekeeper can add the product but not price it. The product goes into stock marked **needs a price**. The counter shows it as "No price" and will not sell it. Managers see it on the bell and at the top of Products, and setting its selling price makes it sellable.
- On send, receive and release screens, an unknown barcode can be added to one of the products on that list.
- On **Products, New product**, scanning the barcode first fills in the name when it is a known packaged product.
- To turn the public lookup off, set `BARCODE_LOOKUP=off` on Render. Only the barcode number is sent; nothing about your business.

# Every product's own code (Batch 48)

WHOLESTRA gives every product its **own permanent code**, so you no longer depend on the barcode the maker printed:

- The code is a 13-digit retail barcode (EAN-13) starting with 2, the range kept for shops' own codes, for example 2356404880839. It is given once, when the product is created, and **never changes**. Products that existed before this update got theirs automatically.
- Each label carries two codes:
  - **Barcode, "scan to sell":** read by any USB scanner or phone camera at the counter and on every scan screen.
  - **QR, "scan to find":** any phone camera opens WHOLESTRA on that product (after signing in): where it is in stock, what is on the road, and, for items with their own label, the item's whole story.
- **Printing labels:**
  - **Products:** the **Labels** button prints one per item in stock.
  - **Edit a product:** shows its code and has **Print labels**.
  - **After goods in:** **Print product labels** prints one for every item that just arrived.
  - Label printer (50 × 30 mm) or A4 sticker sheets.
- **Ink-jet coders (later):** **Export CSV** on Products now includes the WHOLESTRA code column. A coder prints the 13-digit number as an EAN-13 barcode straight onto bags and cartons. Use the same number, and it scans exactly like the label.
- The **maker's barcode** is now optional. Add it on the product if you want it to scan too.
- Phone camera scanning only accepts a code after reading it the same twice in a row, and ignores the rare barcode types that cameras most often misread. This stops the read from jumping between different numbers.
- **Goods in:** arriving goods do not have their WHOLESTRA label yet, so a product with no maker's barcode is counted by eye there without a question. Label the goods before they go on the shelf: from then on every sale, transfer and release expects the label to be scanned.
- **Stock already on your shelves:** print labels for it once (Products, then Labels on each product), otherwise cashiers have to give a reason for every unscanned sale.

# Live location of goods on the road (Batch 49)

A barcode or QR sticker cannot report where it is: it has no battery, GPS or signal. Courier apps work the same way: the moving vehicle on their map is the **driver's phone**. WHOLESTRA does the same.

## Set up once
- **Branches:** press **📍 Pin location** on each branch, standing inside it with the phone's location turned on. Trips then show where they start (A) and end (B).

## Every scan records where it happened
- When goods are scanned in, sent, received or released, the phone or computer adds its location, if the person allowed location for the site. Nobody is blocked if they refuse.
- On **Item Tracking, then Find**, an item with its own label shows a map of the places it was scanned.

## Following goods on the road
1. Send goods as usual (**Scan, then Send**), or release goods for delivery (**Scan, then Release to customer**).
2. On the done screen, under **Follow it on the map**, type the driver's name, phone and vehicle, then press **Make the driver's link**, then **Send on WhatsApp**.
3. The driver opens the link (no account, no app) and taps **Start trip**. While the page is open, the phone sends its location every 20 seconds. With no signal, the points are kept on the phone and sent later.
4. You see the vehicle move on:
   - the transfer's own page;
   - **Find**, when you scan a product or item that is on the road;
   - **Item Tracking, then On the road**, which shows every vehicle at once.

   The map shows the start (A), the road travelled (solid line), the vehicle now, what is left (dashed line to B), when the driver was last seen, and roughly how many km are left.
5. The trip ends by itself, and the driver's page says "Trip finished", when the goods are scanned in at the other branch, when the customer confirms with the receipt QR, or when the transfer is cancelled. A trip with no location for 2 days counts as ended.

## Good to know
- Phones pause web pages when the screen locks for a long time. The driver's page keeps the screen awake where the phone allows it. If it was locked, opening the link again carries on and loses nothing. A small installable driver app can remove this limit later.
- For trucks, a GPS tracker fixed in the vehicle can feed the same map without the driver's phone (a later step).
- The driver's location is shared only while that trip is open. They are told so before they start, and their page shows when sharing stops.
- Map images come from OpenStreetMap (free, credited on the map). For heavy use, a paid map provider can be set with `NEXT_PUBLIC_MAP_TILES` and `NEXT_PUBLIC_MAP_CREDIT` on Vercel.

# A label on every item, and old stock cannot come in as new (Batch 50)

A product barcode is the same on every bag of that product. If someone scans one bag twice, WHOLESTRA counts two, and a missing bag can hide behind the double scan. A WHOLESTRA item label is different: each one is unique and counts **once**, anywhere. A second scan of the same label is refused on every screen ("Label W… was already scanned").

## Give every item its own label (owner)
- **Item Tracking, then Labels**, then **Turn on for every product**. Only the owner, or someone who may change the company settings, can do this.
- Every product gets **Track each item**, and every new product gets it too, including products added while scanning at Goods in. The product form can still untick it for one product.
- **Turn off for new products** stops new products from being tracked. Products already tracked stay tracked, so labels already stuck on keep working.

## Do this first: labels for stock already on the shelf
1. On **Item Tracking, then Labels**, pick the branch and press **Print all missing labels**. It makes a label for every item on the shelf that has none, up to 1000 per press. Press it again for the rest.
2. Print them (label printer or A4 sticker sheets) and stick one on each item.
3. Do this for each branch. Until it is done, the counter cannot scan those items. Cashiers must give a reason, and the manager is asked to check.

## Goods in: no old stock counted as new
- Goods from a supplier have no WHOLESTRA label yet. If a label WHOLESTRA already knows is scanned at **Goods in**, with or without a purchase order, the scan is refused, for example: "Stop: Malt Drink Case (W…) is already in stock at Kumasi Central. It is not new stock." The server refuses it too, so a hand-edited request cannot get through.

# A label only counts once it is on an item and scanned (Batch 51)

When goods arrive, the bags only carry the maker's barcode, which is the same on every bag, so a bag scanned twice while counting would count as two. To stop that, a counted item is **not stock yet**. Only a label that is stuck on an item and then scanned makes stock:

1. **Goods in:** scan the goods off the truck as before. The screen says "6 items counted", not "added".
2. **Print the labels** (one per item counted).
3. **Stick and scan:** stick one label on each item, then scan that label. Each label counts once. A second scan of it is refused, and so is the maker's barcode.
4. Press **Done**. If a label is left over with no item to go on (for example one bag was scanned twice while counting), it was never scanned, so:
   - it is **cancelled** and can never be used;
   - the stock is lowered to what was really labelled;
   - on a purchase order, the order and the receipt go down too, so the supplier still owes it;
   - the owner gets a question: "GI-…: fewer items than were counted".

Good to know:
- **Save, finish later** keeps what was scanned so far. The Scan page and Item Tracking, then Labels show every list still waiting, with **Stick and scan**. Scans not yet sent are also kept on the phone if the page is closed.
- A label waiting to be scanned cannot be sold, sent or released: "not stock yet".
- **Print these labels again** reprints the same codes (for a jammed printer), so a reprint still counts once.
- **Labels for stock already on the shelf** work the same way, so they double as a shelf count. A label with no item to go on means that item is not on the shelf: Done cancels it, lowers the stock and asks the branch where it went ("Items not on the shelf").
- Stock with labels from before this update keeps working as it is.

# Adding products made easy (Batch 52)

- **Category and brand without setting anything up.** On **Products, New product**, tap **Category** for a ready-made list grouped like an online store (Groceries, Drinks, Household, Health & Beauty, Phones, Electronics, Automobile, Building & Hardware, Fashion, Agriculture and more), or search ("rice", "tyres"). **Brand** then suggests the brands popular in that category in Ghana, plus the brands you already sell. Not in the list? Tap **Other** and type the name. WHOLESTRA saves new names for you, so the separate Categories and Brands pages are no longer in the menu.
- **Pictures fit themselves.** Any photo, of any shape or size, is fitted whole into a neat square on white, centred and made smaller. No cropping.
- **One product in several types.** Tick **This product comes in different types** and list them, for example Gardenia, Lilac, Coffee and Wild Flower. Each type gets its own stock, price (if different), barcode, WHOLESTRA code and labels, saved as "Air Wick Reed Diffuser – Gardenia" and so on, and the types are shown together on Products. To add a type later, open any type (or a single product) and use **Add type** under **Types**: the brand, category, unit, prices and picture are copied.

# Category and brand filled in from the name (Batch 53)

- As the product name is typed, WHOLESTRA suggests the **category** and the **brand**, tagged **✨ Suggested**: "Air Wick Reed Diffuser" gives Air Fresheners & Diffusers and Air Wick; "Total Quartz Engine Oil 4L" gives Lubricants & Engine Oil and Total; "PlayStation 5 Controller" gives Gaming Accessories.
- It works inside the app, free and offline: it spots brand names, recognises the words that point to a category, and learns from how your company filed its earlier products. Choosing a category or brand yourself always wins.
- The category list now covers far more: about 150 kinds in 18 groups, including Computing, Gaming, Furniture, Hair Extensions & Wigs, Makeup, Medical Supplies, Packaging, Industrial & Safety, Pets and Musical Instruments.
- Pictures: photos straight from a phone camera (including very large ones, ones still in Google Photos, and files with no type) now open reliably. A HEIC photo the browser cannot open gets a clear message saying what to do.

# The bottom bar on phones (Batch 55)

On a phone, the five places people use most sit at the bottom of the screen, within reach of the thumb: **Home, Inventory, Scan** (the big round button in the middle), **Sales** and **Settings**. Everything else is still in the ☰ menu at the top.

The bar follows each person's role, and never shows a page they cannot open:

| Role | Tabs |
|---|---|
| Owner, administrator, manager | Home · Inventory · Scan · Sales · Settings |
| Store person | Home · Inventory · Scan · Orders (purchase orders) · Settings |
| Cashier | Home · Inventory · Sell (the counter) · Sales · Settings |

The bar hides while a form or picker is open, and on computers, where the menu on the left is always visible.
