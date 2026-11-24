// [globe] A few friendly facts about each of the twenty places (shown in the place view on the globe), the
// languages spoken there and how wide a view of the ground the globe's close-up shows (km).
// The places themselves (names, levels, souvenirs) live in catalog.ts (AREAS).
// OWNED BY THE GLOBE BUILDER.

export interface PlaceInfo {
  /** languages you would hear */
  lang: string;
  /** three or four short, true, friendly facts */
  facts: string[];
  /** ground shown across the close view, km */
  span: number;
}

export const PLACE_INFO: Record<string, PlaceInfo> = {
  highlands: { lang: 'English, Scots and Gaelic', span: 560, facts: [
    'Ben Nevis, the highest mountain in Britain, rises 1,345 m above the glens.',
    'Loch Ness holds more fresh water than all the lakes of England and Wales together.',
    'Scotland’s national animal is the unicorn.',
  ] },
  kyoto: { lang: 'Japanese', span: 700, facts: [
    'Kyoto was Japan’s capital for over a thousand years, from 794 to 1869.',
    'Fushimi Inari’s path winds up the mountain under about ten thousand torii gates.',
    'Seventeen of its temples, shrines and castles are World Heritage sites.',
  ] },
  paris: { lang: 'French', span: 720, facts: [
    'The Eiffel Tower was built for the World’s Fair of 1889.',
    'It grows up to 15 cm taller on hot summer days, as the iron expands.',
    'The Louvre is the most visited art museum in the world.',
  ] },
  venice: { lang: 'Italian (and Venetian)', span: 620, facts: [
    'Venice is built on 118 small islands, joined by more than 400 bridges.',
    'There are no cars at all: people get about by boat and on foot.',
    'Gondolas have been painted black for over 400 years.',
  ] },
  santorini: { lang: 'Greek', span: 520, facts: [
    'The cliffs are the rim of a volcano’s crater, flooded by the sea.',
    'From the old port, 588 steps zigzag up to the town of Fira.',
    'Oia’s sunsets are some of the most famous in the world.',
  ] },
  sahara: { lang: 'Arabic and Amazigh', span: 1000, facts: [
    'The Sahara is almost as big as the whole of the United States.',
    'The dunes of Erg Chebbi rise up to 150 m high.',
    'Moroccan mint tea is poured from high up so it froths in the glass.',
  ] },
  grandcanyon: { lang: 'English', span: 760, facts: [
    'The canyon is 446 km long and up to 1.8 km deep.',
    'The Colorado River has been carving it for millions of years.',
    'The rocks at the bottom are almost two billion years old.',
    'California condors, wings nearly 3 m wide, glide over the rim.',
  ] },
  cappadocia: { lang: 'Turkish', span: 760, facts: [
    'The fairy chimneys are pillars of soft volcanic rock shaped by wind and rain.',
    'People carved whole cities underground; Derinkuyu goes about 85 m deep.',
    'At sunrise, around a hundred hot-air balloons drift over the valleys.',
  ] },
  tajmahal: { lang: 'Hindi and English', span: 900, facts: [
    'Emperor Shah Jahan built the Taj Mahal in memory of his wife, Mumtaz Mahal.',
    'About 20,000 craftspeople worked on it for over twenty years.',
    'Its marble looks pink at dawn, white at noon and golden in the moonlight.',
  ] },
  iceland: { lang: 'Icelandic', span: 720, facts: [
    'Iceland has around 130 volcanoes, and glaciers on top of some of them.',
    'In midsummer the sun hardly sets; in winter the northern lights dance.',
    'Icelandic horses have an extra smooth gait of their own, the tölt.',
  ] },
  machupicchu: { lang: 'Spanish and Quechua', span: 820, facts: [
    'The Inca built Machu Picchu around 1450, on a ridge 2,430 m up.',
    'Its stones fit so tightly, with no mortar, that a knife blade won’t slip between them.',
    'Llamas still graze on its grassy terraces.',
  ] },
  amazon: { lang: 'Portuguese', span: 1300, facts: [
    'The Amazon is the largest rainforest on Earth.',
    'Its river carries about a fifth of all the fresh water flowing into the oceans.',
    'About one in ten of all known kinds of animals and plants lives here.',
  ] },
  serengeti: { lang: 'Swahili and English', span: 900, facts: [
    'Every year about 1.5 million wildebeest walk round the plains in the Great Migration.',
    'Its name comes from the Maasai word for “endless plains”.',
    'Kilimanjaro, Africa’s highest mountain, is in Tanzania too.',
  ] },
  banff: { lang: 'English and French', span: 640, facts: [
    'Banff is Canada’s oldest national park, founded in 1885.',
    'Moraine Lake gets its turquoise from fine rock flour ground by the glaciers.',
    'Elk often stroll right through the town.',
  ] },
  petra: { lang: 'Arabic', span: 760, facts: [
    'The Nabataeans carved Petra into rose-red sandstone over 2,000 years ago.',
    'You reach the Treasury through the Siq, a narrow gorge about 1.2 km long.',
    'It is one of the New Seven Wonders of the World.',
  ] },
  angkor: { lang: 'Khmer', span: 800, facts: [
    'Angkor Wat is the largest religious monument in the world.',
    'It was built in the early 1100s for King Suryavarman II.',
    'The temple appears on Cambodia’s national flag.',
  ] },
  reef: { lang: 'English', span: 1000, facts: [
    'The Great Barrier Reef is the largest living structure on Earth; astronauts can see it.',
    'It is made of nearly 3,000 separate reefs along 2,300 km of coast.',
    'More than 1,500 kinds of fish live there.',
  ] },
  rio: { lang: 'Portuguese', span: 640, facts: [
    'Christ the Redeemer stands 30 m tall on top of Corcovado mountain.',
    'Rio’s Carnival is the biggest in the world.',
    'The cable car up Sugarloaf Mountain opened in 1912.',
  ] },
  milford: { lang: 'English and Māori', span: 640, facts: [
    'Milford Sound is really a fiord, carved out by glaciers.',
    'It is one of the wettest places on Earth: over 6 m of rain a year.',
    'Mitre Peak rises 1,692 m straight out of the water.',
    'The kiwi is New Zealand’s national bird.',
  ] },
  antarctica: { lang: 'none of its own (scientists from everywhere)', span: 1100, facts: [
    'Antarctica is the coldest, windiest and driest continent.',
    'About 90% of the world’s ice is here.',
    'No country owns it: it is kept for peace and science by the Antarctic Treaty.',
    'Gentoo penguins build their nests from pebbles.',
  ] },
};
