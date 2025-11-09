const baseCameras = [
    // 🌎 North America
    { name: "Grizzly Cam - Yellowstone", lat: 44.6, lng: -110.5, description: "Monitors grizzly movement near river corridors in Yellowstone National Park." },
    { name: "Eagle Eye - Yosemite", lat: 37.7, lng: -119.6, description: "High cliff vantage tracking raptors and alpine wildlife across Yosemite Valley." },
    { name: "Moose Patrol - Banff", lat: 51.2, lng: -115.5, description: "Watches moose browsing areas and crossings in Banff National Park." },
    { name: "Canyon Watch - Arizona", lat: 36.1, lng: -112.1, description: "Overlooks desert canyons to observe crepuscular activity and migration paths." },
    { name: "Polar Scout - Alaska", lat: 64.2, lng: -149.5, description: "Tracks northern predators and caribou routes across Alaskan tundra." },
    { name: "Gator Vision - Everglades", lat: 25.3, lng: -80.9, description: "Monitors alligator and wading bird behavior in the Everglades marshlands." },
    { name: "Rocky Ranger - Colorado", lat: 39.7, lng: -105.7, description: "Covers subalpine meadows and elk corridors along the Front Range." },
    { name: "Volcano Cam - Hawaii", lat: 19.6, lng: -155.5, description: "Coastal forest edge site observing seabirds and volcanic landscapes." },
    { name: "Falls Cam - Niagara", lat: 43.08, lng: -79.08, description: "Monitors riverine birds and shoreline mammals near the Niagara corridor." },
    { name: "Desert Tracker - Baja", lat: 30.5, lng: -115.9, description: "Desert wash vantage capturing nocturnal species in Baja California." },

    // 🇧🇷 South America
    { name: "Jaguar Eye - Amazon", lat: -3.4, lng: -62.2, description: "Overlooks riverbanks and game trails favored by jaguar in the Amazon." },
    { name: "Toucan Tower - Manaus", lat: -3.1, lng: -60.0, description: "Canopy-level view for toucans and arboreal fauna near Manaus." },
    { name: "Llama Lens - Andes", lat: -13.5, lng: -71.9, description: "High Andean grassland watchpoint for camelids and condors." },
    { name: "Sloth Cam - Costa Rica", lat: 9.9, lng: -84.0, description: "Monitors rainforest edges where sloths, monkeys, and birds congregate." },
    { name: "Piranha Patrol - Brazil", lat: -2.1, lng: -54.7, description: "Observes floodplain lagoons and aquatic activity in northern Brazil." },
    { name: "Condor Watch - Chile", lat: -33.5, lng: -70.7, description: "Ridge camera tracking condor flight paths over Chilean valleys." },
    { name: "Penguin Port - Argentina", lat: -54.8, lng: -68.3, description: "Coastal site capturing penguin colonies and seal haul-outs in Patagonia." },
    { name: "Rainforest Ranger - Peru", lat: -6.2, lng: -75.5, description: "Understory view of Amazonian wildlife along oxbow lakes in Peru." },
    { name: "Cacao Cam - Colombia", lat: 5.5, lng: -74.5, description: "Agroforestry mosaic monitoring pollinators and small mammals in Colombia." },
    { name: "Beach Spy - Rio", lat: -22.9, lng: -43.2, description: "Urban–coastal interface observing shorebirds and marine life near Rio." },

    // 🌍 Europe
    { name: "Fox Finder - London", lat: 51.5, lng: -0.1, description: "Urban green corridor cam for foxes, bats, and hedgehogs around London." },
    { name: "Wolf Watch - Berlin", lat: 52.5, lng: 13.4, description: "Tracks dispersing wolves and deer across Brandenburg woodlands." },
    { name: "Owl Tower - Paris", lat: 48.8, lng: 2.3, description: "Monitors urban raptors and parkland passerines in the Paris region." },
    { name: "Hedgehog Hub - Brussels", lat: 50.8, lng: 4.3, description: "Backyard biodiversity node observing hedgehogs and songbirds in Brussels." },
    { name: "Deer Vision - Oslo", lat: 59.9, lng: 10.7, description: "Forest edge view for roe deer and moose near Oslo fjordlands." },
    { name: "Bear Tracker - Helsinki", lat: 60.1, lng: 24.9, description: "Boreal forest cam tracking brown bears and lynx around Helsinki region." },
    { name: "Boar Cam - Warsaw", lat: 52.2, lng: 21.0, description: "Monitors wild boar movement along suburban belts of Warsaw." },
    { name: "Lynx Lens - Zurich", lat: 47.3, lng: 8.5, description: "Alpine foothill camera for lynx and chamois near Zurich." },
    { name: "Falcon Feed - Madrid", lat: 40.4, lng: -3.7, description: "Rooftop nesting sites and urban falcons across Madrid." },
    { name: "Goat Guard - Athens", lat: 37.9, lng: 23.7, description: "Rocky scrub slopes monitoring goats and raptors near Athens." },

    // 🌍 Africa
    { name: "Lion Lookout - Serengeti", lat: -2.3, lng: 34.8, description: "Open plains vantage surveying lion prides and grazers in the Serengeti." },
    { name: "Elephant Eye - Botswana", lat: -19.4, lng: 23.8, description: "Waterhole focus tracking elephant herds in the Okavango region." },
    { name: "Hippo Cam - Nile Delta", lat: 30.8, lng: 31.0, description: "River channel site capturing hippos and wetland birds in the delta." },
    { name: "Cheetah Chase - Kenya", lat: -1.3, lng: 36.8, description: "Grassland cam following cheetah movement on Kenyan plains." },
    { name: "Rhino Ranger - South Africa", lat: -24.0, lng: 31.5, description: "Monitors rhino territories and patrol routes in protected reserves." },
    { name: "Meerkat Monitor - Kalahari", lat: -25.0, lng: 22.0, description: "Arid dune field cam watching meerkat colonies in the Kalahari." },
    { name: "Flamingo Feed - Tanzania", lat: -3.4, lng: 35.8, description: "Shallow soda lakes vantage for flamingo flocks and waders." },
    { name: "Croc Watch - Congo", lat: -1.6, lng: 15.8, description: "Riverbank site tracking crocodiles and forest fauna in the Congo basin." },
    { name: "Savanna Sentinel - Nigeria", lat: 9.0, lng: 8.7, description: "Savanna–woodland edge observing antelope and primates in Nigeria." },
    { name: "Dune Cam - Namibia", lat: -23.0, lng: 15.0, description: "Namib dune ridge camera capturing fog desert wildlife patterns." },

    // 🌏 Asia
    { name: "Tiger Trail - India", lat: 22.6, lng: 78.9, description: "Forest corridor cam along tiger routes and waterholes in India." },
    { name: "Panda Point - China", lat: 31.2, lng: 103.8, description: "Bamboo forest edge observing pandas and pheasants in Sichuan." },
    { name: "Snow Leopard Lookout - Nepal", lat: 28.3, lng: 84.1, description: "High alpine scree slopes tracking elusive snow leopard activity." },
    { name: "Yak Yard - Tibet", lat: 31.4, lng: 89.5, description: "Plateau pastures camera following yak herds and steppe wildlife." },
    { name: "Crane Cam - Japan", lat: 43.1, lng: 141.3, description: "Wetland fields vantage for cranes and wintering waterfowl in Hokkaido." },
    { name: "Komodo Cam - Indonesia", lat: -8.5, lng: 119.5, description: "Island scrubland camera observing monitor lizards and deer." },
    { name: "Monkey Mountain - Thailand", lat: 13.7, lng: 100.5, description: "Hill forest view tracking macaques and hornbills in Thailand." },
    { name: "Elephant Garden - Sri Lanka", lat: 7.8, lng: 80.7, description: "Forest–tea interface where elephants traverse between habitats." },
    { name: "Desert Falcon - Saudi Arabia", lat: 24.7, lng: 46.7, description: "Desert plateau vantage for falcons and nocturnal desert fauna." },
    { name: "Red Panda Post - Bhutan", lat: 27.5, lng: 90.5, description: "Rhododendron forests cam for red pandas and highland birds." },

    // 🏝 Oceania
    { name: "Kangaroo Cam - Outback", lat: -25.0, lng: 133.0, description: "Red desert plains tracking kangaroo mobs and dingo activity." },
    { name: "Koala Korner - Sydney", lat: -33.8, lng: 151.2, description: "Eucalyptus groves monitoring koalas and urban bushland fauna." },
    { name: "Platypus Pond - Tasmania", lat: -42.9, lng: 147.3, description: "Freshwater creek site observing platypus and forest birds." },
    { name: "Shark Scout - Great Barrier Reef", lat: -18.3, lng: 147.7, description: "Reef edge camera for rays, sharks, and sea turtles." },
    { name: "Penguin Point - New Zealand", lat: -45.0, lng: 170.5, description: "South island coastal cliffs with penguins and albatross." },
    { name: "Emu Eye - Perth", lat: -31.9, lng: 115.8, description: "Banksia woodland observing emus and parrots near Perth." },
    { name: "Croc Creek - Darwin", lat: -12.5, lng: 130.8, description: "Tropical creek corridor with crocodiles and wallabies." },
    { name: "Outback Owl - Alice Springs", lat: -23.7, lng: 133.9, description: "Desert scrub watching owls and nightjars around Alice Springs." },
    { name: "Rainforest Rover - Cairns", lat: -16.9, lng: 145.7, description: "Wet tropics rainforest edge for cassowary and fruit-doves." },
    { name: "Seal Spot - Auckland", lat: -36.8, lng: 174.7, description: "Harbor rocks camera tracking seals and shorebirds near Auckland." },

    // 🌊 Antarctica & Misc
    { name: "Penguin Patrol - McMurdo", lat: -77.8, lng: 166.7, description: "Research station vicinity capturing penguin colonies near McMurdo." },
    { name: "Seal Cam - Ross Sea", lat: -75.0, lng: 175.0, description: "Sea-ice leads camera following seals and seabirds on Ross Sea pack ice." },
    { name: "Iceberg Eye - Antarctic Peninsula", lat: -64.8, lng: -62.9, description: "Peninsula coast tracking drifting icebergs and marine wildlife." },
    { name: "Aurora Watch - South Pole", lat: -90.0, lng: 0.0, description: "Polar night sky and rare wildlife sightings at the South Pole." },
    { name: "Whale Watch - Southern Ocean", lat: -60.0, lng: 40.0, description: "Open ocean transect monitoring whales and seabird flyways." },
    { name: "Polar Puffin - Svalbard", lat: 78.2, lng: 15.6, description: "Arctic archipelago cliffs observing auk colonies and arctic fox." },
    { name: "Arctic Fox Cam - Greenland", lat: 71.7, lng: -42.6, description: "Tundra slope camera for arctic fox and musk ox near Greenland coast." },
    { name: "Snowy Owl Nest - Iceland", lat: 64.9, lng: -18.0, description: "Heathland vantage tracking snowy owls and seabirds in Iceland." },
    { name: "Seal Squad - Barents Sea", lat: 75.0, lng: 40.0, description: "Drift ice edge camera for seals and kittiwakes in the Barents Sea." },
    { name: "Frostbite Feed - North Pole", lat: 89.9, lng: 0.0, description: "Extreme polar monitoring of rare wildlife near the geographic North Pole." },
];

// Ensure every camera has a description field (default empty string)
const cameras = baseCameras.map(c => ({ ...c, description: typeof c.description === 'string' ? c.description : '' }));

export { cameras };
