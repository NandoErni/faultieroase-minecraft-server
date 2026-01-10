import express from "express";
import cors from "cors";
import fs, { read } from "fs";
import path from "path";
import { status } from "minecraft-server-util";

const app = express();
app.use(cors());
app.use(express.json());

const STATS_DIR = "/mcstats";
const ADVANCEMENTS_DIR = "/mcadvancements";
const USERCACHE = "/usercache.json";

const MC_SERVER_ADDRESS = "mc";
const MC_SERVER_PORT = 25565;

const FOOD_CATEGORIES = {
  // Purely plant-based, no animal products (no milk, egg, honey, meat, or fish)
  vegan: [
    "minecraft:apple",
    "minecraft:carrot",
    "minecraft:bread",
    "minecraft:potato",
    "minecraft:baked_potato",
    "minecraft:beetroot",
    "minecraft:melon_slice",
    "minecraft:sweet_berries",
    "minecraft:glow_berries",
    "minecraft:cookie",
    "minecraft:mushroom_stew",
    "minecraft:beetroot_soup",
    "minecraft:golden_carrot",
    "minecraft:golden_apple",
    "minecraft:enchanted_golden_apple",
    "minecraft:kelp",
    "minecraft:dried_kelp",
    "minecraft:pumpkin_seeds", // Edible but usually for planting
    "minecraft:chorus_fruit",
  ],
  // Contains dairy, eggs, or honey, but no meat/fish
  vegetarian: [
    "minecraft:milk_bucket",
    "minecraft:honey_bottle",
    "minecraft:cake",
    "minecraft:pumpkin_pie",
  ],
  // Contains fish/aquatic life, but no land animal products
  pescetarian: [
    "minecraft:cod",
    "minecraft:salmon",
    "minecraft:cooked_cod",
    "minecraft:cooked_salmon",
    "minecraft:pufferfish", // Toxic, but edible
    "minecraft:tropical_fish", // Edible
  ],
  // Contains land animal meat
  meat: [
    "minecraft:beef",
    "minecraft:chicken",
    "minecraft:mutton",
    "minecraft:porkchop",
    "minecraft:rabbit",
    "minecraft:cooked_beef",
    "minecraft:cooked_chicken",
    "minecraft:cooked_mutton",
    "minecraft:cooked_porkchop",
    "minecraft:cooked_rabbit",
    "minecraft:rabbit_stew", // Contains rabbit meat
    "minecraft:rotten_flesh", // Edible (undead meat)
    "minecraft:spider_eye", // Edible (insect/arthropod)
  ],
};

const ADVANCEMENT_CATEGORIES = [
  'minecraft:story',
  'minecraft:nether',
  'minecraft:end',
  'minecraft:adventure',
  'minecraft:husbandry'
]

function readStats(uuid) {
  const file = path.join(STATS_DIR, `${uuid}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file));
}

function readAdvancements(uuid) {
  const file = path.join(ADVANCEMENTS_DIR, `${uuid}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file));
}

function loadUserCache() {
  if (!fs.existsSync(USERCACHE)) return [];
  return JSON.parse(fs.readFileSync(USERCACHE));
}

function determineDiet(stats) {
  const usedItems = stats?.stats?.["minecraft:used"] || {};

  let ateMeat = false;
  let atePescetarian = false;
  let ateVegetarian = false;

  for (const item in usedItems) {
    if (FOOD_CATEGORIES.meat.includes(item)) ateMeat = true;
    else if (FOOD_CATEGORIES.pescetarian.includes(item)) atePescetarian = true;
    else if (FOOD_CATEGORIES.vegetarian.includes(item)) ateVegetarian = true;
  }

  if (ateMeat) return "carnivore";
  if (atePescetarian) return "pescetarian";
  if (ateVegetarian) return "vegetarian";
  return "vegan";
}

function getAdvancementNames(advancements) {
  const names = Object.keys(advancements)
    .filter(k => ADVANCEMENT_CATEGORIES.includes(k.split("/")[0]) && advancements[k]["done"])
    .map(k => k.split("/")[1])
  return names
}

app.get("/status", async (req, res) => {
  try {
    const response = await status(MC_SERVER_ADDRESS, MC_SERVER_PORT, {
      timeout: 5000,
      enableSRV: true,
    });

    const onlinePlayers = response.players.sample
      ? response.players.sample.map((p) => p.name)
      : [];

    res.json({
      online: true,
      playerCount: response.players.online,
      maxPlayers: response.players.max,
      onlineNames: onlinePlayers,
    });
  } catch (error) {
    res.json({
      online: false,
      playerCount: 0,
      maxPlayers: 40,
      onlineNames: [],
    });
  }
});

app.get("/players", (req, res) => {
  const users = loadUserCache();
  const players = users.map((u) => {
    const stats = readStats(u.uuid) || {};
    const customStats = stats?.stats?.["minecraft:custom"];
    const advancements = readAdvancements(u.uuid) || []

    const playtimeTicks = customStats?.["minecraft:play_time"] ?? 0;
    const deaths = customStats?.["minecraft:deaths"] ?? 0;
    const walkOneCm = customStats?.["minecraft:walk_one_cm"] ?? 0;
    const sprintOneCm = customStats?.["minecraft:sprint_one_cm"] ?? 0;
    const walkUnderWaterOneCm = customStats?.["minecraft:walk_under_water_one_cm"] ?? 0;
    const walkOnWaterOneCm = customStats?.["minecraft:walk_on_water_one_cm"] ?? 0;
    const swimOneCm = customStats?.["minecraft:swim_one_cm"] ?? 0;
    const boatOneCm = customStats?.["minecraft:boat_one_cm"] ?? 0;
    const pigOneCm = customStats?.["minecraft:pig_one_cm"] ?? 0;
    const bellRings = customStats?.["minecraft:bell_ring"] ?? 0;

    const diet = determineDiet(stats);
    const advancement_names = getAdvancementNames(advancements)

    return {
      uuid: u.uuid,
      name: u.name,
      playtime: playtimeTicks,
      deaths: deaths,
      distance_cm: walkOneCm + sprintOneCm + walkUnderWaterOneCm + walkOnWaterOneCm + swimOneCm,
      pig_distance_cm: pigOneCm,
      boat_distance_cm: boatOneCm,
      diet: diet,
      bell_rings: bellRings,
      advancements: advancement_names,
    };
  });

  res.json(players);
});

app.listen(3000, () => {
  console.log("Minecraft Stats API running on port 3000");
});
