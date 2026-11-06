// Registry content, adapted from Micala's "Hospital Bag, Registry & First Weeks Home" guide.
// Option strings may end in "(detail)", which renders as a smaller note.
// `one: true` means only a single gift is needed: once any option is claimed, the rest close.

export interface Item {
  id: string
  name: string
  qty?: string
  options: string[]
  /** A handmade / Etsy alternative guests can claim instead. */
  make?: string
  /** Shown instead of a handmade option when handmade isn't safe. */
  restriction?: string
  one?: boolean
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
            name: 'Stretchy wraps',
            qty: '2',
            options: [
              'Moby Hybrid',
              'Solly Baby (lyocell, thin and cool)',
              'Boba Wrap',
            ],
            make: 'Cotton jersey wrap, 5.5 yd, no-sew',
          },
          {
            id: 'ring-sling',
            name: 'Ring sling or carrier for Gabriel',
            qty: '1–2',
            options: [
              'Ergobaby Embrace (newborn soft carrier)',
              'Baby Tula Explore',
              'Sakura Bloom or Wildbird linen ring sling',
            ],
            make: 'Linen ring sling from Etsy, or sewn with certified sling rings',
          },
          {
            id: 'travel-system',
            name: 'Car seat + stroller system',
            qty: '1',
            one: true,
            options: [
              'Chicco KeyFit 35 ClearTex + Corso or Bravo (no added flame-retardant chemicals)',
              'UPPAbaby Mesa Max + Vista or Cruz (merino wool)',
              'Nuna Pipa + Mixx or TRVL',
            ],
            restriction: 'Buy new only, never secondhand or handmade.',
            note: 'Please check with us first: our existing car seat base only fits seats from the same brand.',
          },
          {
            id: 'canopy-covers',
            name: 'Car seat covers, canopy style',
            qty: '2',
            options: [
              'Milk Snob stretch cover',
              'Organic muslin canopy cover',
              'JJ Cole Bundleme canopy',
            ],
            make: 'Muslin or wool canopy cover from Etsy',
          },
          {
            id: 'diaper-backpacks',
            name: 'Diaper backpacks',
            qty: '2–3',
            options: [
              'Itzy Ritzy Boss Plus (built-in changing pad)',
              'Freshly Picked City Pack',
              'A fold-out changing-station backpack',
            ],
            make: 'Waxed canvas or leather backpack from Etsy',
          },
        ],
        goodToKnow:
          'Car seat covers go over the canopy, shower-cap style, never between baby and the harness. Fold-out backpack beds are for changes only, not sleep.',
      },
      {
        id: 'sleep',
        title: 'Sleep',
        items: [
          {
            id: 'wheeled-bassinet',
            name: 'Wheeled bassinet',
            qty: '1',
            one: true,
            options: [
              'Babyletto Origami Mini (wood, folds, casters)',
              'Chicco Close to You',
              'Halo BassiNest Swivel',
            ],
            restriction: 'Buy only: must meet the federal bassinet standard.',
          },
          {
            id: 'stationary-bassinet',
            name: 'Stationary bassinet',
            qty: '1',
            one: true,
            options: [
              'Moses basket with stand (labeled as meeting the bassinet standard)',
              'Halo BassiNest Essentia',
            ],
            restriction:
              'Handmade baskets only if certified to the bassinet standard.',
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
              "Burt's Bees Baby organic",
              'Kyte Baby bamboo',
              'Sheets matched to the bassinet brand',
            ],
            make: 'Organic muslin or flannel fitted sheet, sewn snug',
          },
          {
            id: 'zip-swaddles',
            name: 'Zip swaddles',
            qty: '3–4',
            options: [
              'Halo SleepSack Swaddle (organic cotton option)',
              'Love to Dream Swaddle UP (arms-up "starfish")',
              'Woolino merino swaddle',
            ],
            restriction: 'Store-bought only, please.',
          },
          {
            id: 'muslin-swaddles',
            name: 'Muslin swaddle blankets',
            qty: '4–6',
            options: ['aden + anais organic', "Burt's Bees Baby", 'Kyte Baby'],
            make: '47-inch organic muslin squares, hemmed',
          },
          {
            id: 'sound-machine',
            name: 'Sound machines',
            qty: '1 home, 1 portable',
            options: ['Hatch Rest', 'Hatch Rest Go', 'Yogasleep Hushh'],
          },
          {
            id: 'humidifier',
            name: 'Cool-mist humidifier',
            qty: '1',
            one: true,
            options: ['Canopy (no mist, easy to clean)', 'Levoit', 'Crane'],
          },
          {
            id: 'monitors',
            name: 'Baby monitors',
            qty: '2',
            options: [
              "Two Nanit Pro cameras on one app (home and the nanny's house)",
              'Miku or Cubo Ai',
              'Infant Optics DXR-8 Pro (no wifi, home only)',
            ],
          },
        ],
        goodToKnow:
          'Babies sleep on a firm, flat, bare surface, so please skip weighted sleep sacks, pillows, positioners, bumpers and loungers.',
      },
      {
        id: 'diapering',
        title: 'Diapering',
        items: [
          {
            id: 'newborn-cloth',
            name: 'Newborn cloth diapers: prefolds + covers',
            qty: '24 + 4',
            options: [
              'Green Mountain Diapers organic Cloth-eez',
              'Esembly organic system',
              'Thirsties newborn',
            ],
            make: 'Flat diapers hemmed from organic birdseye cotton',
          },
          {
            id: 'onesize-cloth',
            name: 'One-size or sized-up cloth diapers',
            qty: '18–24 + 6 covers',
            options: ['GroVia', 'Esembly', 'Sloomb fitteds'],
            make: 'Fitted diapers from a free pattern in hemp and cotton',
          },
          {
            id: 'wool-covers',
            name: 'Wool diaper covers (plastic-free)',
            qty: '3–4',
            options: ['Disana', 'Sloomb'],
            make: 'Upcycled wool sweater "soakers"',
          },
          {
            id: 'wet-bags',
            name: 'Wet bags, clean and dirty',
            qty: '4 small, 2 large',
            options: ['Planet Wise', 'Esembly', 'Thirsties'],
            make: 'Handmade wet bags from Etsy',
          },
          {
            id: 'disposables',
            name: 'Disposable diapers for outings',
            options: ['Kudos (cotton liner)', 'Eco by Naty', 'Dyper'],
          },
          {
            id: 'cloth-wipes',
            name: 'Cloth wipes',
            qty: '48–60',
            options: ['Esembly', 'Thirsties'],
            make: 'Flannel squares, the easiest first sewing project',
          },
          {
            id: 'compostable-wipes',
            name: 'Compostable wipes',
            options: ['WaterWipes', 'Eco by Naty', 'Coterie'],
          },
          {
            id: 'sensitive-wipes',
            name: 'Sensitive-skin wipes',
            options: ['Huggies Natural Care Sensitive', 'Pampers Sensitive'],
          },
          {
            id: 'diaper-balm',
            name: 'Diaper balm',
            qty: '2–3 to test',
            options: [
              'Earth Mama Organic Diaper Balm',
              'Weleda Calendula Diaper Care',
              'Badger Zinc Oxide',
            ],
            make: 'Zinc and shea balm (no essential oils)',
          },
          {
            id: 'portable-pad',
            name: 'Portable changing pads',
            qty: '2',
            options: [
              'Wool puddle pad + organic cover',
              'Itzy Ritzy changing pad',
              'Skip Hop Pronto',
            ],
            make: 'Quilted cotton pad over a wool puddle pad',
          },
          {
            id: 'home-changing-pad',
            name: 'Home changing pad + covers',
            qty: '1 + 3',
            options: [
              'Naturepedic organic contoured pad',
              'Keekaroo Peanut (wipe clean, no cover needed)',
            ],
            make: 'Organic cotton or bamboo terry covers',
          },
          {
            id: 'wipe-warmer',
            name: 'Wipe warmer',
            qty: 'optional',
            one: true,
            options: ['Prince Lionheart', 'Munchkin'],
          },
        ],
        goodToKnow:
          "We're mostly cloth diapering. Most covers and wet bags use PUL, a plastic laminate; wool covers are the main plastic-free option.",
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
            options: [
              'Stokke Flexi Bath with newborn support',
              'Frida Baby 4-in-1',
              'Angelcare mesh bath support',
            ],
          },
          {
            id: 'cleanser',
            name: 'Gentle or no-rinse cleanser',
            options: [
              'Medline Remedy Essentials no-rinse foam',
              'Earth Mama Calendula Baby Wash',
              "Dr. Bronner's unscented (diluted)",
            ],
            make: 'Oat bath sachets in muslin',
          },
          {
            id: 'ointment',
            name: 'Ointment',
            options: [
              'Tubby Todd All Over Ointment',
              'Badger Baby Balm (unscented)',
              'Weleda Calendula baby cream',
            ],
            make: 'Calendula oil balm',
          },
          {
            id: 'hooded-towels',
            name: 'Hooded towels',
            qty: '3',
            options: [
              "Burt's Bees Baby organic",
              'Kyte Baby bamboo',
              'Turkish cotton hooded towels',
            ],
            make: 'Bath towel with a washcloth hood',
          },
          {
            id: 'washcloths',
            name: 'Washcloths',
            qty: '10',
            options: ['Organic cotton washcloth pack', 'Bamboo washcloth pack'],
            make: 'Flannel or terry squares',
          },
          {
            id: 'grooming',
            name: 'Comb, brush & scrubby',
            options: [
              'Frida Baby DermaFrida FlakeFixer',
              'Redecker goat-hair baby brush',
              'Wooden wide-tooth comb',
            ],
          },
        ],
        goodToKnow:
          'Fragrance-free everything, please: no essential oils near baby. Newborn skin (especially melanin-rich skin) runs dry, so ointments get used daily.',
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
              "Dr. Brown's Options+ (plastic)",
            ],
          },
          {
            id: 'formula',
            name: 'Formula, small cans to test',
            options: [
              'Kendamil Organic (UK-made, FDA-approved, palm oil free)',
              'Bobbie Organic (US-made, European-style)',
              'Kabrita (goat milk, FDA-approved)',
            ],
            restriction: 'Never homemade.',
          },
          {
            id: 'bottle-washer',
            name: 'Bottle washer or dryer',
            qty: '1',
            one: true,
            options: [
              'Baby Brezza Bottle Washer Pro (washes, sterilizes, dries)',
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
              'Redecker natural-bristle bottle brush',
              'Full Circle bamboo brush',
              'Small nipple and straw brushes',
            ],
          },
          {
            id: 'drying-rack',
            name: 'Drying rack',
            qty: '1',
            one: true,
            options: ['Bamboo or stainless dish rack'],
          },
          {
            id: 'nursing-pillows',
            name: 'Nursing pillows + covers',
            qty: '2 + 3',
            options: [
              'My Brest Friend (firm, good for petite torsos)',
              'Boppy with organic cover',
              'Frida Mom adjustable',
            ],
            make: 'Covers sewn from organic jersey',
          },
          {
            id: 'burp-cloths',
            name: 'Burp cloths',
            qty: '10–12',
            options: [
              'Organic cotton prefolds (double as diapers)',
              'aden + anais muslin',
              "Burt's Bees Baby",
            ],
            make: 'Flannel and terry burp cloths',
          },
          {
            id: 'cloth-bibs',
            name: 'Cloth bibs',
            qty: '6',
            options: ["Organic cotton bandana bibs (Kyte, Burt's Bees)"],
            make: 'Easy-sew bandana bibs',
          },
          {
            id: 'silicone-bibs',
            name: 'Silicone bibs, for solids later',
            qty: '2',
            options: ['Bumkins', 'ezpz', 'Haakaa'],
          },
          {
            id: 'pacifiers',
            name: 'Pacifiers + clips',
            qty: '2 + 3',
            options: [
              'Natursutten or Hevea natural rubber pacifiers',
              'Wooden bead pacifier clips',
            ],
            make: 'Etsy wooden clips (under 7 inches)',
          },
        ],
        goodToKnow:
          'For formula, Kendamil and Bobbie are FDA-approved and sold at natural grocers and baby shops. Please skip imported HiPP or Holle. Nursing pillows are for awake, supervised time only.',
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
            options: [
              'Little Remedies saline spray',
              'Boogie Wipes',
              'Frida Baby saline wipes',
            ],
          },
          {
            id: 'nose-aspirator',
            name: 'Booger sucker',
            options: ['NoseFrida', 'Oogiebear scoop'],
          },
          {
            id: 'thermometer',
            name: 'Thermometer',
            qty: '1',
            one: true,
            options: ['Braun rectal digital', 'Frida Baby rectal digital'],
          },
          {
            id: 'nail-care',
            name: 'Nail care',
            options: ['Glass baby nail file', 'Frida Baby NailFrida'],
          },
          {
            id: 'vitamin-d',
            name: 'Vitamin D drops',
            options: ["Carlson Baby's D Drops", "Mommy's Bliss"],
          },
        ],
        goodToKnow:
          'No essential oils, camphor or menthol rubs for newborns, please.',
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
              'Kyte Baby bamboo',
              'Hanna Andersson',
            ],
          },
          {
            id: 'kimono-tops',
            name: 'Side-snap kimono tops and bodysuits',
            qty: '6 + 6',
            options: ['Colored Organics', 'Pact', 'Monica + Andy'],
            make: 'Kimono top from a free pattern',
          },
          {
            id: 'merino-layer',
            name: 'Merino layers for December',
            qty: '2',
            options: ['Woolino sleeper', 'Ruskovilla or Reima merino'],
            make: 'Hand-knit wool soakers and longies',
          },
          {
            id: 'hats-mitts',
            name: 'Hats and mitts',
            qty: '4 + 4',
            options: ['Organic cotton hat-and-mitt sets'],
            make: 'Hand-knit or sewn',
          },
          {
            id: 'bonnets',
            name: 'Satin- or silk-lined bonnets',
            qty: '3–4',
            options: [
              "Grace Eleyae kids' satin-lined cap",
              'Silk-lined organic cotton bonnets from Etsy',
              'Mulberry silk baby bonnets',
            ],
            make: 'Silk-lined cotton bonnet',
          },
          {
            id: 'silk-sheet',
            name: 'Hair-friendly bassinet sheet',
            qty: '1–2',
            options: ['Mulberry silk or satin fitted bassinet sheet'],
            make: 'Sewn fitted sheet in silk charmeuse',
          },
        ],
        goodToKnow:
          'Bonnets are for awake time and outings only; a snug silk fitted sheet protects hair overnight instead. No puffy snowsuits: they aren’t safe in the car seat.',
      },
      {
        id: 'home',
        title: 'Home & organization',
        items: [
          {
            id: 'caddies',
            name: 'Caddies',
            qty: '2 bath, 2 car, 1 kitchen, 1 living room',
            options: [
              'Washable cotton rope baskets',
              'Canvas caddies',
              'Enamel or stainless bath bins',
            ],
            make: 'Sewn canvas caddies',
          },
          {
            id: 'splat-blankets',
            name: 'Water-resistant play and eating blankets',
            qty: '2–3',
            options: [
              'Wool puddle pads',
              'Laminated cotton splat mats',
              'Linen quick-dry blankets',
            ],
            make: 'Felted wool blanket',
          },
          {
            id: 'play-mat',
            name: 'Organic play mat',
            qty: '1',
            one: true,
            options: ['Lorena Canals washable cotton rug', 'Lovevery play gym'],
            make: 'Quilted cotton floor mat',
          },
          {
            id: 'nursing-station',
            name: 'Nursing station basket',
            options: [
              'Basket with a straw water bottle, snacks, burp cloths, nipple butter and a charger',
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
              'Bravado Body Silk Seamless',
              'Boob Design organic cotton',
            ],
            note: 'Ask Gabriel for sizing.',
          },
          {
            id: 'nursing-wear',
            name: 'Everyday nursing wear',
            qty: '5–10',
            options: [
              'Hatch',
              'Kindred Bravely',
              'Seraphine',
              'Boob Design',
              'Nom Maternity',
            ],
            make: 'Button-front linen dresses or wrap dresses',
          },
          {
            id: 'nursing-cover',
            name: 'Nursing cover or cape',
            qty: '1–2',
            options: ['Udder Covers', 'Organic cotton poncho'],
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
            options: ['Spectra S1 or S2', 'Haakaa silicone collector'],
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
              'Halo SleepSack wearable blanket (organic cotton)',
              'Kyte Baby bamboo sleep bag',
              'Woolino 4-season merino',
            ],
          },
          {
            id: 'crib',
            name: 'Crib',
            qty: '1',
            one: true,
            options: [
              'Babyletto Hudson or Lolly (Greenguard Gold)',
              'Oeuf or another solid-wood crib',
            ],
            restriction: 'Buy only: must meet the federal crib standard.',
          },
          {
            id: 'crib-mattress',
            name: 'Organic crib mattress',
            qty: '1',
            one: true,
            options: ['Naturepedic', 'Avocado Green', 'Nook'],
          },
          {
            id: 'crib-sheets',
            name: 'Crib sheets',
            qty: '3–4',
            options: [
              "Burt's Bees Baby organic",
              'Kyte Baby',
              'Mulberry silk fitted sheet (for hair)',
            ],
            make: 'Sewn fitted sheet',
          },
        ],
        goodToKnow:
          'Nothing goes in the crib for sleep: no bumpers, pillows or loose blankets.',
      },
      {
        id: 'later-outings',
        title: 'Carrying & outings',
        items: [
          {
            id: 'bigger-carrier',
            name: 'Bigger soft carrier',
            qty: '1–2',
            options: [
              'Ergobaby Omni Breeze',
              'Baby Tula Explore',
              'Beco Gemini',
            ],
            make: 'Linen ring sling',
          },
          {
            id: 'stroller-weather',
            name: 'Stroller weather gear',
            options: [
              'Merino stroller footmuff',
              'Breathable muslin sun shade (clips open on the sides)',
            ],
            make: 'Wool stroller blanket',
          },
          {
            id: 'sun-hats',
            name: 'Sun hats',
            qty: '2',
            options: ['Organic cotton wide-brim hats with a chin strap'],
            make: 'Sewn from a free bucket hat pattern',
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
            options: ['Lovevery The Play Gym', 'Wooden A-frame gym from Etsy'],
            make: 'Wooden A-frame with crocheted hanging toys',
          },
          {
            id: 'floor-mirror',
            name: 'Floor mirror',
            qty: '1',
            one: true,
            options: [
              'Shatterproof baby floor mirror (Lovevery, or wood-framed from Etsy)',
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
            ],
            make: 'Black-and-white cards printed on cardstock',
          },
          {
            id: 'rattles',
            name: 'Rattles and grasping toys',
            qty: '3–4',
            options: [
              "Haba or Grimm's wooden rattles",
              'Crocheted organic cotton rattles from Etsy',
            ],
            make: 'Crocheted cotton rattle, firmly stitched, no buttons',
          },
          {
            id: 'teethers',
            name: 'Teethers',
            qty: '3–4',
            options: [
              'Sophie la girafe (natural rubber)',
              'Natursutten natural rubber teether',
              'Untreated maple teething ring',
            ],
          },
          {
            id: 'bouncer',
            name: 'Bouncer for supervised awake time',
            qty: '1',
            one: true,
            options: [
              'BabyBjörn Bouncer Bliss (organic cotton option)',
              'Nuna Leaf',
            ],
          },
          {
            id: 'tag-blanket',
            name: 'Tag blanket',
            qty: '1–2',
            options: ['Organic tag blanket from Etsy'],
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
            name: 'High chair',
            qty: '1',
            one: true,
            options: [
              'Stokke Tripp Trapp with baby set',
              'Abiie Beyond Junior',
              'IKEA Antilop (budget, easy to clean)',
            ],
          },
          {
            id: 'spoons-cup',
            name: 'First spoons and open cup',
            options: [
              'Avanchy bamboo and silicone spoons',
              'ezpz Tiny Cup',
              'Haakaa silicone spoon',
            ],
            make: 'Hand-carved wooden spoons from Etsy',
          },
          {
            id: 'food-prep',
            name: 'Baby food prep',
            qty: '1',
            one: true,
            options: [
              'Beaba Babycook',
              'Blender with glass jars or silicone freezer trays',
            ],
          },
          {
            id: 'milk-storage',
            name: 'Milk storage',
            options: [
              'Glass breast milk bottles',
              'Haakaa silicone freezer tray',
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
              "Burt's Bees Baby",
              'Kyte Baby',
              'Hanna Andersson',
              'Pact',
            ],
            make: 'Hand-knit wool longies',
          },
          {
            id: 'next-bonnets',
            name: 'Next-size bonnets',
            qty: '2–3',
            options: [
              "Grace Eleyae kids' satin-lined cap",
              'Silk-lined bonnets from Etsy',
            ],
            make: 'Silk-lined cotton bonnet',
          },
          {
            id: 'hair-care',
            name: 'Hair care as curls grow',
            options: [
              'Wide-tooth wooden comb',
              'Redecker goat-hair brush',
              'Unscented jojoba oil',
            ],
            make: 'Whipped shea and jojoba hair butter',
          },
          {
            id: 'wool-sweaters',
            name: 'Wool sweaters and booties for winter',
            qty: '2 + 2',
            options: ['Ruskovilla or Reima merino', 'Etsy hand-knits'],
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
              'Insulated lunch bag',
            ],
          },
          {
            id: 'work-tops',
            name: 'Work-friendly nursing tops',
            qty: '3–4',
            options: ['Hatch', 'Seraphine', 'Button-front linen shirts'],
          },
        ],
      },
    ],
  },
]

export const help: HelpItem[] = [
  {
    id: 'lactation',
    name: 'Lactation consultant visit',
    description: 'An IBCLC who comes to the house in our first week home.',
    link: {
      shop: "The Mama 'Hood gift card",
      href: 'https://www.themamahood.com/',
    },
  },
  {
    id: 'doula',
    name: 'Postpartum doula hours',
    description: 'Overnight help, or a few daytime hours so Micala can rest.',
  },
  {
    id: 'freezer-meals',
    name: 'Freezer meals',
    description:
      'A meal we can reheat on a tired night. Label it with the date and reheating directions.',
    goal: '10–14 meals',
  },
  {
    id: 'meal-drop',
    name: 'Bring a meal after we’re home',
    description:
      'A warm dinner dropped at the door in the first few weeks. We’ll text a schedule to everyone who signs up.',
  },
  {
    id: 'handmade-help',
    name: 'Sew or knit something',
    description:
      'Many items above have a handmade option. Pledge here if you want to make something not on the list.',
    link: {
      shop: 'LambShoppe (Denver yarn)',
      href: 'https://www.thelambshoppe.com/',
    },
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
