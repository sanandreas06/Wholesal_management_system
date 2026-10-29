# Money owed, cashier shifts and the evening summary (Batch 46)

## Money Owed (menu: Money Owed)

**Customers owe you**
- Lists every customer with unpaid sales, how much they owe, and how old the debt is (0–30, 31–60, 61–90, 90+ days).
- Anything older than the customer's **credit days** (set on the customer; 30 if empty) is shown in red as *past due*.
- **Payment:** record money a customer brings in. It pays off their oldest invoices first, and the screen says which invoices it settled.
- **Statement:** a printable account (or save as PDF): every invoice and payment with the running balance.
- **WhatsApp:** opens WhatsApp with a polite reminder of the balance already written, ready to send to the customer's number.

**You owe suppliers**
- What you owe each supplier = goods received from them minus what you paid. Goods are counted at the supplier's invoice amount when it was typed in on receiving, otherwise at cost.
- The **due date** is the oldest unpaid delivery plus the supplier's credit days. Overdue suppliers come first.
- **Record payment** (owners and administrators) and a printable **Account** for each supplier.

## Cashier shifts

- At the Counter, each cashier presses **Start shift** and types the cash already in the drawer (the float).
- **Today's sales** shows the shift so far: float, cash taken, mobile money, bank, and **what the drawer should hold**.
- **End shift:** the cashier counts the drawer and types what they actually count. WHOLESTRA shows the difference and prints a shift report to sign.
- A difference of GH₵ 1 or more opens a **cash case in Finance** with the cashier's name on it ("Till: Ama"). The manager reviews it like any other case.
- **Sales, then Cashier Shifts** lists every shift with float, takings, expected cash, counted cash and the gap. A manager can end a shift a cashier forgot to end. The bell warns about shifts left open since yesterday.
- A cashier cannot end their shift while sales made offline are still waiting to be sent, so the count includes them.

## The evening summary (menu: Daily Summary)

- Every evening (after 20:00 in the company's time zone), each **owner** gets an email covering:
  - sales per branch, and money in by cash, mobile money and bank;
  - debts collected, new credit given, expenses, and what customers owe;
  - best sellers;
  - a **Needs your attention** list: cash short at a till, customers who reported missing goods, handover questions, sales made offline, stock running out, and paid goods not yet collected.
- When text messages are set up (SMS_PROVIDER on Render) and the owner has a phone number on their profile, a short text goes out too.
- The **Daily Summary** page shows the same summary on screen for any day. It has a switch to stop or restart the emails and an **Email it to me now** button.
- Settings on Render: `SUMMARY_HOUR` (default 20) changes the hour; `DAILY_SUMMARY=off` stops the emails for everyone.
- The server sends the summary itself. On the free Render plan it must be awake at that hour, which the uptime check (every 5 minutes, from Batch 39) already ensures.
