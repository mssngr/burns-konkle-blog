// Independent Denver-area shops, confirmed open from sources dated 2025 or later (researched Nov 2026).
// Stock isn't confirmed item by item, so the site points to these per category, not per product.

export interface Shop {
  id: string
  name: string
  where: string
  href: string
  carries: string
  ships?: boolean
}

export const shops: Shop[] = [
  {
    id: 'broomtail',
    name: 'Broomtail Kids',
    where: 'Wash Park (1014 S Gaylord St) & Congress Park (3422 E 12th Ave)',
    href: 'https://broomtailkids.com/',
    carries: 'Clothing, sleep sacks, bath and mealtime, small gear, books',
    ships: true,
  },
  {
    id: 'littlebird',
    name: 'Little Bird',
    where: 'Park Hill (2200 Kearney St) & Cory-Merrill (2624 E Louisiana Ave)',
    href: 'https://www.littlebirddenver.com/',
    carries: 'Baby clothing, wooden toys, plush and books',
    ships: true,
  },
  {
    id: 'wildwest',
    name: 'Wild West Baby Co',
    where: 'Berkeley, 3875 Tennyson St',
    href: 'https://www.wildwestbaby.com/',
    carries: 'Clothing, sleep and bedding, mealtime, books and toys',
    ships: true,
  },
  {
    id: 'sidewalk',
    name: 'Where the Sidewalk Ends',
    where: 'South Pearl, 1887 S Pearl St',
    href: 'https://wherethesidewalkendshop.com/',
    carries: 'Wooden and baby toys, books',
    ships: true,
  },
  {
    id: 'blackboard',
    name: 'Beyond the Blackboard',
    where: 'Highland (3939 W 32nd Ave), Arvada & Aurora',
    href: 'https://www.beyondtheblackboard.com/',
    carries: 'Baby and first-year toys, books',
    ships: true,
  },
  {
    id: 'tattered',
    name: 'Tattered Cover',
    where: 'Several Denver-area stores',
    href: 'https://www.tatteredcover.com/',
    carries: "Denver's independent bookstore: board books",
  },
  {
    id: 'bookies',
    name: 'The Bookies',
    where: 'Southeast Denver, 2085 S Holly St',
    href: 'https://thebookies.com/',
    carries: "Children's bookstore since 1971",
  },
  {
    id: 'bumps',
    name: 'Bumps & Bundles',
    where: 'Golden, 2600 East St',
    href: 'https://www.bumpsandbundles.net/',
    carries: 'Resale: cloth diapers, nursing wear, baby clothes',
  },
  {
    id: 'mamahood',
    name: "The Mama 'Hood",
    where: 'Clayton, 3020 Clayton St',
    href: 'https://www.themamahood.com/',
    carries: 'Lactation consults, pump rentals and classes (gift cards)',
  },
  {
    id: 'bosombuddies',
    name: 'Bosom Buddies',
    where: 'Aurora / Centennial',
    href: 'https://bosombuddies.com/',
    carries: 'Hospital-grade pump and baby scale rentals',
  },
  {
    id: 'naturalgrocers',
    name: 'Natural Grocers',
    where: 'Colorado-based; stores across the metro',
    href: 'https://www.naturalgrocers.com/',
    carries: 'Natural baby skincare and pantry staples',
  },
  {
    id: 'balancedroot',
    name: 'Balanced Root Apothecary',
    where: 'Capitol Hill, 1405 N Ogden St',
    href: 'https://www.balancedrootapothecary.com/',
    carries: 'Herbs, postpartum care, balm ingredients',
    ships: true,
  },
  {
    id: 'lambshoppe',
    name: 'LambShoppe',
    where: 'Congress Park, 3512 E 12th Ave',
    href: 'https://www.thelambshoppe.com/',
    carries: 'Yarn and classes, for knitters',
  },
  {
    id: 'yarnshoppe',
    name: 'Yarn Shoppe Denver',
    where: 'Downtown, 331 14th St #216',
    href: 'https://yarnshoppedenver.com/',
    carries: 'Hand-dyed yarn, for knitters',
  },
  {
    id: 'treelotta',
    name: 'Treelotta',
    where: 'Englewood, South Broadway',
    href: 'https://www.treelotta.com/',
    carries: 'Flannel and garment fabric, for sewists',
  },
]

/** Local shops worth checking for each registry category. */
export const localByCategory: Record<string, string[]> = {
  sleep: ['broomtail', 'wildwest'],
  diapering: ['bumps'],
  bath: ['broomtail', 'naturalgrocers'],
  feeding: ['broomtail', 'wildwest'],
  health: ['naturalgrocers'],
  clothing: ['littlebird', 'broomtail', 'wildwest'],
  micala: ['mamahood', 'bosombuddies', 'balancedroot'],
  'later-sleep': ['wildwest', 'broomtail'],
  play: ['sidewalk', 'blackboard', 'littlebird', 'tattered', 'bookies'],
  'later-feeding': ['wildwest', 'broomtail'],
  'later-clothing': ['littlebird', 'broomtail', 'wildwest'],
  'later-micala': ['bosombuddies'],
}

export const shopById = Object.fromEntries(shops.map(s => [s.id, s]))
