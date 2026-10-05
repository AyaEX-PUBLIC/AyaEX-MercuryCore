-- Aya.Server host script, served by /game/{id}/serve and sent to Aya.Server as
-- an RCC OpenJobEx job by the Orbiter and RCC proxy.
-- The Site substitutes _BASE_URL, _SITE_ORIGIN, _MAP_LOCATION, _SERVER_PORT
-- and _SERVER_PRESENCE_URL; the Orbiter substitutes _HOSTPING_URL.
print "[Host]: Starting Aya gameserver..."

local NetworkServer = game:GetService "NetworkServer"
local Players = game:GetService "Players"
local RunService = game:GetService "RunService"
local ScriptContext = game:GetService "ScriptContext"
local InsertService = game:GetService "InsertService"
local ContentProvider = game:GetService "ContentProvider"

local url = "http://" .. _BASE_URL
local mapLoc = _MAP_LOCATION
local port = _SERVER_PORT
local presenceUrl = _SERVER_PRESENCE_URL
local hostPingUrl = "_HOSTPING_URL"
local siteOrigin = _SITE_ORIGIN -- https; the badge award POST can't follow an http -> https redirect

-- report the connected players with the presence ping, which marks them as
-- playing on the website
local function reportPresence(leaving)
	if presenceUrl == "" then
		return
	end
	local names = {}
	for _, player in ipairs(Players:GetPlayers()) do
		if player ~= leaving then
			names[#names + 1] = player.Name
		end
	end
	pcall(function()
		game:HttpGet(presenceUrl .. "&players=" .. table.concat(names, ","), false)
	end)
end

local function hostPing(status)
	if hostPingUrl == "" or hostPingUrl:sub(1, 1) == "_" then
		return
	end
	pcall(function()
		game:HttpPost(hostPingUrl, status, false, "text/json")
	end)
end

pcall(function() settings().Network.UseInstancePacketCache = true end)
pcall(function() settings().Network.UsePhysicsPacketCache = true end)
pcall(function() settings()["Task Scheduler"].PriorityMethod = Enum.PriorityMethod.AccumulatedError end)
settings().Network.PhysicsSend = Enum.PhysicsSendMethod.TopNErrors
settings().Network.ExperimentalPhysicsEnabled = true
settings().Network.WaitingForCharacterLogRate = 100
pcall(function() settings().Diagnostics.LuaRamLimit = 0 end)

ScriptContext.ScriptsDisabled = true

local placeId = tonumber(mapLoc:match "id=(%d+)") or 0
pcall(function() game:SetPlaceID(placeId, false) end)
pcall(function() game:GetService("ChangeHistoryService"):SetEnabled(false) end)

pcall(function() ContentProvider:SetBaseUrl(url .. "/") end)
pcall(function() game:GetService("ScriptInformationProvider"):SetAssetUrl(url .. "/asset/") end)
pcall(function() Players:SetAbuseReportUrl(url .. "/AbuseReport/InGameChatHandler.ashx") end)
pcall(function() game:GetService("BadgeService"):SetPlaceId(placeId) end)
-- badges and game passes (Site routes game/badge/* and game/gamepass/haspass)
pcall(function()
	local BadgeService = game:GetService "BadgeService"
	BadgeService:SetAwardBadgeUrl(siteOrigin .. "/game/badge/award?userId=%d&badgeId=%d&placeId=%d")
	BadgeService:SetHasBadgeUrl(siteOrigin .. "/game/badge/has?userId=%d&badgeId=%d")
	BadgeService:SetIsBadgeDisabledUrl(siteOrigin .. "/game/badge/disabled?badgeId=%d&placeId=%d")
	BadgeService:SetIsBadgeLegalUrl(siteOrigin .. "/game/badge/legal?badgeId=%d&placeId=%d")
end)
pcall(function()
	game:GetService("GamePassService"):SetPlayerHasPassUrl(siteOrigin .. "/game/gamepass/haspass?UserID=%d&PassID=%d")
end)
pcall(function() InsertService:SetBaseSetsUrl(url .. "/Game/Tools/InsertAsset.ashx?nsets=10&type=base") end)
pcall(function() InsertService:SetUserSetsUrl(url .. "/Game/Tools/InsertAsset.ashx?nsets=20&type=user&userid=%d") end)
pcall(function() InsertService:SetCollectionUrl(url .. "/Game/Tools/InsertAsset.ashx?sid=%d") end)
pcall(function() InsertService:SetAssetUrl(url .. "/asset?id=%d") end)
pcall(function() InsertService:SetAssetVersionUrl(url .. "/asset?assetversionid=%d") end)

Players.PlayerAdded:connect(function(player)
	print("Player " .. player.userId .. " added")
	hostPing("PlayerAdded\n" .. tostring(player.userId))
	reportPresence()
end)
Players.PlayerRemoving:connect(function(player)
	print("Player " .. player.userId .. " leaving")
	hostPing("PlayersLeft\n" .. tostring(player.userId))
	reportPresence(player)
end)

-- Aya starts the network server before loading the place (content/host.lua)
NetworkServer:Start(port)
print("[Host]: Network server started on port " .. port)

if mapLoc ~= "" then
	print("[Host]: Loading " .. mapLoc)
	game:Load(mapLoc)
	print "[Host]: Place loaded"
end

ScriptContext:SetTimeout(10)
ScriptContext.ScriptsDisabled = false

hostPing "Ready"

-- Liveness for the Orbiter (~every 10s at 60Hz), and shut down after five
-- minutes without players
local heartbeats = 0
local emptySince = os.time()
reportPresence()
RunService.Heartbeat:connect(function()
	heartbeats = heartbeats + 1
	-- presence about every 5s; the website forgets players after 35s
	if heartbeats % 300 == 0 then
		reportPresence()
	end
	if heartbeats % 600 ~= 0 then
		return
	end
	hostPing "Heartbeat"
	if #Players:GetPlayers() > 0 then
		emptySince = os.time()
	elseif os.time() - emptySince > 300 then
		print "[Host]: No players for five minutes, closing"
		hostPing "Closed"
	end
end)

RunService:Run()
