// Registry content, adapted from Micala's "Hospital Bag, Registry & First Weeks Home" guide.
// Option strings may end in "(detail)", which renders as a smaller note.
// `one: true` means only a single gift is needed: once any option is claimed, the rest close.

export interface Item {
  id: string
  name: string
  qty?: string
  options: string[]
  /** A handmade alternative guests can claim instead. */
  make?: string
  /** Shown instead of a handmade option when handmade isn't safe. */
  restriction?: string
  one?: boolean
  /** Over about $100: flagged so guests know it's a good one to go in on together. */
  group?: boolean
  note?: string
}

export interface Category {
  id: string
  title: string
  items: Item[]
  goodToKnow?: string
}

export interface Stage {
  id: string
  tab: string
  title: string
  intro: string
  categories: Category[]
}

export interface HelpItem {
  id: string
  name: string
  description: string
  goal?: string
  link?: { shop: string; href: string }
}

export const stages: Stage[] = [
  {
    id: 'newborn',
    tab: 'Newborn',
    title: 'For the first weeks',
    intro:
      'Everything we need for a mid-December arrival. Most lines list two or three options, so several of you can each give a different version and we can learn what works.',
    categories: [
      {
        id: 'carrying',
        title: 'Carrying & travel',
        items: [
          {
            id: 'stretchy-wraps',
            name: 'Stretchy wrap',
            qty: '1',
            one: true,
            options: ['Moby Fit Hybrid'],
            make: 'Cotton jersey wrap, 5.5 yd, no-sew',
          },
          {
            id: 'ring-sling',
            name: 'Ring sling or carrier for Gabriel',
            qty: '1–2',
            options: ['Ergobaby Embrace (newborn soft carrier)'],
            make: 'Ring sling sewn with certified sling rings',
          },
          {
            id: 'travel-system',
            group: true,
            name: 'Car seat + stroller system',
            qty: '1',
            one: true,
            options: [
              'Chicco KeyFit 35 ClearTex + Corso or Bravo (no added flame-retardant chemicals)',
            ],
            restriction: 'Buy new only, never secondhand or handmade.',
            note: 'Please check with us first: our existing car seat base only fits seats from the same brand.',
          },
          {
            id: 'canopy-covers',
            name: 'Car seat covers, canopy style',
            qty: '2',
            options: ['Milk Snob stretch cover'],
          },
          {
            id: 'diaper-backpacks',
            name: 'Diaper backpacks',
            qty: '2–3',
            options: ['Pillani (BabbleRoo) diaper backpack'],
          },
        ],
        goodToKnow:
          'Please pick canopy-style car seat covers that stretch over the top of the seat. Covers that go between baby and the harness aren’t safe.',
      },
      {
        id: 'sleep',
        title: 'Sleep',
        items: [
          {
            id: 'stationary-bassinet',
            group: true,
            name: 'Stationary bassinet',
            qty: '2',
            options: [
              'HALO BassiNest Essential Sleeper',
              'Second HALO BassiNest Essential Sleeper',
            ],
            restriction: 'Buy only: must meet the federal bassinet standard.',
          },
          {
            id: 'bassinet-pad',
            name: 'Organic bassinet mattress pad',
            qty: 'if not included',
            one: true,
            options: ['Naturepedic organic bassinet pad'],
          },
          {
            id: 'bassinet-sheets',
            name: 'Bassinet sheets',
            qty: '4–6',
            options: [
              'Halo BassiNest fitted sheet (100% organic cotton muslin, 2-pack)',
            ],
            make: 'Organic muslin or flannel fitted sheet, sewn snug',
          },
          {
            id: 'zip-swaddles',
            name: 'Zip swaddles',
            qty: '3–4',
            options: [
              "Burt's Bees Baby Beekeeper wearable blanket (100% organic cotton)",
              'Tiny Kind Organic Cotton Wearable Swaddle',
              'Small Story Organic Cotton Wearable Swaddle',
            ],
            restriction: 'Store-bought only, please.',
          },
          {
            id: 'muslin-swaddles',
            name: 'Muslin swaddle blankets',
            qty: '4–6',
            options: [
              "Burt's Bees Baby",
              'Ade + Ayo Bògò muslin swaddle (Bamboo-cotton muslin, mud-cloth print)',
            ],
            make: '47-inch organic muslin squares, hemmed',
          },
          {
            id: 'sound-machine',
            name: 'Sound machines',
            qty: '1 home, 1 portable',
            options: ['Hatch Go', 'Yogasleep Hushh'],
          },
          {
            id: 'monitors',
            name: 'Baby monitors',
            qty: '2',
            options: [
              'eufy Baby Monitor C10 (works without Wi-Fi)',
            ],
            note: 'Please skip monitors with AI features. App-connected is fine.',
          },
        ],
        goodToKnow:
          'Please skip weighted sleep sacks, pillows, positioners, bumpers and loungers. They aren’t safe for infant sleep.',
      },
      {
        id: 'diapering',
        title: 'Diapering',
        items: [
          {
            id: 'newborn-cloth',
            name: 'Newborn cloth diapers (all-in-one)',
            qty: '24',
            options: ['Thirsties Natural Newborn All-in-One (5–14 lb)'],
            make: 'Flat diapers hemmed from organic birdseye cotton',
          },
          {
            id: 'onesize-cloth',
            name: 'One-size cloth diapers (all-in-one)',
            qty: '18–24',
            options: [
              'Thirsties Natural One Size All-in-One, snap (8–40 lb, organic cotton and hemp)',
            ],
            make: 'Fitted diapers from a free pattern in hemp and cotton',
          },
          {
            id: 'disposables',
            name: 'Disposable diapers for outings',
            options: ['Kudos (cotton liner)'],
          },
          {
            id: 'cloth-wipes',
            name: 'Cloth wipes',
            qty: '48–60',
            options: [],
            make: 'Flannel squares, the easiest first sewing project',
          },
          {
            id: 'compostable-wipes',
            name: 'Compostable wipes',
            options: ['WaterWipes', 'Coterie'],
          },
          {
            id: 'sensitive-wipes',
            name: 'Sensitive-skin wipes',
            options: [
              'Proudly Gentle Touch Baby Wipes (98% water, fragrance-free)',
            ],
          },
          {
            id: 'diaper-balm',
            name: 'Diaper balm',
            qty: '2–3 to test',
            options: [
              'Earth Mama Organic Diaper Balm',
              'Weleda Calendula Diaper Cream',
              'Badger Zinc Oxide',
              'Motherlove Diaper Balm (Zinc-free, cloth-diaper safe)',
            ],
            make: 'Zinc and shea balm (no essential oils)',
          },
          {
            id: 'portable-pad',
            name: 'Portable changing pads',
            qty: '2',
            options: [
              'Itzy Ritzy changing pad',
              'Skip Hop Pronto',
            ],
            make: 'Quilted cotton pad over a wool puddle pad',
          },
          {
            id: 'changing-pad-covers',
            name: 'Changing pad covers',
            qty: '3',
            options: [
              'Hudson Baby cotton changing pad covers',
              'Munchkin cotton changing pad covers (2-pack)',
              'Cotton muslin changing pad covers',
            ],
            make: 'Organic cotton or bamboo terry covers',
          },
          {
            id: 'wipe-warmer',
            name: 'Wipe warmer',
            qty: 'optional',
            one: true,
            options: ['Munchkin'],
          },
        ],
        goodToKnow:
          "We're mostly cloth diapering. Disposables are just for outings.",
      },
      {
        id: 'bath',
        title: 'Bath, skin & hair',
        items: [
          {
            id: 'baby-bath',
            name: 'Baby bath',
            qty: '1',
            one: true,
            options: ['Frida Baby 4-in-1'],
          },
          {
            id: 'cleanser',
            name: 'Gentle or no-rinse cleanser',
            options: [
              'Medline Remedy Essentials no-rinse foam',
              'Earth Mama Simply Non-Scents Castile Baby Wash',
              "Dr. Bronner's unscented (diluted)",
              'Motherlove Baby & All Soap, Simply Unscented (Organic foaming castile)',
            ],
            make: 'Oat bath sachets in muslin',
          },
          {
            id: 'ointment',
            name: 'Ointment',
            options: [
              'Tubby Todd All Over Ointment',
              'Badger Baby Balm (unscented)',
              'Weleda Calendula body cream',
              'Proudly All Over Balm (Fragrance-free, mango butter + plant oils)',
            ],
            make: 'Calendula oil balm',
          },
          {
            id: 'hooded-towels',
            name: 'Hooded towels',
            qty: '3',
            options: ["Burt's Bees Baby organic"],
            make: 'Bath towel with a washcloth hood',
          },
          {
            id: 'washcloths',
            name: 'Washcloths',
            qty: '10',
            options: ["Organic cotton washcloth pack (Burt's Bees Baby)"],
            make: 'Flannel or terry squares',
          },
          {
            id: 'grooming',
            name: 'Comb, brush & scrubby',
            options: ['Frida Baby DermaFrida FlakeFixer'],
          },
        ],
        goodToKnow: 'Fragrance-free, please, with no essential oils.',
      },
      {
        id: 'feeding',
        title: 'Feeding',
        items: [
          {
            id: 'glass-bottles',
            name: 'Glass bottles',
            qty: '4',
            options: [
              'Philips Avent Natural Glass',
              "Dr. Brown's Options+ Glass",
              'Evenflo Classic Glass',
            ],
          },
          {
            id: 'other-bottles',
            name: 'Other bottles',
            qty: '2–4',
            options: [
              'Pura Kiki stainless',
              'Comotomo silicone',
            ],
          },
          {
            id: 'formula',
            name: 'Formula, small cans to test',
            options: [
              'Kendamil Organic (UK-made, FDA-approved, palm oil free)',
            ],
            restriction: 'Never homemade.',
          },
          {
            id: 'bottle-washer',
            name: 'Bottle washer or dryer',
            qty: '1',
            one: true,
            options: [
              'Papablic sterilizer-dryer',
            ],
          },
          {
            id: 'bottle-soap',
            name: 'Bottle soap',
            options: [
              'Dapple fragrance-free',
              'Seventh Generation Free & Clear',
              "Dr. Bronner's Sal Suds",
            ],
          },
          {
            id: 'brushes',
            name: 'Bottle brushes',
            qty: '2 sets',
            options: [
              'Full Circle bamboo brush',
              'Straw and lid cleaning brush',
            ],
          },
          {
            id: 'nursing-pillows',
            name: 'Nursing pillows',
            qty: '2',
            options: ['Boppy'],
          },
          {
            id: 'nursing-pillow-covers',
            name: 'Nursing pillow covers',
            qty: '3',
            options: ['Boppy organic cotton cover'],
            make: 'Covers sewn from organic jersey',
          },
          {
            id: 'burp-cloths',
            name: 'Burp cloths',
            qty: '10–12',
            options: ["Burt's Bees Baby"],
            make: 'Flannel and terry burp cloths',
          },
          {
            id: 'cloth-bibs',
            name: 'Cloth bibs',
            qty: '6',
            options: ["Organic cotton bandana bibs (Burt's Bees)"],
            make: 'Easy-sew bandana bibs',
          },
          {
            id: 'silicone-bibs',
            name: 'Silicone bibs, for solids later',
            qty: '2',
            options: ['Bumkins'],
          },
          {
            id: 'pacifiers',
            name: 'Pacifiers',
            qty: '2',
            options: ['Natursutten or Hevea natural rubber pacifiers'],
          },
        ],
        goodToKnow:
          'For formula, please stick with Kendamil Organic, an FDA-approved brand, and skip imported HiPP or Holle.',
      },
      {
        id: 'health',
        title: 'Health & comfort',
        items: [
          {
            id: 'gas-relief',
            name: 'Gas relief',
            options: [
              "Infants' Mylicon (simethicone)",
              'BioGaia Protectis probiotic drops',
              'Frida Baby Windi',
            ],
          },
          {
            id: 'congestion',
            name: 'Congestion',
            options: ['Little Remedies saline spray', 'Boogie Wipes'],
          },
          {
            id: 'nose-aspirator',
            name: 'Booger sucker',
            options: ['NoseFrida'],
          },
          {
            id: 'nail-care',
            name: 'Nail care',
            options: ['Frida Baby NailFrida'],
          },
          {
            id: 'vitamin-d',
            name: 'Vitamin D drops',
            options: ["Carlson Baby's Super Daily D3"],
          },
        ],
        goodToKnow:
          'Please skip anything with essential oils, camphor or menthol. They aren’t safe for newborns.',
      },
      {
        id: 'clothing',
        title: 'Clothing',
        items: [
          {
            id: 'zip-footies',
            name: 'Two-way zip footies',
            qty: '6 newborn + 6 0–3 mo',
            options: [
              "Burt's Bees Baby organic",
              'Colored Organics',
            ],
          },
          {
            id: 'kimono-tops',
            name: 'Side-snap kimono tops and bodysuits',
            qty: '6 + 6',
            options: [
              'Colored Organics',
              "Burt's Bees Baby organic",
            ],
            make: 'Kimono top from a free pattern',
          },
          {
            id: 'merino-layer',
            name: 'Merino layers for December',
            qty: '2',
            options: [
              'Woolbabe merino and organic cotton pajamas',
              'Quince 100% merino baby base layer set',
            ],
            make: 'Hand-knit wool soakers and longies',
          },
          {
            id: 'hats-mitts',
            name: 'Hats and mitts',
            qty: '4 + 4',
            options: [
              'Organic cotton hat-and-mitt sets',
              'Lucy Lue Organics organic baby hat (Organic cotton, 0–3 mo)',
            ],
            make: 'Hand-knit or sewn',
          },
          {
            id: 'bonnets',
            name: 'Silk-lined bonnets',
            qty: '3–4',
            options: ['Cosilana mulberry silk baby bonnet'],
          },
        ],
        goodToKnow:
          'Please skip puffy snowsuits. They aren’t safe in a car seat.',
      },
      {
        id: 'home',
        title: 'Home & organization',
        items: [
          {
            id: 'caddies',
            name: 'Caddies',
            qty: '2 bath, 2 car, 1 kitchen, 1 living room',
            options: ['IKEA VÄLVÅRDAD organizer (small steel caddy)'],
            make: 'Sewn canvas caddies',
          },
          {
            id: 'play-mat',
            name: 'Cotton play mat',
            qty: '1',
            one: true,
            options: [
              'Finch & Folk organic cotton play mat',
              'Wee Gallery Organic Baby Play Mat',
              'Makemake Organics quilted play mat',
            ],
            make: 'Quilted cotton floor mat',
          },
          {
            id: 'lactation-cookies',
            name: 'Lactation cookies',
            options: [
              'Milky Mama Oatmeal Lactation Cookies (Fenugreek-free, 12 individually wrapped)',
            ],
          },
        ],
      },
      {
        id: 'micala',
        title: 'For Micala',
        items: [
          {
            id: 'nursing-bras',
            name: 'Nursing bras',
            qty: '3–5',
            options: [
              'Kindred Bravely Simply Sublime',
              'Boob Design organic cotton',
            ],
            note: 'Ask Gabriel for sizing.',
          },
          {
            id: 'nursing-wear',
            name: 'Everyday nursing wear',
            qty: '5–10',
            options: ['Old Navy', 'Gap'],
          },
          {
            id: 'nursing-cover',
            name: 'Nursing cover or cape',
            qty: '1–2',
            options: ['Udder Covers'],
            make: 'Muslin rectangle with a neck strap',
          },
          {
            id: 'nipple-care',
            name: 'Nipple care',
            options: [
              'Earth Mama Organic Nipple Butter',
              'Motherlove Nipple Cream',
              'Silverette silver nursing cups',
            ],
            make: 'Lanolin-free nipple butter',
          },
          {
            id: 'hydrogel',
            name: 'Hydrogel pads',
            options: ['Lansinoh Soothies', 'Medela hydrogel'],
          },
          {
            id: 'reusable-pads',
            name: 'Reusable breast pads',
            qty: '8–12',
            options: [
              'Bamboobies',
              'Kindred Bravely organic',
              'LANACare or Disana wool',
            ],
            make: 'Flannel and wool rounds',
          },
          {
            id: 'disposable-pads',
            name: 'Disposable breast pads',
            qty: '1–2 boxes',
            options: ['Lansinoh', 'Bamboobies disposable'],
          },
          {
            id: 'pump',
            name: 'Breast pump',
            options: [
              'Spectra S1 Plus or S2 Plus',
            ],
            note: 'Insurance usually covers one pump.',
          },
        ],
      },
    ],
  },
  {
    id: 'later',
    tab: '6 wks – 6 mo',
    title: 'Six weeks to six months',
    intro:
      'Next-stage things you can give now for later. Babies outgrow newborn gear within weeks, so clothes here are in 3–6 and 6–9 month sizes.',
    categories: [
      {
        id: 'later-sleep',
        title: 'Sleep',
        items: [
          {
            id: 'sleep-sacks',
            name: 'Sleep sacks for after swaddling',
            qty: '3',
            options: [
              'Halo SleepSack wearable blanket (cotton, not the fleece version)',
            ],
          },
          {
            id: 'crib',
            group: true,
            name: 'Crib',
            qty: '1',
            one: true,
            options: [
              'IKEA Sniglar (solid beech)',
              'Ashley solid New Zealand pine crib',
            ],
            restriction: 'Buy only: must meet the federal crib standard.',
          },
          {
            id: 'crib-mattress',
            group: true,
            name: 'Organic crib mattress',
            qty: '1',
            one: true,
            options: ['Lullaby Earth Healthy Support'],
          },
          {
            id: 'crib-sheets',
            name: 'Crib sheets',
            qty: '3–4',
            options: [
              "Burt's Bees Baby organic",
              'The Rooted Baby Co. Mali crib sheet (100% organic cotton muslin)',
            ],
            make: 'Sewn fitted sheet',
          },
        ],
        goodToKnow: 'Please skip crib bumpers, pillows and loose blankets.',
      },
      {
        id: 'later-outings',
        title: 'Carrying & outings',
        items: [
          {
            id: 'bigger-carrier',
            name: 'Bigger soft carrier',
            qty: '1–2',
            options: ['Infantino Flip Advanced 4-in-1'],
            make: 'Linen ring sling',
          },
        ],
      },
      {
        id: 'play',
        title: 'Play & development',
        items: [
          {
            id: 'play-gym',
            name: 'Play gym',
            qty: '1',
            one: true,
            options: [
              'Lovevery The Play Gym',
              'Plan Toys wooden baby gym (rubberwood)',
            ],
            make: 'Wooden A-frame with crocheted hanging toys',
          },
          {
            id: 'floor-mirror',
            name: 'Floor mirror',
            qty: '1',
            one: true,
            options: [
              'Shatterproof baby floor mirror (Whitney Brothers, birch frame)',
            ],
          },
          {
            id: 'books-cards',
            name: 'High-contrast cards and board books',
            options: [
              'Wee Gallery art cards',
              'Global Babies',
              'Whose Toes Are Those? (Jabari Asim)',
              'Please, Baby, Please (Spike Lee and Tonya Lewis Lee)',
              'Bright Brown Baby by Andrea Davis Pinkney and Brian Pinkney (from Shop at MATTER, Denver)',
            ],
          },
          {
            id: 'rattles',
            name: 'Rattles and grasping toys',
            qty: '3–4',
            options: ["Haba or Grimm's wooden rattles"],
            make: 'Crocheted cotton rattle, firmly stitched, no buttons',
          },
          {
            id: 'teethers',
            name: 'Teethers',
            qty: '3–4',
            options: [
              'Sophie la girafe (natural rubber)',
              'Natursutten natural rubber teether',
              'The Rooted Baby Co. Esono the Elephant teether (Food-grade silicone + beechwood)',
            ],
          },
          {
            id: 'bouncer',
            name: 'Bouncer for supervised awake time',
            qty: '1',
            one: true,
            options: [
              'Baby Delight Heirloom Aspen Wood Bouncer',
              'Avenlur Fir Wooden Bouncer (foldable, with play arch)',
            ],
          },
          {
            id: 'tag-blanket',
            name: 'Tag blanket',
            qty: '1–2',
            options: [],
            make: 'Two flannel squares with ribbon loops sewn flat',
          },
        ],
        goodToKnow:
          'Please skip amber teething necklaces and numbing or homeopathic teething gels; the FDA warns against both.',
      },
      {
        id: 'later-feeding',
        title: 'Feeding, around 4–6 months',
        items: [
          {
            id: 'next-nipples',
            name: 'Next-flow bottle nipples',
            qty: '2 packs',
            options: ['Matched to our bottles'],
          },
          {
            id: 'high-chair',
            group: true,
            name: 'High chair',
            qty: '1',
            one: true,
            options: [
              'Hauck Alpha+ (with the wooden tray)',
              'Nobodinoz solid wood high chair (with the wooden tray)',
            ],
          },
          {
            id: 'spoons-cup',
            name: 'First spoons and open cup',
            options: [
              'Avanchy bamboo and silicone spoons',
              'ezpz Tiny Cup',
            ],
          },
          {
            id: 'milk-storage',
            name: 'Milk storage',
            options: [
              'Glass breast milk bottles',
            ],
          },
        ],
      },
      {
        id: 'later-clothing',
        title: 'Clothing, bath & hair',
        items: [
          {
            id: 'bigger-clothes',
            name: '3–6 and 6–9 month clothes',
            qty: '8–10 each',
            options: [
              "Burt's Bees Baby organic",
              'Colored Organics',
            ],
            make: 'Hand-knit wool longies',
          },
          {
            id: 'next-bonnets',
            name: 'Next-size bonnets',
            qty: '2–3',
            options: ['Cosilana mulberry silk baby bonnet'],
          },
          {
            id: 'hair-care',
            name: 'Hair care as curls grow',
            options: [
              'Unscented jojoba oil',
              'Proudly Nourishing Hair & Body Oil (5 ingredients, fragrance-free)',
              'Alaffia Pure Unrefined Shea Butter, Unscented (Single ingredient, fair trade)',
            ],
            make: 'Whipped shea and jojoba hair butter',
          },
          {
            id: 'wool-sweaters',
            name: 'Wool sweaters and booties for winter',
            qty: '2 + 2',
            options: ['Ruskovilla or Reima merino'],
            make: 'Hand-knit wool sweater',
          },
        ],
      },
      {
        id: 'later-micala',
        title: 'For Micala, months 2–6',
        items: [
          {
            id: 'pumping-bra',
            name: 'Hands-free pumping bra',
            qty: '1–2',
            options: [
              'Kindred Bravely Sublime hands-free',
              'Bravado Clip and Pump',
            ],
          },
          {
            id: 'pump-parts',
            name: 'Pump spare parts',
            options: ['Valves, membranes and flanges for her pump'],
          },
          {
            id: 'milk-cooler',
            name: 'Insulated milk cooler bag',
            qty: '1',
            one: true,
            options: [
              'Medela or Lansinoh cooler with ice pack',
            ],
          },
          {
            id: 'work-tops',
            name: 'Work-friendly nursing tops',
            qty: '3–4',
            options: ['Old Navy', 'Gap'],
          },
        ],
      },
    ],
  },
]

export const help: HelpItem[] = [
  {
    id: 'lactation',
    name: 'Lactation consultant fund',
    description:
      'Chip in toward a home visit from a lactation consultant in our first weeks.',
    link: {
      shop: "The Mama 'Hood gift card (Denver)",
      href: 'https://www.themamahood.com/',
    },
  },
  {
    id: 'doula',
    name: 'Postpartum doula fund',
    description: 'Chip in toward a few hours of postpartum doula support.',
  },
]

export function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export function splitOption(s: string) {
  const m = s.match(/^(.*?)\s*\(([^()]+)\)$/)
  return m ? { label: m[1], detail: m[2] } : { label: s, detail: undefined }
}

export function optionKey(itemId: string, option: string) {
  return `${itemId}/${slug(splitOption(option).label)}`
}

export const handmadeKey = (itemId: string) => `${itemId}/handmade`
