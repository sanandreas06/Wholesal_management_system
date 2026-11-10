/**
 * Ready-made product categories (grouped the way shoppers know them from online stores) and brands commonly sold in Ghana for
 * each one. Nobody has to set anything up before adding a product: pick from the list, or choose "Other" and type a name.
 * The chosen names are saved on the product; WHOLESTRA creates the company's category and brand records by itself.
 */
export interface CatalogCategory { name: string; brands: string[] }
export interface CatalogGroup { group: string; icon: string; categories: CatalogCategory[] }

export const CATALOG: CatalogGroup[] = [
  { group: "Groceries", icon: "🛒", categories: [
    { name: "Rice & Grains", brands: ["Royal Aroma", "Gino", "Uncle Sam", "Fortune", "Mama's Choice", "Tilda"] },
    { name: "Cooking Oil", brands: ["Frytol", "Gino", "Sunflower", "Mamador", "Sunola", "Golden Penny"] },
    { name: "Tomato Paste & Sauces", brands: ["Gino", "Tasty Tom", "Pomo", "Ojah", "Heinz"] },
    { name: "Sugar, Salt & Seasoning", brands: ["Maggi", "Royco", "Onga", "Knorr", "St. Louis", "Dangote"] },
    { name: "Flour & Baking", brands: ["Golden Penny", "Dangote", "Gold Coin", "Pioneer", "Prestige"] },
    { name: "Pasta & Noodles", brands: ["Indomie", "Golden Penny", "Gino", "Dangote", "Tummy Tummy"] },
    { name: "Canned & Tinned Food", brands: ["Geisha", "Titus", "Ideal", "Heinz", "La Pesquera"] },
    { name: "Milk & Dairy", brands: ["Peak", "Ideal", "Cowbell", "Nido", "Dano", "Carnation", "Fan Milk"] },
    { name: "Tea, Coffee & Cocoa", brands: ["Milo", "Nescafé", "Lipton", "Richoco", "Golden Tree", "Bournvita", "Ovaltine"] },
    { name: "Biscuits & Snacks", brands: ["McVitie's", "Digestive", "Cabin", "Pringles", "Nutri Snax", "Oreo"] },
    { name: "Breakfast Cereals", brands: ["Kellogg's", "Nestlé", "Golden Morn", "Weetabix", "Quaker"] },
  ] },
  { group: "Drinks", icon: "🥤", categories: [
    { name: "Soft Drinks", brands: ["Coca-Cola", "Fanta", "Sprite", "Pepsi", "Mirinda", "7Up", "Bigoo"] },
    { name: "Malt Drinks", brands: ["Malta Guinness", "Beta Malt", "Alvaro", "Vitamalt", "Amstel Malta"] },
    { name: "Water", brands: ["Voltic", "Bel-Aqua", "Verna", "Cool Pac", "Aqua Splash"] },
    { name: "Juice", brands: ["Ceres", "Pure Heaven", "Tampico", "Kalypo", "Don Simon"] },
    { name: "Energy Drinks", brands: ["Red Bull", "Rush", "Storm", "Monster", "Power Horse"] },
    { name: "Beer", brands: ["Club", "Star", "Guinness", "Gulder", "Heineken", "Origin"] },
    { name: "Wines & Spirits", brands: ["Kasapreko", "Alomo", "Origin Bitters", "Bel's", "Hennessy", "Johnnie Walker"] },
  ] },
  { group: "Household", icon: "🏠", categories: [
    { name: "Detergents & Laundry", brands: ["Omo", "Sunlight", "Ariel", "Klin", "Madar", "Key Soap"] },
    { name: "Cleaning Products", brands: ["Harpic", "Dettol", "Jik", "Mr. Muscle", "Vim"] },
    { name: "Air Fresheners & Diffusers", brands: ["Air Wick", "Glade", "Ambi Pur", "Febreze", "Arome"] },
    { name: "Insecticides", brands: ["Raid", "Mortein", "Rambo", "Baygon"] },
    { name: "Tissue & Paper", brands: ["Softcare", "Rose", "Twinsaver", "Velvex"] },
    { name: "Kitchen & Dining", brands: ["Tefal", "Pyrex", "Luminarc", "Royalford", "Kitchen King"] },
  ] },
  { group: "Health & Beauty", icon: "💄", categories: [
    { name: "Body Care & Lotions", brands: ["Nivea", "Vaseline", "Dove", "Jergens", "Cocoa Butter", "Aveeno"] },
    { name: "Soap & Shower", brands: ["Key Soap", "Dettol", "Lux", "Dove", "Protex", "Imperial Leather"] },
    { name: "Hair Care", brands: ["Dark and Lovely", "TCB", "Olive Oil", "Cantu", "Shea Moisture", "Pantene"] },
    { name: "Oral Care", brands: ["Pepsodent", "Close Up", "Colgate", "Oral-B", "Sensodyne"] },
    { name: "Perfumes & Deodorants", brands: ["Rexona", "Nivea", "Sure", "Lattafa", "Axe"] },
    { name: "Baby Care", brands: ["Pampers", "Huggies", "Johnson's", "Molfix", "Softcare"] },
    { name: "Medicines (over the counter)", brands: ["Panadol", "Ernest Chemists", "Kinapharma", "Tobinco"] },
  ] },
  { group: "Phones & Tablets", icon: "📱", categories: [
    { name: "Mobile Phones", brands: ["Samsung", "Tecno", "Infinix", "itel", "Apple", "Xiaomi", "Nokia", "Oppo"] },
    { name: "Tablets", brands: ["Samsung", "Apple", "Lenovo", "Huawei", "Tecno"] },
    { name: "Phone Accessories", brands: ["Oraimo", "Samsung", "Apple", "Anker", "XO"] },
  ] },
  { group: "Electronics", icon: "📺", categories: [
    { name: "TVs & Audio", brands: ["Nasco", "Samsung", "LG", "Hisense", "TCL", "Sony", "Bruhm"] },
    { name: "Home Appliances", brands: ["Nasco", "Binatone", "Midea", "Hisense", "LG", "Samsung", "Bruhm"] },
    { name: "Fans & Air Conditioners", brands: ["Nasco", "Binatone", "Midea", "LG", "Bruhm"] },
    { name: "Electrical & Lighting", brands: ["Philips", "Schneider", "Legrand", "Nexans", "Osram"] },
    { name: "Computers & Accessories", brands: ["HP", "Dell", "Lenovo", "Apple", "Asus", "Acer"] },
    { name: "Generators & Solar", brands: ["Elepaq", "Tiger", "Firman", "Sumec", "Jinko"] },
  ] },
  { group: "Automobile", icon: "🚗", categories: [
    { name: "Engines & Gearboxes", brands: ["Toyota", "Nissan", "Hyundai", "Kia", "Honda", "Mercedes-Benz", "Ford"] },
    { name: "Auto Spare Parts", brands: ["Toyota", "Nissan", "Hyundai", "Kia", "Honda", "Bosch", "Denso"] },
    { name: "Tyres", brands: ["Michelin", "Bridgestone", "Dunlop", "Goodyear", "Pirelli", "Continental"] },
    { name: "Lubricants & Engine Oil", brands: ["Total", "Shell", "Mobil", "Castrol", "GOIL", "Star Oil"] },
    { name: "Car Batteries", brands: ["Exide", "Varta", "Bosch", "Amaron", "Hankook"] },
    { name: "Motorbike Parts", brands: ["Honda", "Yamaha", "Suzuki", "Bajaj", "Haojue"] },
  ] },
  { group: "Building & Hardware", icon: "🧱", categories: [
    { name: "Cement", brands: ["Ghacem", "Dangote", "Diamond Cement", "Supacem", "CIMAF"] },
    { name: "Iron Rods & Steel", brands: [] },
    { name: "Roofing Sheets", brands: [] },
    { name: "Tiles & Flooring", brands: ["Twyford", "Goodwill", "Ceramica"] },
    { name: "Paint", brands: ["Azar", "Dulux", "Sika", "Coral"] },
    { name: "Plumbing", brands: ["Interplast", "Polytank", "Duraplast"] },
    { name: "Tools", brands: ["Ingco", "Stanley", "Bosch", "Makita", "Total"] },
  ] },
  { group: "Fashion", icon: "👗", categories: [
    { name: "Men's Clothing", brands: [] },
    { name: "Women's Clothing", brands: [] },
    { name: "Shoes & Slippers", brands: ["Nike", "Adidas", "Puma", "Bata"] },
    { name: "Bags & Accessories", brands: [] },
    { name: "Fabrics & Wax Prints", brands: ["GTP", "Woodin", "ATL", "Vlisco"] },
  ] },
  { group: "Agriculture", icon: "🌱", categories: [
    { name: "Fertilizer", brands: ["Yara", "OCP", "Chemico"] },
    { name: "Seeds", brands: [] },
    { name: "Agrochemicals", brands: ["Wynca", "Syngenta", "Bayer", "Chemico"] },
    { name: "Animal Feed", brands: ["Agricare", "Koudijs", "Topfeeds"] },
  ] },
  { group: "Office & School", icon: "✏️", categories: [
    { name: "Stationery", brands: ["Bic", "Pelikan", "Faber-Castell", "Double A"] },
    { name: "Books", brands: [] },
    { name: "Printing & Ink", brands: ["HP", "Canon", "Epson", "Brother"] },
  ] },
  { group: "Toys, Sports & Baby", icon: "⚽", categories: [
    { name: "Toys & Games", brands: [] },
    { name: "Sports & Fitness", brands: ["Nike", "Adidas", "Puma"] },
    { name: "Baby Items", brands: ["Chicco", "Mothercare", "Johnson's"] },
  ] },
];

/** Every category name, for searching. */
export const ALL_CATEGORIES = CATALOG.flatMap(g => g.categories.map(c => ({ ...c, group: g.group, icon: g.icon })));

/** Suggested brands for a category name (empty when it is the company's own category or has no common brands). */
export function brandsFor(category: string): string[] {
  return ALL_CATEGORIES.find(c => c.name.toLowerCase() === category.trim().toLowerCase())?.brands ?? [];
}
