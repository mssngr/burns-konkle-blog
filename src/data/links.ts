// Where to buy each option, keyed by claim key (see optionKey / handmadeKey in registry.ts).
// Preference order: local Denver shops (see shops.ts) > the maker's own store > small independent
// retailers > Etsy makers. Never Amazon or Walmart; Target only as a last resort.

import productLinks from './product-links.json'

export interface ShopLink {
  shop: string
  href: string
}

const etsy = (q: string): ShopLink => ({
  shop: 'Etsy makers',
  href: `https://www.etsy.com/search?q=${encodeURIComponent(q)}`,
})
const l = (shop: string, href: string): ShopLink => ({ shop, href })

// Small businesses reused across many items
const OCP = (q: string) =>
  l(
    'Organic Cotton Plus (fabric)',
    `https://organiccottonplus.com/search?q=${encodeURIComponent(q)}`,
  )
const TREELOTTA = l('Treelotta (Denver fabric)', 'https://www.treelotta.com/')
const LAMB = l('LambShoppe (Denver yarn)', 'https://www.thelambshoppe.com/')
const BALANCED = l(
  'Balanced Root Apothecary (Denver)',
  'https://www.balancedrootapothecary.com/',
)
const MRH = l(
  'Mountain Rose Herbs (ingredients)',
  'https://mountainroseherbs.com/',
)
const SLING_RINGS = l(
  'SlingRings (certified rings)',
  'https://www.slingrings.com/',
)
const GMD = (q: string) =>
  l(
    'Green Mountain Diapers',
    `https://www.greenmountaindiapers.com/search?q=${encodeURIComponent(q)}`,
  )
const BOOKSHOP = (q: string) =>
  l(
    'Bookshop.org (supports indie bookstores)',
    `https://bookshop.org/search?keywords=${encodeURIComponent(q)}`,
  )

const baseLinks: Record<string, ShopLink[]> = {
  // ----- Carrying & travel -----
  'stretchy-wraps/solly-baby': [l('Solly Baby', 'https://sollybaby.com/')],
  'stretchy-wraps/boba-wrap': [l('Boba', 'https://boba.com/')],
  'stretchy-wraps/handmade': [TREELOTTA, OCP('cotton jersey')],
  'ring-sling/ergobaby-embrace': [l('Ergobaby', 'https://ergobaby.com/')],
  'ring-sling/baby-tula-explore': [l('Baby Tula', 'https://babytula.com/')],
  'ring-sling/handmade': [SLING_RINGS, etsy('linen ring sling')],
  'travel-system/chicco-keyfit-35-cleartex-corso-or-bravo': [
    l('Chicco', 'https://www.chiccousa.com/'),
  ],
  'travel-system/nuna-pipa-mixx-or-trvl': [
    l('Nuna', 'https://nunababy.com/usa/'),
  ],
  'canopy-covers/milk-snob-stretch-cover': [
    l('Milk Snob', 'https://milksnob.com/'),
  ],
  'canopy-covers/organic-muslin-canopy-cover': [
    etsy('organic muslin car seat canopy cover'),
  ],
  'canopy-covers/jj-cole-bundleme-canopy': [
    l('JJ Cole', 'https://www.jjcole.com/'),
  ],
  'canopy-covers/handmade': [etsy('wool car seat canopy cover')],
  'diaper-backpacks/itzy-ritzy-boss-plus': [
    l('Itzy Ritzy', 'https://itzyritzy.com/'),
  ],
  'diaper-backpacks/a-fold-out-changing-station-backpack': [
    etsy('diaper backpack changing station'),
  ],
  'diaper-backpacks/handmade': [etsy('waxed canvas diaper backpack')],

  // ----- Sleep -----
  'wheeled-bassinet/babyletto-origami-mini': [
    l('Babyletto', 'https://babyletto.com/'),
  ],
  'wheeled-bassinet/chicco-close-to-you': [
    l('Chicco', 'https://www.chiccousa.com/'),
  ],
  'wheeled-bassinet/halo-bassinest-swivel': [
    l('HALO', 'https://www.halosleep.com/'),
  ],
  'bassinet-pad/naturepedic-organic-bassinet-pad': [
    l('Naturepedic', 'https://www.naturepedic.com/'),
  ],
  'bassinet-sheets/halo-bassinest-fitted-sheet': [
    l('HALO', 'https://www.halosleep.com/collections/bassinest-fitted-sheets'),
  ],
  'bassinet-sheets/handmade': [TREELOTTA, OCP('flannel')],
  'zip-swaddles/halo-sleepsack-swaddle': [
    l('HALO', 'https://www.halosleep.com/'),
  ],
  'zip-swaddles/love-to-dream-swaddle-up': [
    l('Love to Dream', 'https://lovetodream.com/'),
  ],
  'zip-swaddles/woolino-merino-swaddle': [l('Woolino', 'https://woolino.com/')],
  'muslin-swaddles/aden-anais-organic': [
    l(
      'aden + anais (by HALO)',
      'https://www.halosleep.com/pages/aden-and-anais',
    ),
  ],
  'muslin-swaddles/burt-s-bees-baby': [
    l("Burt's Bees Baby", 'https://www.burtsbeesbaby.com/'),
  ],
  'muslin-swaddles/kyte-baby': [l('Kyte Baby', 'https://kytebaby.com/')],
  'muslin-swaddles/handmade': [OCP('double gauze')],
  'sound-machine/yogasleep-hushh': [l('Yogasleep', 'https://yogasleep.com/')],
  'humidifier/canopy': [l('Canopy', 'https://getcanopy.co/')],
  'humidifier/levoit': [l('Levoit', 'https://levoit.com/')],
  'humidifier/crane': [l('Crane', 'https://www.crane-usa.com/')],
  'monitors/eufy-baby-monitor-c10': [
    l('eufy', 'https://www.eufy.com/products/e6310121?variant=45728177225914'),
  ],
  'monitors/infant-optics-dxr-8-pro': [
    l('Infant Optics', 'https://www.infantoptics.com/product/dxr-8-pro'),
  ],

  // ----- Diapering -----
  'newborn-cloth/green-mountain-diapers-organic-cloth-eez': [
    GMD('cloth-eez prefold'),
  ],
  'newborn-cloth/esembly-organic-system': [
    l('Esembly', 'https://esemblybaby.com/'),
  ],
  'newborn-cloth/thirsties-newborn': [
    l('Thirsties', 'https://www.thirstiesbaby.com/'),
  ],
  'newborn-cloth/handmade': [OCP('birdseye')],
  'onesize-cloth/grovia': [l('GroVia', 'https://www.grovia.com/')],
  'onesize-cloth/esembly': [l('Esembly', 'https://esemblybaby.com/')],
  'onesize-cloth/sloomb-fitteds': [l('Sloomb', 'https://sloomb.com/')],
  'onesize-cloth/handmade': [OCP('hemp')],
  'wool-covers/disana': [GMD('disana')],
  'wool-covers/sloomb': [l('Sloomb', 'https://sloomb.com/')],
  'wool-covers/handmade': [etsy('upcycled wool soaker pattern')],
  'wet-bags/planet-wise': [
    l(
      'Planet Wise (via Best Bottom)',
      'https://bestbottomdiapers.com/collections/planet-wise',
    ),
  ],
  'wet-bags/esembly': [l('Esembly', 'https://esemblybaby.com/')],
  'wet-bags/thirsties': [l('Thirsties', 'https://www.thirstiesbaby.com/')],
  'wet-bags/handmade': [etsy('handmade wet bag cloth diaper')],
  'disposables/kudos': [l('Kudos', 'https://mykudos.com/')],
  'disposables/dyper': [l('Dyper', 'https://dyper.com/')],
  'cloth-wipes/esembly': [l('Esembly', 'https://esemblybaby.com/')],
  'cloth-wipes/thirsties': [l('Thirsties', 'https://www.thirstiesbaby.com/')],
  'cloth-wipes/handmade': [TREELOTTA, OCP('flannel')],
  'compostable-wipes/waterwipes': [
    l('WaterWipes', 'https://www.waterwipes.com/us/en'),
  ],
  'compostable-wipes/eco-by-naty': [l('Eco by Naty', 'https://naty.com/')],
  'compostable-wipes/coterie': [l('Coterie', 'https://www.coterie.com/')],
  'sensitive-wipes/huggies-natural-care-sensitive': [
    l('Huggies', 'https://www.huggies.com/'),
  ],
  'sensitive-wipes/pampers-sensitive': [
    l('Pampers', 'https://www.pampers.com/'),
  ],
  'diaper-balm/earth-mama-organic-diaper-balm': [
    l('Earth Mama', 'https://earthmamaorganics.com/'),
  ],
  'diaper-balm/badger-zinc-oxide': [l('Badger', 'https://www.badgerbalm.com/')],
  'diaper-balm/handmade': [BALANCED, MRH],
  'portable-pad/wool-puddle-pad-organic-cover': [etsy('wool puddle pad')],
  'portable-pad/itzy-ritzy-changing-pad': [
    l('Itzy Ritzy', 'https://itzyritzy.com/'),
  ],
  'portable-pad/skip-hop-pronto': [
    l('Skip Hop', 'https://www.carters.com/b/skiphop'),
  ],
  'portable-pad/handmade': [TREELOTTA, OCP('quilted')],
  'home-changing-pad/naturepedic-organic-contoured-pad': [
    l('Naturepedic', 'https://www.naturepedic.com/'),
  ],
  'home-changing-pad/keekaroo-peanut': [l('Keekaroo', 'https://keekaroo.com/')],
  'home-changing-pad/handmade': [TREELOTTA, OCP('terry')],
  'wipe-warmer/prince-lionheart': [
    l('Prince Lionheart', 'https://princelionheart.com/'),
  ],
  'wipe-warmer/munchkin': [l('Munchkin', 'https://www.munchkin.com/')],

  // ----- Bath, skin & hair -----
  'baby-bath/stokke-flexi-bath-with-newborn-support': [
    l('Stokke', 'https://www.stokke.com/USA/en-us/'),
  ],
  'baby-bath/frida-baby-4-in-1': [l('Frida', 'https://frida.com/')],
  'baby-bath/angelcare-mesh-bath-support': [
    l('Angelcare', 'https://www.angelcarebaby.com/'),
  ],
  'cleanser/medline-remedy-essentials-no-rinse-foam': [
    l('Medline', 'https://athome.medline.com/'),
  ],
  'cleanser/dr-bronner-s-unscented': [
    l("Dr. Bronner's", 'https://www.drbronner.com/'),
  ],
  'cleanser/handmade': [TREELOTTA, OCP('muslin')],
  'ointment/tubby-todd-all-over-ointment': [
    l('Tubby Todd', 'https://tubbytodd.com/'),
  ],
  'ointment/badger-baby-balm': [l('Badger', 'https://www.badgerbalm.com/')],
  'ointment/handmade': [BALANCED, MRH],
  'hooded-towels/burt-s-bees-baby-organic': [
    l("Burt's Bees Baby", 'https://www.burtsbeesbaby.com/'),
  ],
  'hooded-towels/kyte-baby-bamboo': [l('Kyte Baby', 'https://kytebaby.com/')],
  'hooded-towels/turkish-cotton-hooded-towels': [
    etsy('turkish cotton baby hooded towel'),
  ],
  'hooded-towels/handmade': [TREELOTTA, OCP('terry')],
  'washcloths/organic-cotton-washcloth-pack': [
    l("Burt's Bees Baby", 'https://www.burtsbeesbaby.com/'),
  ],
  'washcloths/bamboo-washcloth-pack': [l('Kyte Baby', 'https://kytebaby.com/')],
  'washcloths/handmade': [TREELOTTA, OCP('flannel')],
  'grooming/frida-baby-dermafrida-flakefixer': [
    l('Frida', 'https://frida.com/'),
  ],
  'grooming/redecker-goat-hair-baby-brush': [
    etsy('redecker goat hair baby brush'),
  ],
  'grooming/wooden-wide-tooth-comb': [etsy('wooden wide tooth comb baby')],

  // ----- Feeding -----
  'glass-bottles/philips-avent-natural-glass': [
    l(
      'Philips Avent',
      'https://www.usa.philips.com/c-p/SCD858_01/natural-response-newborn-glass-gift-set',
    ),
  ],
  'glass-bottles/dr-brown-s-options-glass': [
    l("Dr. Brown's", 'https://www.drbrownsbaby.com/'),
  ],
  'glass-bottles/evenflo-classic-glass': [
    l('Evenflo', 'https://www.evenflo.com/'),
  ],
  'other-bottles/pura-kiki-stainless': [
    l('Pura', 'https://purastainless.com/'),
  ],
  'other-bottles/comotomo-silicone': [l('Comotomo', 'https://comotomo.com/')],
  'other-bottles/dr-brown-s-options': [
    l("Dr. Brown's", 'https://www.drbrownsbaby.com/'),
  ],
  'formula/kendamil-organic': [l('Kendamil', 'https://kendamil.com/')],
  'formula/bobbie-organic': [l('Bobbie', 'https://hibobbie.com/')],
  'formula/kabrita': [l('Kabrita', 'https://kabrita.com/')],
  'bottle-washer/baby-brezza-bottle-washer-pro': [
    l('Baby Brezza', 'https://babybrezza.com/'),
  ],
  'bottle-washer/papablic-sterilizer-dryer': [
    l('Papablic', 'https://papablic.com/'),
  ],
  'bottle-soap/dapple-fragrance-free': [l('Dapple', 'https://dapplebaby.com/')],
  'bottle-soap/seventh-generation-free-clear': [
    l('Seventh Generation', 'https://www.seventhgeneration.com/'),
  ],
  'bottle-soap/dr-bronner-s-sal-suds': [
    l("Dr. Bronner's", 'https://www.drbronner.com/'),
  ],
  'brushes/redecker-natural-bristle-bottle-brush': [
    etsy('redecker bottle brush'),
  ],
  'brushes/full-circle-bamboo-brush': [
    l('Full Circle', 'https://fullcirclehome.com/'),
  ],
  'drying-rack/bamboo-or-stainless-dish-rack': [
    etsy('bamboo dish drying rack'),
  ],
  'nursing-pillows/my-brest-friend': [
    l('My Brest Friend', 'https://mybrestfriend.com/'),
  ],
  'nursing-pillows/boppy': [l('Boppy', 'https://www.boppy.com/')],
  'nursing-pillow-covers/boppy-organic-cotton-cover': [
    l('Boppy', 'https://www.boppy.com/'),
  ],
  'nursing-pillow-covers/handmade': [TREELOTTA, OCP('jersey')],
  'burp-cloths/organic-cotton-prefolds': [GMD('prefold')],
  'burp-cloths/aden-anais-muslin': [
    l(
      'aden + anais (by HALO)',
      'https://www.halosleep.com/pages/aden-and-anais',
    ),
  ],
  'burp-cloths/burt-s-bees-baby': [
    l("Burt's Bees Baby", 'https://www.burtsbeesbaby.com/'),
  ],
  'burp-cloths/handmade': [TREELOTTA, OCP('flannel')],
  'cloth-bibs/organic-cotton-bandana-bibs': [
    l('Kyte Baby', 'https://kytebaby.com/'),
    l("Burt's Bees Baby", 'https://www.burtsbeesbaby.com/'),
  ],
  'cloth-bibs/handmade': [TREELOTTA, OCP('jersey')],
  'silicone-bibs/bumkins': [l('Bumkins', 'https://bumkins.com/')],
  'silicone-bibs/haakaa': [l('Haakaa', 'https://haakaausa.com/')],
  'pacifiers/natursutten-or-hevea-natural-rubber-paci': [
    l(
      'Natursutten (via My Blooming Baby)',
      'https://www.mybloomingbaby.com/collections/natursutten',
    ),
    l('Hevea', 'https://heveaplanet.com/'),
  ],
  'pacifier-clips/wooden-bead-pacifier-clips': [
    etsy('wooden bead pacifier clip'),
  ],
  'pacifier-clips/handmade': [etsy('wooden pacifier clip')],

  // ----- Health & comfort -----
  'gas-relief/infants-mylicon': [l('Mylicon', 'https://www.mylicon.com/')],
  'gas-relief/biogaia-protectis-probiotic-drops': [
    l('BioGaia', 'https://www.biogaia.com/'),
  ],
  'gas-relief/frida-baby-windi': [l('Frida', 'https://frida.com/')],
  'congestion/little-remedies-saline-spray': [
    l('Little Remedies', 'https://www.littleremedies.com/'),
  ],
  'congestion/boogie-wipes': [l('Boogie Wipes', 'https://boogiewipes.com/')],
  'nose-aspirator/nosefrida': [l('Frida', 'https://frida.com/')],
  'nose-aspirator/oogiebear-scoop': [l('oogiebear', 'https://oogiebear.com/')],
  'thermometer/frida-baby-rectal-digital': [l('Frida', 'https://frida.com/')],
  'nail-care/glass-baby-nail-file': [etsy('glass baby nail file')],
  'nail-care/frida-baby-nailfrida': [l('Frida', 'https://frida.com/')],
  'vitamin-d/mommy-s-bliss': [l("Mommy's Bliss", 'https://mommysbliss.com/')],

  // ----- Clothing -----
  'zip-footies/burt-s-bees-baby-organic': [
    l("Burt's Bees Baby", 'https://www.burtsbeesbaby.com/'),
  ],
  'zip-footies/kyte-baby-bamboo': [l('Kyte Baby', 'https://kytebaby.com/')],
  'zip-footies/hanna-andersson': [
    l('Hanna Andersson', 'https://www.hannaandersson.com/'),
  ],
  'kimono-tops/colored-organics': [
    l('Colored Organics', 'https://coloredorganics.com/'),
  ],
  'kimono-tops/monica-andy': [
    l('Monica + Andy', 'https://www.monicaandandy.com/'),
  ],
  'kimono-tops/handmade': [TREELOTTA, OCP('interlock')],
  'merino-layer/woolino-sleeper': [l('Woolino', 'https://woolino.com/')],
  'merino-layer/ruskovilla-or-reima-merino': [
    l('Nova Natural', 'https://www.novanatural.com/'),
    l('Reima', 'https://us.reima.com/'),
  ],
  'merino-layer/handmade': [LAMB, etsy('baby wool longies')],
  'hats-mitts/organic-cotton-hat-and-mitt-sets': [
    l('Kyte Baby', 'https://kytebaby.com/'),
    l("Burt's Bees Baby", 'https://www.burtsbeesbaby.com/'),
  ],
  'hats-mitts/handmade': [LAMB, etsy('hand knit baby hat mittens')],
  'bonnets/silk-lined-organic-cotton-bonnets-from-e': [
    etsy('silk lined baby bonnet'),
  ],
  'bonnets/handmade': [etsy('baby bonnet sewing pattern')],

  // ----- Home & organization -----
  'caddies/ikea-uppr-men-basket': [
    l(
      'IKEA',
      'https://www.ikea.com/us/en/p/uppraemen-storage-basket-gray-green-60498563',
    ),
  ],
  'caddies/ikea-risatorp-basket-with-compartments': [
    l(
      'IKEA',
      'https://www.ikea.com/us/en/p/risatorp-basket-with-compartments-white-00527634/',
    ),
  ],
  'caddies/ikea-v-lv-rdad-organizer': [
    l(
      'IKEA VÄLVÅRDAD (via Apartment Therapy)',
      'https://www.apartmenttherapy.com/ikea-valvardad-organizer-37460386',
    ),
  ],
  'caddies/handmade': [TREELOTTA, OCP('canvas')],
  'splat-blankets/wool-puddle-pads': [etsy('wool puddle pad')],
  'splat-blankets/laminated-cotton-splat-mats': [
    etsy('splat mat laminated cotton'),
  ],
  'splat-blankets/linen-quick-dry-blankets': [etsy('linen baby blanket')],
  'splat-blankets/handmade': [etsy('felted wool blanket')],
  'play-mat/lorena-canals-washable-cotton-rug': [
    l('Lorena Canals', 'https://lorenacanals.com/'),
  ],
  'play-mat/lovevery-play-gym': [l('Lovevery', 'https://lovevery.com/')],
  'play-mat/handmade': [TREELOTTA, OCP('quilted')],
  'nursing-station/basket-with-a-straw-water-bottle-snacks-': [
    etsy('nursing caddy basket'),
  ],

  // ----- For Micala -----
  'nursing-bras/kindred-bravely-simply-sublime': [
    l('Kindred Bravely', 'https://www.kindredbravely.com/'),
  ],
  'nursing-bras/bravado-body-silk-seamless': [
    l('Bravado', 'https://www.bravadodesigns.com/'),
  ],
  'nursing-bras/boob-design-organic-cotton': [
    l('Boob Design', 'https://boobdesign.com/'),
  ],
  'nursing-wear/hatch': [l('Hatch', 'https://www.hatchcollection.com/')],
  'nursing-wear/kindred-bravely': [
    l('Kindred Bravely', 'https://www.kindredbravely.com/'),
  ],
  'nursing-wear/seraphine': [
    l('Seraphine (ships from the UK)', 'https://www.next.co.uk/seraphine'),
  ],
  'nursing-wear/boob-design': [l('Boob Design', 'https://boobdesign.com/')],
  'nursing-wear/nom-maternity': [
    l('Nom Maternity', 'https://nommaternity.com/'),
  ],
  'nursing-wear/handmade': [etsy('linen button front nursing dress')],
  'nursing-cover/udder-covers': [
    l('Udder Covers', 'https://www.uddercovers.com/'),
  ],
  'nursing-cover/organic-cotton-poncho': [
    etsy('organic cotton nursing poncho'),
  ],
  'nursing-cover/handmade': [TREELOTTA, OCP('muslin')],
  'nipple-care/earth-mama-organic-nipple-butter': [
    l('Earth Mama', 'https://earthmamaorganics.com/'),
  ],
  'nipple-care/motherlove-nipple-cream': [
    l('Motherlove', 'https://www.motherlove.com/'),
  ],
  'nipple-care/silverette-silver-nursing-cups': [
    l('Silverette', 'https://silveretteusa.com/'),
  ],
  'nipple-care/handmade': [BALANCED, MRH],
  'hydrogel/lansinoh-soothies': [l('Lansinoh', 'https://lansinoh.com/')],
  'hydrogel/medela-hydrogel': [l('Medela', 'https://www.medela.com/en-us')],
  'reusable-pads/bamboobies': [l('Bamboobies', 'https://bamboobies.com/')],
  'reusable-pads/kindred-bravely-organic': [
    l('Kindred Bravely', 'https://www.kindredbravely.com/'),
  ],
  'reusable-pads/lanacare-or-disana-wool': [GMD('wool nursing pads')],
  'reusable-pads/handmade': [TREELOTTA, OCP('flannel')],
  'disposable-pads/lansinoh': [l('Lansinoh', 'https://lansinoh.com/')],
  'disposable-pads/bamboobies-disposable': [
    l('Bamboobies', 'https://bamboobies.com/'),
  ],
  'pump/haakaa-silicone-collector': [l('Haakaa', 'https://haakaausa.com/')],

  // ----- 6 weeks – 6 months -----
  'sleep-sacks/halo-sleepsack-wearable-blanket': [
    l('HALO', 'https://www.halosleep.com/'),
  ],
  'sleep-sacks/kyte-baby-bamboo-sleep-bag': [
    l('Kyte Baby', 'https://kytebaby.com/'),
  ],
  'sleep-sacks/woolino-4-season-merino': [l('Woolino', 'https://woolino.com/')],
  'crib/babyletto-hudson-or-lolly': [l('Babyletto', 'https://babyletto.com/')],
  'crib/oeuf-or-another-solid-wood-crib': [l('Oeuf', 'https://oeufnyc.com/')],
  'crib-mattress/naturepedic': [
    l('Naturepedic', 'https://www.naturepedic.com/'),
  ],
  'crib-mattress/avocado-green': [
    l('Avocado', 'https://www.avocadogreenmattress.com/'),
  ],
  'crib-sheets/burt-s-bees-baby-organic': [
    l("Burt's Bees Baby", 'https://www.burtsbeesbaby.com/'),
  ],
  'crib-sheets/kyte-baby': [l('Kyte Baby', 'https://kytebaby.com/')],
  'crib-sheets/handmade': [TREELOTTA, OCP('flannel')],
  'bigger-carrier/baby-tula-explore': [l('Baby Tula', 'https://babytula.com/')],
  'bigger-carrier/beco-gemini': [l('Beco', 'https://becobabycarrier.com/')],
  'bigger-carrier/handmade': [SLING_RINGS, etsy('linen ring sling')],
  'stroller-weather/merino-stroller-footmuff': [
    etsy('merino wool stroller footmuff'),
  ],
  'stroller-weather/breathable-muslin-sun-shade': [
    etsy('muslin stroller sun shade'),
  ],
  'stroller-weather/handmade': [etsy('wool stroller blanket')],
  'sun-hats/organic-cotton-wide-brim-hats-with-a-chi': [
    etsy('organic cotton baby sun hat chin strap'),
  ],
  'sun-hats/handmade': [etsy('baby bucket hat sewing pattern')],
  'play-gym/lovevery-the-play-gym': [l('Lovevery', 'https://lovevery.com/')],
  'play-gym/wooden-a-frame-gym-from-etsy': [etsy('wooden baby play gym')],
  'play-gym/handmade': [LAMB, etsy('crochet baby gym toys pattern')],
  'floor-mirror/shatterproof-baby-floor-mirror': [
    l('Lovevery', 'https://lovevery.com/'),
    etsy('wooden baby floor mirror'),
  ],
  'books-cards/wee-gallery-art-cards': [
    l('Wee Gallery', 'https://weegallery.com/'),
  ],
  'books-cards/global-babies': [BOOKSHOP('Global Babies')],
  'books-cards/whose-toes-are-those': [BOOKSHOP('Whose Toes Are Those')],
  'books-cards/please-baby-please': [BOOKSHOP('Please Baby Please')],
  'books-cards/handmade': [etsy('high contrast baby cards printable')],
  'rattles/haba-or-grimm-s-wooden-rattles': [
    l('HABA', 'https://www.habausa.com/'),
    l('Bella Luna Toys', 'https://www.bellalunatoys.com/'),
  ],
  'rattles/crocheted-organic-cotton-rattles-from-et': [
    etsy('crochet organic cotton baby rattle'),
  ],
  'rattles/handmade': [LAMB, etsy('crochet baby rattle pattern')],
  'teethers/sophie-la-girafe': [
    l(
      'Calisson Toys (official US store)',
      'https://calisson.toys/collections/sophie-la-girafe',
    ),
  ],
  'teethers/natursutten-natural-rubber-teether': [
    l(
      'Natursutten (via My Blooming Baby)',
      'https://www.mybloomingbaby.com/collections/natursutten',
    ),
  ],
  'teethers/untreated-maple-teething-ring': [etsy('maple teething ring')],
  'bouncer/babybj-rn-bouncer-bliss': [
    l('BabyBjörn', 'https://www.babybjorn.com/'),
  ],
  'tag-blanket/organic-tag-blanket-from-etsy': [etsy('organic tag blanket')],
  'tag-blanket/handmade': [TREELOTTA, OCP('flannel')],
  'next-nipples/matched-to-our-bottles': [
    l('Philips Avent', 'https://www.usa.philips.com/c-m-mo/baby-bottles'),
    l("Dr. Brown's", 'https://www.drbrownsbaby.com/'),
  ],
  'high-chair/stokke-tripp-trapp-with-baby-set': [
    l('Stokke', 'https://www.stokke.com/USA/en-us/'),
  ],
  'high-chair/abiie-beyond-junior': [l('Abiie', 'https://abiie.com/')],
  'high-chair/ikea-antilop': [
    l('IKEA', 'https://www.ikea.com/us/en/search/?q=antilop'),
  ],
  'spoons-cup/avanchy-bamboo-and-silicone-spoons': [
    l('Avanchy', 'https://avanchy.com/'),
  ],
  'spoons-cup/ezpz-tiny-cup': [l('ezpz', 'https://ezpzfun.com/')],
  'spoons-cup/haakaa-silicone-spoon': [l('Haakaa', 'https://haakaausa.com/')],
  'spoons-cup/handmade': [etsy('hand carved wooden baby spoon')],
  'food-prep/beaba-babycook': [l('Beaba', 'https://www.beaba.com/')],
  'food-prep/blender-with-glass-jars-or-silicone-free': [
    l('Beaba', 'https://www.beaba.com/'),
  ],
  'milk-storage/glass-breast-milk-bottles': [
    l('Lansinoh', 'https://lansinoh.com/'),
  ],
  'milk-storage/haakaa-silicone-freezer-tray': [
    l('Haakaa', 'https://haakaausa.com/'),
  ],
  'bigger-clothes/burt-s-bees-baby': [
    l("Burt's Bees Baby", 'https://www.burtsbeesbaby.com/'),
  ],
  'bigger-clothes/kyte-baby': [l('Kyte Baby', 'https://kytebaby.com/')],
  'bigger-clothes/hanna-andersson': [
    l('Hanna Andersson', 'https://www.hannaandersson.com/'),
  ],
  'bigger-clothes/handmade': [LAMB, etsy('hand knit baby longies')],
  'next-bonnets/silk-lined-bonnets-from-etsy': [etsy('silk lined baby bonnet')],
  'next-bonnets/handmade': [etsy('baby bonnet sewing pattern')],
  'hair-care/wide-tooth-wooden-comb': [etsy('wooden wide tooth comb')],
  'hair-care/redecker-goat-hair-brush': [etsy('redecker goat hair baby brush')],
  'hair-care/unscented-jojoba-oil': [BALANCED, MRH],
  'hair-care/handmade': [BALANCED, MRH],
  'wool-sweaters/ruskovilla-or-reima-merino': [
    l('Nova Natural', 'https://www.novanatural.com/'),
    l('Reima', 'https://us.reima.com/'),
  ],
  'wool-sweaters/etsy-hand-knits': [etsy('hand knit wool baby sweater')],
  'wool-sweaters/handmade': [LAMB, etsy('baby sweater knitting pattern')],
  'pumping-bra/kindred-bravely-sublime-hands-free': [
    l('Kindred Bravely', 'https://www.kindredbravely.com/'),
  ],
  'pumping-bra/bravado-clip-and-pump': [
    l('Bravado', 'https://www.bravadodesigns.com/'),
  ],
  'pump-parts/valves-membranes-and-flanges-for-her-pum': [
    l('Spectra', 'https://www.spectrababyusa.com/'),
  ],
  'milk-cooler/medela-or-lansinoh-cooler-with-ice-pack': [
    l('Medela', 'https://www.medela.com/en-us'),
    l('Lansinoh', 'https://lansinoh.com/'),
  ],
  'milk-cooler/insulated-lunch-bag': [etsy('insulated lunch bag')],
  'work-tops/hatch': [l('Hatch', 'https://www.hatchcollection.com/')],
  'work-tops/seraphine': [
    l('Seraphine (ships from the UK)', 'https://www.next.co.uk/seraphine'),
  ],
  'work-tops/button-front-linen-shirts': [
    etsy('linen button front shirt women'),
  ],
}

/** Product-page links (researched Nov 2026) override the base links above. */
export const links: Record<string, ShopLink[]> = {
  ...baseLinks,
  ...productLinks,
}
