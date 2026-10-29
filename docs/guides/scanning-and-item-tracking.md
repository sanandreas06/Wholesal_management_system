# Scanning and item tracking (Batch 43)

Every time goods change hands, someone scans them. WHOLESTRA compares the scans with the numbers and asks questions when they do not match.

## Two ways a product is tracked

| | Everyday goods (rice, oil, drinks) | "Track each item" (engines, gearboxes, phones) |
|---|---|---|
| What is scanned | The maker's barcode already on the bag or carton | A WHOLESTRA label stuck on each single item |
| What WHOLESTRA knows | How many are at each branch, how many are on the road, and at which handover any went missing | All of that, plus where each single item is and its whole story |
| Set up | Add the barcode to the product (Products, Edit, Barcodes). No barcode? Press "Make one" and print labels | Products, Edit, tick **Track each item**. Labels print when the goods are scanned in |

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
