// Ownership tags for options, keyed by claim key. Sources are in the Nov 2026 research notes
// (brand About pages and news coverage).
export type Tag = 'black-owned' | 'colorado'

export const tagLabels: Record<Tag, string> = {
  'black-owned': 'Black-owned',
  colorado: 'Colorado',
}

export const tags: Record<string, Tag[]> = {
  'diaper-balm/motherlove-diaper-balm': ['colorado'],
  'cleanser/motherlove-baby-all-soap-simply-unscente': ['colorado'],
  'onesize-cloth/kanga-care-rumparooz-obv-one-size-pocket': ['colorado'],
  'newborn-cloth/kanga-care-rumparooz-newborn-cover': ['colorado'],
  'wet-bags/kanga-care-wet-bag': ['colorado'],
  'bigger-carrier/boba-x-linen-carrier': ['colorado'],
  'merino-layer/morrison-outdoors-baby-merino-bodysuit': ['colorado'],
  'nursing-wear/morrison-outdoors-merino-nursing-long-sl': ['colorado'],
  'books-cards/bright-brown-baby-by-andrea-davis-pinkne': [
    'black-owned',
    'colorado',
  ],
  'ointment/proudly-all-over-balm': ['black-owned'],
  'hair-care/proudly-nourishing-hair-body-oil': ['black-owned'],
  'sensitive-wipes/proudly-gentle-touch-baby-wipes': ['black-owned'],
  'hair-care/alaffia-pure-unrefined-shea-butter-unsce': ['black-owned'],
  'kimono-tops/lucy-lue-organics-newborn-kimono-set-wit': ['black-owned'],
  'zip-footies/lucy-lue-organics-waffle-2-way-zip-rompe': ['black-owned'],
  'hats-mitts/lucy-lue-organics-organic-baby-hat': ['black-owned'],
  'bigger-clothes/kaba-baby-zip-up-sleep-play-one-piece': ['black-owned'],
  'muslin-swaddles/ade-ayo-b-g-muslin-swaddle': ['black-owned'],
  'crib-sheets/the-rooted-baby-co-mali-crib-sheet': ['black-owned'],
  'teethers/the-rooted-baby-co-esono-the-elephant-te': ['black-owned'],
  'onesize-cloth/cultured-diapers-the-cultured-diaper': ['black-owned'],
  'diaper-backpacks/wsel-kobe-expandable-diaper-backpack': ['black-owned'],
  'nursing-station/milky-mama-oatmeal-lactation-cookies': ['black-owned'],
  'bonnets/grace-eleyae-kids-satin-lined-cap': ['black-owned'],
  'next-bonnets/grace-eleyae-kids-satin-lined-cap': ['black-owned'],
  'stretchy-wraps/boba-wrap': ['colorado'],
  'bigger-carrier/beco-gemini': ['colorado'],
  'newborn-cloth/thirsties-newborn': ['colorado'],
  'wet-bags/thirsties': ['colorado'],
  'cloth-wipes/thirsties': ['colorado'],
  'onesize-cloth/grovia': ['colorado'],
  'nipple-care/motherlove-nipple-cream': ['colorado'],
  'spoons-cup/ezpz-tiny-cup': ['colorado'],
  'nursing-pillows/boppy-with-organic-cover': ['colorado'],
}
