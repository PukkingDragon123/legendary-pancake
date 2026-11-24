"""The photographs chosen for each place from the Openverse candidates (place_photos.py search / extra):
place -> [(kind, candidate index, caption, crop focus x, crop focus y)], in the order they appear in the game."""
PICKS = {
    "highlands": [("landmark", 2, "Eilean Donan Castle", 0.5, 0.5), ("landscape", 3, "A waterfall in Glen Coe", 0.5, 0.5), ("life", 3, "A Highland cow", 0.5, 0.45)],
    "kyoto": [("landmark", 4, "The torii gates of Fushimi Inari", 0.5, 0.5), ("landscape", 1, "The bamboo grove of Arashiyama", 0.5, 0.5), ("life", 7, "Gion’s lanes after the rain", 0.5, 0.5)],
    "paris": [("landmark", 0, "The Eiffel Tower", 0.5, 0.45), ("landscape", 0, "Pont Alexandre III over the Seine", 0.5, 0.5), ("life", 0, "A café on a Paris corner", 0.5, 0.5)],
    "venice": [("landmark", 1, "The Grand Canal", 0.5, 0.5), ("landscape", 1, "A gondola in a quiet canal", 0.5, 0.5), ("life", 7, "A carnival mask", 0.5, 0.4)],
    "santorini": [("landmark", 6, "Sunset over Oia", 0.5, 0.5), ("landscape", 2, "The cliffs of the caldera", 0.5, 0.5), ("life", 1, "A blue-domed chapel", 0.5, 0.5)],
    "sahara": [("landmark", 7, "The dunes of Erg Chebbi", 0.5, 0.5), ("landmark", 5, "A camel caravan", 0.5, 0.55), ("x1", 0, "Lanterns in a Marrakech souk", 0.5, 0.5)],
    "grandcanyon": [("landmark", 3, "Evening light on the canyon", 0.5, 0.5), ("landscape", 2, "Rafts on the Colorado River", 0.5, 0.5), ("landmark", 0, "A log cabin on the North Rim", 0.5, 0.5)],
    "cappadocia": [("landmark", 7, "Balloons at sunrise", 0.5, 0.5), ("landscape", 2, "Fairy chimneys", 0.5, 0.5), ("life", 1, "Turkish tea in a tulip glass", 0.5, 0.5)],
    "tajmahal": [("landmark", 6, "The Taj Mahal", 0.5, 0.5), ("landscape", 6, "The red gates of Agra Fort", 0.5, 0.5), ("life", 1, "Spices in the market", 0.5, 0.5)],
    "iceland": [("landmark", 3, "Kirkjufell and its waterfall", 0.5, 0.5), ("landscape", 7, "A seal among the icebergs of Jökulsárlón", 0.5, 0.5), ("life", 3, "An Icelandic horse", 0.5, 0.45)],
    "machupicchu": [("landmark", 7, "Machu Picchu", 0.5, 0.5), ("landscape", 6, "The Sacred Valley and the Andes", 0.5, 0.5), ("life", 6, "Llamas above the valley", 0.5, 0.5)],
    "amazon": [("landmark", 1, "Mist over the rainforest river", 0.5, 0.5), ("landscape", 4, "A squirrel monkey in the palms", 0.5, 0.5), ("life", 0, "A toucan", 0.5, 0.5)],
    "serengeti": [("landmark", 3, "Elephants under an acacia", 0.5, 0.5), ("landscape", 1, "The Great Migration", 0.5, 0.5), ("landmark", 0, "Lions having a nap", 0.5, 0.5)],
    "banff": [("landmark", 6, "Moraine Lake", 0.5, 0.5), ("landscape", 3, "Red canoes on Lake Louise", 0.5, 0.5), ("life", 0, "An elk in the meadow", 0.5, 0.5)],
    "petra": [("landmark", 7, "Al-Khazneh, the Treasury", 0.5, 0.5), ("landscape", 7, "The red sands of Wadi Rum", 0.5, 0.5), ("life", 3, "The Monastery, high in the hills", 0.5, 0.5)],
    "angkor": [("landmark", 6, "Angkor Wat", 0.5, 0.5), ("landscape", 1, "Tree roots over Ta Prohm", 0.5, 0.5), ("life", 0, "The smiling faces of the Bayon", 0.5, 0.45)],
    "reef": [("landmark", 5, "The reef from the air", 0.5, 0.5), ("landscape", 1, "The white sands of Whitehaven", 0.5, 0.5), ("landmark", 7, "A green sea turtle", 0.5, 0.5)],
    "rio": [("x3", 1, "Christ the Redeemer", 0.5, 0.5), ("landscape", 6, "Sugarloaf Mountain over the bay", 0.5, 0.5), ("x2", 0, "The tiled Selarón Steps", 0.5, 0.5)],
    "milford": [("landmark", 2, "Mitre Peak", 0.5, 0.5), ("landscape", 4, "Lupins by a Fiordland lake", 0.5, 0.5), ("life", 2, "A kea, the mountain parrot", 0.5, 0.5)],
    "antarctica": [("landmark", 6, "Peaks of the Antarctic Peninsula", 0.5, 0.5), ("landmark", 7, "A blue iceberg", 0.5, 0.5), ("life", 0, "Gentoo penguins", 0.5, 0.5)],
}
