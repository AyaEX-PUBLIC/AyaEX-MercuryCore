-- Aya render script (plain Lua 5.1). The Site substitutes _BASE_URL, _PING_URL,
-- _RENDER_TYPE, _ASSET_ID and _AVATAR_RIG. Mirrors tp-link-extender/2013 Render + Modules/Render.
local baseUrl = _BASE_URL
local pingUrl = _PING_URL
local renderType = _RENDER_TYPE
local assetId = _ASSET_ID
-- the user's avatar type, R6 or R15 (Site lib/rigTypes.ts)
local avatarRig = _AVATAR_RIG

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
	-- Aya picks the rig from the ayaRig parameter
	local rig = avatarRig and "?ayaRig=" .. avatarRig or ""
	player.CharacterAppearance = "http://" .. baseUrl .. appearancePath .. assetId .. rig
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
local character, shoulder = setupAvatar("/asset/characterfetch/")
if not character then
	error("[" .. game.JobId .. "] Failed to set up avatar " .. tostring(assetId))
end

local body = ThumbnailGenerator:Click("PNG", 840, 840, true)
print("[" .. game.JobId .. "] Rendered bodyshot")

if shoulder then
	shoulder.CurrentAngle = 0
end

local head = character:FindFirstChild("Head")
local headshot = ""
if head then
	local look = head.CFrame
	local position = look + CFrame.Angles(math.rad(180), math.pi, 0).lookVector.unit * 2.75
	local camera = Instance.new("Camera")
	camera.Name = "ThumbnailCamera"
	camera.CameraType = Enum.CameraType.Scriptable
	camera.CoordinateFrame = CFrame.new(position.p, look.p)
	camera.FieldOfView = 52.5
	camera.Parent = character
	workspace.CurrentCamera = camera
	headshot = ThumbnailGenerator:Click("PNG", 300, 300, true)
	print("[" .. game.JobId .. "] Rendered headshot")
end

if headshot ~= "" then
	upload("Completed\n" .. body .. "\n" .. headshot)
else
	upload("Completed\n" .. body)
end
