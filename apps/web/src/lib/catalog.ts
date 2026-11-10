/**
 * Ready-made product categories, grouped the way shoppers know them from online stores, with the brands commonly sold in Ghana
 * for each and the words that usually appear in a product's name (used to suggest the category as the name is typed).
 * Nobody has to set anything up: pick from the list, or choose "Other" and type a name.
 *
 * Each category is one line: "Name | words that point to it | suggested brands".
 */
export interface CatalogCategory { name: string; words: string[]; brands: string[] }
export interface CatalogGroup { group: string; icon: string; categories: CatalogCategory[] }

const RAW: { group: string; icon: string; lines: string[] }[] = [
  { group: "Food & Groceries", icon: "🛒", lines: [
    "Rice & Grains | rice, basmati, jasmine, perfumed rice, parboiled, beans, maize, corn, millet, sorghum, gari, wheat, grain, groundnut, soya | Royal Aroma, Gino, Uncle Sam, Fortune, Mama's Choice, Tilda",
    "Cooking Oil & Fats | cooking oil, vegetable oil, palm oil, groundnut oil, sunflower oil, olive oil, coconut oil, margarine, shortening, ghee, frytol | Frytol, Gino, Mamador, Sunola, Golden Penny, Blue Band",
    "Tomato Paste & Sauces | tomato paste, tomato mix, paste, ketchup, sauce, mayonnaise, mayo, shito, pepper sauce, salad cream | Gino, Tasty Tom, Pomo, Ojah, Heinz",
    "Spices & Seasoning | seasoning, cube, spice, curry, thyme, black pepper, ginger powder, garlic powder, salt, msg, stock cube, maggi, royco, onga, knorr | Maggi, Royco, Onga, Knorr, Mr Chef",
    "Sugar & Sweeteners | sugar, cube sugar, sugar cubes, honey, sweetener, syrup, glucose | St. Louis, Dangote, Golden Penny",
    "Flour & Baking | flour, baking, yeast, baking powder, cake mix, semovita, semolina, custard, cornflour | Golden Penny, Dangote, Gold Coin, Pioneer",
    "Pasta & Noodles | pasta, spaghetti, macaroni, noodles, noodle, indomie, vermicelli | Indomie, Golden Penny, Gino, Tummy Tummy, Dangote",
    "Canned & Tinned Food | sardine, sardines, mackerel tin, corned beef, tuna, baked beans, tinned, canned, tin, geisha, titus, luncheon meat | Geisha, Titus, Heinz, La Pesquera",
    "Milk & Dairy | milk, evaporated, powdered milk, milk powder, yoghurt, yogurt, cheese, cream, condensed milk, dairy | Peak, Ideal, Cowbell, Nido, Dano, Carnation, Fan Milk",
    "Tea, Coffee & Cocoa | tea, coffee, cocoa, milo, bournvita, ovaltine, hot chocolate, green tea, lipton | Milo, Nescafé, Lipton, Richoco, Golden Tree, Bournvita, Ovaltine",
    "Biscuits, Sweets & Snacks | biscuit, biscuits, cookies, crackers, chips, crisps, plantain chips, sweets, candy, chocolate, chewing gum, lollipop, chin chin, popcorn, wafer | McVitie's, Cabin, Pringles, Oreo, Golden Tree, Mentos",
    "Breakfast Cereals | cereal, cornflakes, corn flakes, oats, oat, muesli, golden morn, weetabix, granola | Kellogg's, Nestlé, Golden Morn, Weetabix, Quaker",
    "Frozen Food, Meat & Fish | chicken, turkey, beef, goat meat, meat, fish, frozen, sausage, gizzard, shrimp, prawns, wings, drumsticks, salmon, tilapia, smoked fish | Chicken Republic, Fan Milk",
    "Fruits & Vegetables | vegetable, vegetables, fruit, fruits, onion, onions, yam, plantain, cassava, banana, orange, pineapple, mango, apple, cabbage, carrot, potato, potatoes, pepper fresh, garden eggs, okra | ",
    "Bread & Bakery | bread, cake, pastry, doughnut, buns, sugar bread, butter bread, tea bread, croissant | ",
    "Baby Food & Formula | baby food, infant formula, formula, cerelac, nan, similac, lactogen, baby cereal | Nestlé, Cerelac, Similac, Lactogen",
  ] },
  { group: "Drinks", icon: "🥤", lines: [
    "Soft Drinks | soft drink, soda, coke, cola, fanta, sprite, pepsi, mirinda, 7up, bigoo, minerals, tonic water, bitter lemon | Coca-Cola, Fanta, Sprite, Pepsi, Mirinda, 7Up, Bigoo",
    "Malt Drinks | malt, malta, beta malt, alvaro, vitamalt | Malta Guinness, Beta Malt, Alvaro, Vitamalt, Amstel Malta",
    "Water | water, sachet water, pure water, mineral water, bottled water, dispenser water | Voltic, Bel-Aqua, Verna, Cool Pac, Aqua Splash",
    "Juice & Yoghurt Drinks | juice, fruit drink, nectar, smoothie, yoghurt drink, fruit juice | Ceres, Pure Heaven, Tampico, Kalypo, Don Simon",
    "Energy Drinks | energy drink, red bull, rush, storm, monster, power horse | Red Bull, Rush, Storm, Monster, Power Horse",
    "Beer | beer, lager, stout, club, star beer, guinness, gulder, heineken | Club, Star, Guinness, Gulder, Heineken, Origin",
    "Wines & Spirits | wine, whisky, whiskey, gin, vodka, brandy, rum, bitters, liquor, schnapps, champagne, alomo | Kasapreko, Alomo, Origin Bitters, Bel's, Hennessy, Johnnie Walker",
  ] },
  { group: "Household", icon: "🏠", lines: [
    "Detergents & Laundry | detergent, washing powder, laundry, soap powder, bleach, fabric softener, omo, ariel, klin, madar, bar soap | Omo, Sunlight, Ariel, Klin, Madar, Key Soap",
    "Cleaning Products | cleaner, disinfectant, toilet cleaner, dish wash, dishwashing, liquid soap, harpic, dettol, jik, mop, broom, sponge, scrubber, bin bag | Harpic, Dettol, Jik, Mr. Muscle, Vim",
    "Air Fresheners & Diffusers | air freshener, freshener, diffuser, reed diffuser, room spray, scent, fragrance oil, aroma, incense, scented candle, plug in | Air Wick, Glade, Ambi Pur, Febreze, Arome",
    "Insecticides & Pest Control | insecticide, mosquito, coil, rat poison, cockroach, spray insect, raid, mortein, baygon, repellent | Raid, Mortein, Rambo, Baygon",
    "Tissue & Paper | tissue, toilet roll, toilet paper, serviette, napkin, kitchen towel, paper towel, facial tissue | Softcare, Rose, Twinsaver, Velvex",
    "Kitchen & Dining | pot, pan, frying pan, cooking pot, plate, plates, cup, mug, spoon, fork, knife, cutlery, flask, jug, tray, kitchen | Tefal, Pyrex, Luminarc, Royalford",
    "Plastics & Storage | bucket, basin, bowl, plastic, container, cooler, ice chest, rubber, storage box, laundry basket, kettle plastic | Interplast, Qualiplast, Royalford",
    "Bedding & Towels | bedsheet, bed sheet, duvet, pillow, pillowcase, blanket, towel, towels, curtain, curtains | ",
    "Home Décor | decor, vase, frame, wall clock, mirror wall, artificial flower, rug, carpet, doormat | ",
    "Gas & Cooking Fuel | gas cylinder, lpg, cooking gas, gas stove, burner, charcoal, coal pot, regulator | ",
  ] },
  { group: "Health & Beauty", icon: "💄", lines: [
    "Body Care & Lotions | lotion, body lotion, body cream, cream, moisturiser, moisturizer, cocoa butter, shea butter, petroleum jelly, vaseline, body oil | Nivea, Vaseline, Dove, Jergens, Aveeno",
    "Soap & Shower | soap, bathing soap, shower gel, body wash, sponge bath, antiseptic soap | Key Soap, Dettol, Lux, Dove, Protex, Imperial Leather",
    "Hair Care | shampoo, conditioner, hair cream, relaxer, hair food, hair oil, gel, hair spray, edge control, hair dye | Dark and Lovely, TCB, Cantu, Shea Moisture, Pantene, ORS",
    "Hair Extensions & Wigs | wig, wigs, braids, braid, attachment, weave, hair extension, extensions, frontal, closure, bundles, crochet | X-pression, Darling, Noble, Ultra Braid",
    "Makeup & Cosmetics | makeup, make up, lipstick, lip gloss, foundation, powder, eyeliner, mascara, eyeshadow, nail polish, lashes, concealer | Fenty, Maybelline, Zaron, Black Opal, Sleek",
    "Skin Care | face wash, cleanser, serum, toner, sunscreen, face cream, facial, acne, skin care, skincare | Nivea, Garnier, CeraVe, Neutrogena",
    "Oral Care | toothpaste, toothbrush, mouthwash, dental floss, tooth paste | Pepsodent, Close Up, Colgate, Oral-B, Sensodyne",
    "Perfumes & Deodorants | perfume, cologne, deodorant, body spray, roll on, fragrance, eau de parfum, eau de toilette, antiperspirant | Rexona, Nivea, Sure, Lattafa, Axe",
    "Baby Care | diaper, diapers, nappies, baby wipes, wipes, baby lotion, baby powder, baby oil, baby soap | Pampers, Huggies, Johnson's, Molfix, Softcare",
    "Feminine Care | sanitary pad, sanitary pads, pads, always, tampons, panty liner | Always, Softcare, Kotex, Lady Care",
    "Men's Grooming | razor, shaving, shaving cream, after shave, aftershave, clipper, trimmer, beard oil | Gillette, Bic, Nivea Men, Wahl",
    "Medicines (over the counter) | tablet, tablets, capsule, syrup cough, paracetamol, painkiller, malaria, antibiotic, ointment, balm, drops, medicine, drug | Panadol, Ernest Chemists, Kinapharma, Tobinco, M&G",
    "Medical Supplies | gloves, syringe, needle, bandage, plaster, gauze, thermometer, bp monitor, blood pressure, glucometer, face mask, cotton wool, first aid | ",
    "Vitamins & Supplements | vitamin, vitamins, supplement, multivitamin, omega, zinc, vitamin c, herbal | Centrum, Seven Seas, Wellman, Wellwoman",
  ] },
  { group: "Phones & Tablets", icon: "📱", lines: [
    "Mobile Phones | phone, smartphone, mobile phone, iphone, galaxy, tecno, infinix, itel, redmi, android phone, button phone | Samsung, Tecno, Infinix, itel, Apple, Xiaomi, Nokia, Oppo",
    "Tablets | tablet pc, ipad, tab, android tablet | Samsung, Apple, Lenovo, Huawei, Tecno",
    "Phone Accessories | charger, phone case, case, pouch, screen protector, screen guard, earpiece, earphones, earbuds, airpods, power bank, usb cable, data cable, phone holder, selfie stick | Oraimo, Samsung, Apple, Anker, XO",
    "Phone Parts | phone screen, lcd, touch screen, phone battery, charging port, back cover, flex | ",
  ] },
  { group: "Computing", icon: "💻", lines: [
    "Laptops | laptop, notebook, macbook, chromebook, elitebook, thinkpad | HP, Dell, Lenovo, Apple, Asus, Acer",
    "Desktop Computers | desktop, computer, all in one, monitor, system unit, cpu | HP, Dell, Lenovo, Apple, Samsung",
    "Computer Accessories | mouse, keyboard, flash drive, pendrive, hard drive, ssd, memory card, sd card, laptop bag, webcam, ram, hdmi, usb hub | SanDisk, Kingston, Logitech, HP, Seagate",
    "Printers & Ink | printer, ink, cartridge, toner, scanner, photocopier, laminating | HP, Canon, Epson, Brother",
    "Networking & Internet | router, modem, wifi, mifi, network switch, access point, ethernet, lan cable | TP-Link, Huawei, ZTE, Tenda",
  ] },
  { group: "Electronics", icon: "📺", lines: [
    "TVs | tv, television, smart tv, led tv, android tv, decoder, satellite dish | Nasco, Samsung, LG, Hisense, TCL, Sony, Bruhm",
    "Audio & Speakers | speaker, speakers, bluetooth speaker, sound system, home theatre, home theater, headphones, headset, radio, microphone, amplifier, subwoofer | JBL, Sony, Oraimo, LG, Nasco",
    "Home Appliances | fridge, refrigerator, freezer, deep freezer, microwave, blender, iron, electric kettle, kettle, rice cooker, washing machine, gas cooker, cooker, oven, toaster, water dispenser, vacuum | Nasco, Binatone, Midea, Hisense, LG, Samsung, Bruhm",
    "Fans & Air Conditioners | fan, standing fan, ceiling fan, table fan, air conditioner, ac, aircon, air cooler | Nasco, Binatone, Midea, LG, Bruhm",
    "Electrical & Lighting | bulb, led bulb, light, socket, switch, cable, wire, extension, extension board, breaker, fuse, plug, lamp, torch, rechargeable lamp, stabilizer | Philips, Schneider, Legrand, Nexans, Osram",
    "Generators, Solar & Power | generator, solar, solar panel, inverter, battery inverter, ups, charge controller | Elepaq, Tiger, Firman, Sumec, Jinko",
    "Cameras & Security | camera, cctv, security camera, dvr, nvr, doorbell, alarm, drone | Hikvision, Dahua, Canon, Nikon, Sony",
    "Batteries (small) | battery aa, aaa, aa battery, aaa battery, button cell, 9v | Duracell, Energizer, Tiger Head, Panasonic",
  ] },
  { group: "Gaming", icon: "🎮", lines: [
    "Game Consoles | console, playstation, ps5, ps4, xbox, nintendo, switch console, game console | Sony, Microsoft, Nintendo",
    "Video Games | video game, game disc, game cd, gaming disc, games | Sony, Microsoft, Nintendo, EA",
    "Gaming Accessories | ps5 controller, ps4 controller, playstation controller, xbox controller, dualsense, controller, gamepad, joystick, gaming headset, gaming mouse, gaming keyboard, gaming chair | Sony, Microsoft, Logitech, Razer",
  ] },
  { group: "Automobile", icon: "🚗", lines: [
    "Engines & Gearboxes | engine, gearbox, gear box, transmission, engine block, cylinder head, crankshaft | Toyota, Nissan, Hyundai, Kia, Honda, Mercedes-Benz, Ford",
    "Auto Spare Parts | brake pad, brake, filter, oil filter, air filter, spark plug, plug, shock absorber, bearing, clutch, radiator, alternator, starter, fan belt, timing belt, headlight, bumper, side mirror, wiper, suspension, axle, pump | Toyota, Nissan, Hyundai, Kia, Honda, Bosch, Denso",
    "Tyres & Rims | tyre, tyres, tire, tires, rim, rims, tube, alloy wheel | Michelin, Bridgestone, Dunlop, Goodyear, Pirelli, Continental",
    "Lubricants & Engine Oil | engine oil, motor oil, lubricant, gear oil, brake fluid, coolant, grease, transmission fluid, atf | Total, Shell, Mobil, Castrol, GOIL, Star Oil",
    "Car Batteries | car battery, battery car, accumulator | Exide, Varta, Bosch, Amaron, Hankook",
    "Car Accessories | seat cover, floor mat, car charger, dash cam, car perfume, steering cover, car wash, car polish | ",
    "Motorbike & Tricycle Parts | motorbike, motorcycle, okada, tricycle, motor king, aboboyaa, bike chain | Honda, Yamaha, Suzuki, Bajaj, Haojue",
  ] },
  { group: "Building & Hardware", icon: "🧱", lines: [
    "Cement & Blocks | cement, blocks, block, sand, stone, chippings, concrete | Ghacem, Dangote, Diamond Cement, Supacem, CIMAF",
    "Iron Rods & Steel | iron rod, iron rods, rod, rods, steel, binding wire, angle iron, metal sheet, wire mesh | ",
    "Roofing | roofing sheet, roofing, aluminium sheet, zinc, gutter, ridge cap | ",
    "Tiles & Flooring | tile, tiles, floor tile, wall tile, terrazzo, vinyl floor, carpet tile | Twyford, Goodwill",
    "Paint & Finishes | paint, emulsion, gloss, primer, varnish, putty, sealant, thinner | Azar, Dulux, Sika, Coral",
    "Plumbing & Sanitary | pipe, pvc, tap, faucet, valve, water tank, polytank, sink, toilet, water closet, wc, shower, basin sanitary | Interplast, Polytank, Duraplast",
    "Doors & Windows | door, doors, window, windows, lock, padlock, handle, hinge, louvre, glass | ",
    "Wood & Timber | wood, timber, plywood, board, mdf, plank | ",
    "Tools | hammer, drill, spanner, screwdriver, saw, pliers, tape measure, wheelbarrow, shovel, cutlass, tool, tools, toolbox | Ingco, Stanley, Bosch, Makita, Total",
    "Nails, Screws & Fasteners | nails, nail, screws, screw, bolts, nuts, rivets, washer | ",
  ] },
  { group: "Furniture", icon: "🛋️", lines: [
    "Living Room Furniture | sofa, couch, settee, centre table, coffee table, tv stand, armchair | ",
    "Bedroom Furniture | bed, mattress, wardrobe, dressing table, bedside, bed frame | Latex Foam, Vono, Mouka",
    "Office Furniture | office chair, office desk, desk, filing cabinet, conference table | ",
    "Plastic Chairs & Tables | plastic chair, plastic chairs, plastic table, white chair | Interplast, Qualiplast",
  ] },
  { group: "Fashion", icon: "👗", lines: [
    "Men's Clothing | shirt, trousers, jeans, t-shirt, polo, suit, shorts, kaftan, agbada, jacket men | ",
    "Women's Clothing | dress, blouse, skirt, gown, kaba, top, leggings, jumpsuit, kimono | ",
    "Children's Clothing | kids, children, baby clothes, school uniform, romper | ",
    "Shoes & Slippers | shoes, shoe, slippers, sandals, sneakers, boots, heels, canvas, crocs | Nike, Adidas, Puma, Bata",
    "Bags & Luggage | bag, handbag, backpack, school bag, suitcase, luggage, travel bag, purse, wallet | ",
    "Watches & Jewellery | watch, wristwatch, jewellery, jewelry, necklace, bracelet, earrings, ring, chain, beads | Casio, Rolex, Fossil",
    "Fabrics & Wax Prints | fabric, cloth, wax print, kente, ankara, lace, material, yards, batik, tie and dye | GTP, Woodin, ATL, Vlisco",
    "Underwear & Socks | underwear, boxers, panties, bra, singlet, socks, brief | ",
  ] },
  { group: "Agriculture", icon: "🌱", lines: [
    "Fertilizer | fertilizer, fertiliser, npk, urea, manure, compost, foliar | Yara, OCP, Chemico",
    "Seeds & Seedlings | seed, seeds, seedling, seedlings, hybrid | ",
    "Agrochemicals | weedicide, herbicide, pesticide, fungicide, insecticide farm, glyphosate | Wynca, Syngenta, Bayer, Chemico",
    "Animal Feed | feed, poultry feed, layer mash, broiler, fish feed, pig feed, chick | Agricare, Koudijs, Topfeeds",
    "Farm Tools & Equipment | knapsack sprayer, sprayer, cutlass, hoe, irrigation, water pump farm, tractor | ",
    "Veterinary | veterinary, vet, dewormer, vaccine animal, livestock drug | ",
  ] },
  { group: "Office & School", icon: "✏️", lines: [
    "Stationery | pen, pens, pencil, eraser, ruler, marker, highlighter, stapler, envelope, file folder, sticky notes, glue | Bic, Pelikan, Faber-Castell",
    "Books & Exercise Books | book, books, exercise book, notebook paper, textbook, novel, bible, hymn book, diary | ",
    "Printing Paper | a4 paper, paper ream, a4, ream, printing paper, card paper | Double A, PaperOne",
  ] },
  { group: "Toys, Sports & Baby", icon: "⚽", lines: [
    "Toys & Games | toy, toys, doll, teddy, puzzle, board game, ludo, lego, toy car | ",
    "Sports & Fitness | football, ball, jersey, boots football, dumbbell, treadmill, gym, skipping rope, sports | Nike, Adidas, Puma",
    "Baby Items | stroller, pram, feeding bottle, baby bottle, baby carrier, cot, walker | Chicco, Mothercare, Johnson's",
  ] },
  { group: "Packaging & Business Supplies", icon: "📦", lines: [
    "Packaging Materials | polythene bag, black bag, rubber bags, polythene, rubber bag, nylon bag, carrier bag, carton, cartons, box, boxes, sack, jute bag, shrink wrap, cling film, foil, bubble wrap | ",
    "Disposables & Food Packs | disposable, takeaway pack, food pack, foam pack, paper cup, plastic cup, straw, straws, plastic spoon, toothpick | ",
    "Hotel & Restaurant Supplies | chafing dish, catering, hotel, restaurant, menu holder | ",
  ] },
  { group: "Industrial & Safety", icon: "🦺", lines: [
    "Machinery & Equipment | machine, machinery, grinder, mixer machine, compressor, welding machine, corn mill, pump | ",
    "Safety Wear | safety boots, helmet, reflective vest, coverall, safety gloves, goggles, ear plugs | ",
  ] },
  { group: "Other", icon: "🐾", lines: [
    "Pet Supplies | dog food, cat food, pet, leash, collar dog | ",
    "Musical Instruments | guitar, keyboard piano, piano, drum, drums, trumpet, mixer audio | Yamaha, Casio",
    "Religious Items | rosary, prayer mat, anointing oil, tasbih | ",
  ] },
];

const split = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);
export const CATALOG: CatalogGroup[] = RAW.map(g => ({
  group: g.group, icon: g.icon,
  categories: g.lines.map(l => { const [name, words = "", brands = ""] = l.split("|").map(x => x.trim()); return { name, words: split(words), brands: split(brands) }; }),
}));

/** Every category, with its group, for searching. */
export const ALL_CATEGORIES = CATALOG.flatMap(g => g.categories.map(c => ({ ...c, group: g.group, icon: g.icon })));

/** Suggested brands for a category name (empty when it is the company's own category or has no common brands). */
export function brandsFor(category: string): string[] {
  return ALL_CATEGORIES.find(c => c.name.toLowerCase() === category.trim().toLowerCase())?.brands ?? [];
}
