// How-tos for the registry's "Make it" options, adapted from Micala's Recipe Book.
// Kept to making instructions and safety-while-making notes.

export interface Tutorial {
  id: string
  title: string
  group: 'sew' | 'balm' | 'extra'
  yields?: string
  steps: string[]
  safety?: string
  /** Registry item ids this makes. */
  makes: string[]
}

export const tutorialGroups: Record<
  Tutorial['group'],
  { title: string; intro: string }
> = {
  sew: {
    title: 'Sewing and no-sew',
    intro:
      'Pre-wash all fabric before cutting. Organic cotton, linen, wool and silk are the family’s favorites.',
  },
  balm: {
    title: 'Balms and body care',
    intro:
      'Use food-grade ingredients only and no essential oils or fragrance. Melt in a double boiler you keep for crafts, pour into glass jars, and label each jar with the date.',
  },
  extra: {
    title: 'Also lovely to make',
    intro: 'Not on the registry, but always welcome.',
  },
}

export const tutorials: Tutorial[] = [
  {
    id: 'no-sew-wrap',
    title: 'No-sew stretchy wrap',
    group: 'sew',
    yields: 'Two wraps',
    steps: [
      'Buy 5.5 yards of 100% cotton jersey, 60 inches wide.',
      'Cut it lengthwise into two strips about 24 inches wide.',
      'That’s it: jersey edges curl but don’t fray, so there’s no hemming.',
    ],
    makes: ['stretchy-wraps'],
  },
  {
    id: 'cloth-wipes',
    title: 'Cloth wipes and washcloths',
    group: 'sew',
    steps: [
      'Cut 8×8-inch squares of organic cotton flannel (or terry for washcloths), two per wipe.',
      'Sew right sides together with a ¼-inch seam, leaving a 2-inch gap.',
      'Turn right side out and topstitch all the way around to close the gap.',
    ],
    makes: ['cloth-wipes', 'washcloths'],
  },
  {
    id: 'burp-cloths',
    title: 'Burp cloths',
    group: 'sew',
    steps: [
      'Cut one 10×20-inch piece of cotton flannel and one of cotton terry.',
      'Sew, turn and topstitch the same way as the cloth wipes.',
      'Fastest version: organic prefold diapers work as burp cloths as is.',
    ],
    makes: ['burp-cloths'],
  },
  {
    id: 'fitted-sheet',
    title: 'Fitted bassinet or crib sheet',
    group: 'sew',
    steps: [
      'Ask Gabriel for the mattress length, width and depth.',
      'Cut fabric to (length + 2× depth + 3 in) by (width + 2× depth + 3 in).',
      'Cut a square from each corner equal to the depth + 1.5 in, then sew the corners.',
      'Hem a casing around the edge and run ¼-inch elastic through it.',
    ],
    safety:
      'The sheet must pull tight on the mattress with no slack. If it slides or bunches, please don’t gift it.',
    makes: ['bassinet-sheets', 'crib-sheets'],
  },
  {
    id: 'muslin-swaddles',
    title: 'Muslin swaddle blankets',
    group: 'sew',
    steps: [
      'Cut 47-inch squares of organic cotton double gauze.',
      'Roll-hem all four edges.',
    ],
    makes: ['muslin-swaddles'],
  },
  {
    id: 'hooded-towel',
    title: 'Hooded towel',
    group: 'sew',
    steps: [
      'Fold a washcloth corner to corner into a triangle.',
      'Pin it to one corner of a bath towel.',
      'Stitch along the two outer edges.',
    ],
    makes: ['hooded-towels'],
  },
  {
    id: 'silk-bonnet',
    title: 'Silk-lined bonnet',
    group: 'sew',
    steps: [
      'Find a free baby bonnet pattern (search “free baby bonnet pattern”).',
      'Cut one outer from organic cotton and one lining from silk charmeuse or habotai.',
      'Sew each into the bonnet shape, place right sides together, and stitch around the face edge.',
      'Turn and topstitch.',
    ],
    safety: 'Use soft cotton ties no longer than needed to tie under the chin.',
    makes: ['bonnets', 'next-bonnets'],
  },
  {
    id: 'nursing-cover',
    title: 'Nursing cover',
    group: 'sew',
    steps: [
      'Hem a 36×48-inch piece of muslin.',
      'Add a 24-inch neck strap with two D-rings to one long edge.',
      'Sew a strip of boning across the top edge so it holds open.',
    ],
    makes: ['nursing-cover'],
  },
  {
    id: 'wool-soakers',
    title: 'Wool covers from a thrifted sweater',
    group: 'sew',
    steps: [
      'Start with a 100% wool sweater: the sleeves become leggings and the body becomes a soaker.',
      'Search “upcycled sweater soaker pattern” for free patterns.',
      'Lanolize when done: dissolve a pea-sized bit of pure lanolin in hot water with a drop of wool wash, add lukewarm water, soak 15 minutes, then press dry in a towel.',
    ],
    makes: ['wool-covers'],
  },
  {
    id: 'canvas-caddies',
    title: 'Washable canvas caddies',
    group: 'sew',
    steps: [
      'Sew a canvas tote and box the bottom corners 3 inches.',
      'Add inner pockets from a second layer of canvas.',
    ],
    makes: ['caddies'],
  },
  {
    id: 'calendula-oil',
    title: 'Calendula-infused oil',
    group: 'balm',
    yields: 'The base for the balms below',
    steps: [
      'Fill a jar halfway with dried calendula flowers and cover with olive oil by 1 inch.',
      'Warm in a double boiler on the lowest heat for 2–3 hours, or leave in a sunny window for 4 weeks.',
      'Strain through muslin into a clean jar. Keeps 6–12 months.',
    ],
    makes: ['ointment'],
  },
  {
    id: 'nipple-butter',
    title: 'Lanolin-free nipple butter',
    group: 'balm',
    yields: 'Two 2-oz jars; keeps 3 months',
    steps: [
      '2 tbsp unrefined shea butter, 1 tbsp cocoa butter, 1 tbsp calendula-infused or olive oil, and 1 tsp beeswax pellets (optional, for a firmer balm).',
      'Melt gently in a double boiler and stir.',
      'Pour into small glass jars and cool uncovered.',
    ],
    makes: ['nipple-care'],
  },
  {
    id: 'diaper-balm',
    title: 'Gentle zinc diaper balm',
    group: 'balm',
    yields: 'Two 2-oz jars',
    steps: [
      '3 tbsp shea butter, 2 tbsp calendula oil, 1 tbsp beeswax and 1.5 tbsp non-nano zinc oxide.',
      'Melt the shea, oil and beeswax, then remove from heat.',
      'Whisk in the zinc oxide and pour into jars.',
    ],
    safety:
      'Wear a mask while measuring zinc oxide so you don’t breathe the powder.',
    makes: ['diaper-balm'],
  },
  {
    id: 'hair-butter',
    title: 'Whipped shea and jojoba hair butter',
    group: 'balm',
    steps: [
      'Melt 2 tbsp unrefined shea butter and stir in 1 tbsp jojoba oil.',
      'Cool until just firm, then whip with a fork until fluffy.',
      'Spoon into a small glass jar.',
    ],
    makes: ['hair-care'],
  },
  {
    id: 'oat-sachets',
    title: 'Oat bath sachets',
    group: 'balm',
    steps: [
      'Tie ¼ cup plain rolled oats in a small muslin square.',
      'Make a set of 8–10 and pack them in a jar.',
    ],
    makes: ['cleanser'],
  },
  {
    id: 'rice-heat-pack',
    title: 'Rice heat pack for Micala',
    group: 'extra',
    steps: [
      'Sew a 6×10-inch cotton pouch (or use a clean cotton sock).',
      'Fill with 2–3 cups uncooked rice or flaxseed.',
      'Stitch or knot it closed.',
    ],
    makes: [],
  },
]

/** item id → tutorial id, for "How to make it" links on the registry. */
export const tutorialForItem: Record<string, string> = Object.fromEntries(
  tutorials.flatMap(t => t.makes.map(itemId => [itemId, t.id])),
)
