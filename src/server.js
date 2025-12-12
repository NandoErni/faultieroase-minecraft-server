import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { status } from "minecraft-server-util";

const app = express();
app.use(cors());
app.use(express.json());

const STATS_DIR = "/mcstats";
const USERCACHE = "/usercache.json";

const MC_SERVER_ADDRESS = "mc";
const MC_SERVER_PORT = 25565;

function readStats(uuid) {
  const file = path.join(STATS_DIR, `${uuid}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file));
}

function loadUserCache() {
  if (!fs.existsSync(USERCACHE)) return [];
  return JSON.parse(fs.readFileSync(USERCACHE));
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
    // This catches timeouts or connection refusals (server offline)
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

    const playtimeTicks = customStats?.["minecraft:play_time"] ?? 0;
    const deaths = customStats?.["minecraft:deaths"] ?? 0;

    const walkOneCm = customStats?.["minecraft:walk_one_cm"] ?? 0;

    return {
      uuid: u.uuid,
      name: u.name,
      playtime: playtimeTicks,
      deaths: deaths,
      distance_cm: walkOneCm,
    };
  });
  res.json(players);
});

app.listen(3000, () => {
  console.log("Minecraft Stats API running on port 3000");
});
