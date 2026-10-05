-- Aya render script (plain Lua 5.1). The Site substitutes _BASE_URL, _PING_URL,
-- _RENDER_TYPE and _ASSET_ID. Mirrors tp-link-extender/2013 Render + Modules/Render.
local baseUrl = _BASE_URL
local pingUrl = _PING_URL
local renderType = _RENDER_TYPE
local assetId = _ASSET_ID

local ContentProvider = game:GetService("ContentProvider")
local InsertService = game:GetService("InsertService")
local ThumbnailGenerator = game:GetService("ThumbnailGenerator")

local function post(body)
	-- the proxy relays this to the Site's /api/render/update route
	game:HttpPost(pingUrl, body, true, "text/json")
end

local function upload(result)
	for attempt = 1, 3 do
		local ok, err = pcall(post, result)
		if ok then
			print("[" .. game.JobId .. "] Render uploaded")
			return
		end
		print("[" .. game.JobId .. "] Render upload failed (" .. tostring(err) .. "), attempt " .. attempt)
	end
end

local ok, err = pcall(function()
	ContentProvider:SetBaseUrl("http://" .. baseUrl .. "/")
	InsertService:SetAssetUrl("http://" .. baseUrl .. "/asset?id=%d")
	InsertService:SetAssetVersionUrl("http://" .. baseUrl .. "/asset?assetversionid=%d")
end)
if not ok then
	error("[" .. game.JobId .. "] Failed to set asset URLs: " .. tostring(err))
end

pcall(function() game:GetService("ScriptContext").ScriptsDisabled = true end)
pcall(post, "Rendering")

print("[" .. game.JobId .. "] Starting " .. tostring(renderType) .. " render for " .. tostring(assetId))

local function setupAvatar(appearancePath)
	local player = game:GetService("Players"):CreateLocalPlayer(0)
	player.CharacterAppearance = "http://" .. baseUrl .. appearancePath .. assetId
	player:LoadCharacter(false)

	local character = player.Character
	if not character then
		return nil, nil
	end

	-- raise the right arm if the character holds gear
	local backpack = player:FindFirstChild("Backpack")
	local gear = backpack and backpack:GetChildren()[1]
	if not gear then
		return character, nil
	end
	gear.Parent = character
	local torso = character:FindFirstChild("Torso")
	local shoulder = torso and torso:FindFirstChild("Right Shoulder")
	if shoulder then
		shoulder.CurrentAngle = math.rad(90)
	end
	return character, shoulder
end
for _, object in pairs(game:GetObjects("http://" .. baseUrl .. "/asset?id=" .. assetId)) do
	pcall(function() object.Parent = workspace end)
end

local click = ThumbnailGenerator:Click("PNG", 1024, 1024, true, true) -- cropped
print("[" .. game.JobId .. "] Rendered model")
upload("Completed\n" .. click)
